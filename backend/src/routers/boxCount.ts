import { genai, FLASH_MODEL } from "../lib/genai.js";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AnomalyReportModel } from "../models/AnomalyReport.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { BoxCountResultModel } from "../models/BoxCountResult.js";
import { protectedProcedure, router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
/** 10 MB in base64 characters (10 * 1024 * 1024 * 4/3 ≈ 13,981,013) */
const MAX_IMAGE_BASE64_CHARS = 13_981_013;
/** Maximum characters to include in error log snippets to avoid log explosion */
const ERR_SNIPPET_LEN = 240;
/** mismatchPct threshold above which an AnomalyReport stub is emitted */
const ANOMALY_MISMATCH_PCT_THRESHOLD = 20;
/** Upper bound for riskScore forwarded to AnomalyReport */
const MAX_RISK_SCORE = 100;
/** Confidence range bounds */
const CONFIDENCE_MIN = 0;
const CONFIDENCE_MAX = 1;
/** Maximum length for user-supplied notes string */
const MAX_NOTES_LEN = 2000;
/** Maximum tag list length for MIME type string */
const MAX_MIME_LEN = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function writeAudit(
  userId: mongoose.Types.ObjectId,
  draftId: string | undefined,
  eventType: string,
  summary: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditEventModel.create({
      userId,
      draftId: draftId ?? "n/a",
      eventType,
      payload,
      summary,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error(`[audit] failed to write ${eventType}:`, (err as Error)?.message);
  }
}

function clampConfidence(value: unknown): number {
  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, Number(value ?? 0)));
}

function clampRiskScore(value: unknown): number {
  return Math.min(MAX_RISK_SCORE, Math.max(0, Math.round(Number(value ?? 0))));
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const boxCountRouter = router({
  /**
   * Mutation: verify
   * Upload a shipment image (base64) and compare AI-detected box count
   * against the declared manifest count.
   */
  verify: protectedProcedure
    .input(
      z.object({
        draftId: z.string().max(100).optional(),
        // 0 = no manifest declared (demo mode: just report what AI sees).
        declaredCount: z.number().int().nonnegative().default(0),
        imageBase64: z.string().min(10).max(MAX_IMAGE_BASE64_CHARS, {
          message: "Image exceeds 10 MB limit",
        }),
        mimeType: z.string().min(1).max(MAX_MIME_LEN).default("image/jpeg"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const prompt =
        'Count the number of distinct boxes/packages visible in this image. Respond ONLY with a JSON object {"count": number, "confidence": number (0-1), "notes": string}';

      let rawText: string;
      try {
        const response = await genai().models.generateContent({
          model: FLASH_MODEL,
          contents: [
            { role: "user", parts: [
              { text: prompt },
              { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
            ]},
          ],
        });
        rawText = response.text ?? "";
      } catch (err) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Gemini API failed: ${String((err as Error)?.message ?? "unknown").slice(0, ERR_SNIPPET_LEN)}`,
        });
      }

      let parsed: { count: number; confidence: number; notes: string };
      try {
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}") + 1;
        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error("No JSON object found in response");
        }
        const jsonSlice = rawText.slice(jsonStart, jsonEnd).trim();
        parsed = JSON.parse(jsonSlice) as {
          count: number;
          confidence: number;
          notes: string;
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini response as JSON. Raw text: ${rawText.slice(0, ERR_SNIPPET_LEN)}`,
        });
      }

      const detectedCount = Math.max(0, Math.round(Number(parsed.count ?? 0)));
      const confidence = clampConfidence(parsed.confidence);
      const notes = String(parsed.notes ?? "").slice(0, MAX_NOTES_LEN);

      const diff = Math.abs(detectedCount - input.declaredCount);
      // No manifest → never a mismatch; this is "see what AI sees" mode.
      const mismatch = input.declaredCount > 0 && diff > 0;
      const mismatchPct =
        input.declaredCount > 0 ? Math.min(100, (diff / input.declaredCount) * 100) : 0;

      const doc = await BoxCountResultModel.create({
        userId,
        draftId: input.draftId,
        declaredCount: input.declaredCount,
        detectedCount,
        mismatch,
        mismatchPct,
        confidence,
        notes,
        createdAt: new Date(),
      });

      await writeAudit(
        userId,
        input.draftId,
        "box-count-verify",
        `Box count verify: declared ${input.declaredCount}, detected ${detectedCount}`,
        {
          declaredCount: input.declaredCount,
          detectedCount,
          mismatchPct,
          resultId: String(doc._id),
        },
      );

      // Cross-feature linkage: emit AnomalyReport stub on large mismatch (parity with saveSession).
      if (mismatchPct > ANOMALY_MISMATCH_PCT_THRESHOLD) {
        try {
          await AnomalyReportModel.create({
            userId,
            draftId: input.draftId,
            declaredWeightKg: 0,
            measuredWeightKg: 0,
            declaredCount: input.declaredCount,
            detectedCount,
            flags: ["box-count-mismatch"],
            severity: "medium",
            riskScore: clampRiskScore(mismatchPct),
            summary: `Box count mismatch ${mismatchPct.toFixed(1)}% (declared ${input.declaredCount}, detected ${detectedCount}).`,
            createdAt: new Date(),
          });
        } catch (err) {
          console.error(
            "[boxCount.verify] anomaly emit failed:",
            (err as Error)?.message,
          );
        }
      }

      return doc;
    }),

  /**
   * Mutation: liveCommentary
   */
  liveCommentary: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string().min(10).max(MAX_IMAGE_BASE64_CHARS, {
          message: "Image exceeds 10 MB limit",
        }),
        mimeType: z.string().min(1).max(MAX_MIME_LEN).default("image/jpeg"),
        manifestCount: z.number().int().nonnegative().optional(),
        yoloClassCounts: z.record(z.string(), z.number()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireUserId(ctx);

      // Demo-mode: treat every discrete physical object the YOLO detector
      // surfaces (phones, bottles, mugs, books, laptops, etc.) as a stand-in
      // for a cargo unit. In a real warehouse the same pipeline runs against
      // actual cartons — but for a hackathon demo the operator is holding
      // whatever's on their desk, and the inspection flow needs to read it
      // as "1 unit", "2 units", etc., not "no packages visible".
      const yoloSummary = input.yoloClassCounts
        ? Object.entries(input.yoloClassCounts)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")
        : "no YOLO data";

      // Sum every YOLO detection (excluding "person") as the floor for the
      // suspected count — gives the LLM a strong prior, so it never says
      // "no packages" when the camera clearly sees objects.
      const yoloUnitFloor = input.yoloClassCounts
        ? Object.entries(input.yoloClassCounts)
            .filter(([k]) => k.toLowerCase() !== "person")
            .reduce((sum, [, v]) => sum + v, 0)
        : 0;

      const prompt = `You are a logistics inspector running a live camera inspection. Demo mode is active: in this demo, the operator presents stand-in objects (phones, bottles, mugs, books, etc.) instead of real cargo cartons. You MUST treat EVERY discrete graspable object as one cargo unit — do not say "no packages visible" when the frame contains any object. Only ignore "person" detections.

YOLO detector saw: ${yoloSummary}.
YOLO non-person object count: ${yoloUnitFloor}.
Declared manifest count: ${input.manifestCount ?? "not yet declared"}.

Respond ONLY with strict JSON:
{
  "commentary": "<one short sentence describing the cargo units you see, in an inspector's voice. Always speak as if these are shipment units — e.g. 'I see 2 units staged in frame: a cylindrical container and a flat package.' Never say 'no packages'.>",
  "suspectedCount": <integer count of distinct cargo units (graspable objects, excluding people). Must be at least ${yoloUnitFloor} when YOLO has found that many.>,
  "riskLevel": "low" | "medium" | "high",
  "alert": <true if the count differs from the manifest count, OR if any object looks damaged/tampered. false otherwise.>
}`;

      let rawText: string;
      try {
        const response = await genai().models.generateContent({
          model: FLASH_MODEL,
          contents: [
            { role: "user", parts: [
              { text: prompt },
              { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
            ]},
          ],
        });
        rawText = response.text ?? "";
      } catch (err) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Gemini commentary failed: ${String((err as Error)?.message ?? "unknown").slice(0, ERR_SNIPPET_LEN)}`,
        });
      }

      try {
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}") + 1;
        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error("No JSON object found in Gemini response");
        }
        const parsed = JSON.parse(rawText.slice(jsonStart, jsonEnd).trim()) as {
          commentary: string;
          suspectedCount: number;
          riskLevel: "low" | "medium" | "high";
          alert: boolean;
        };
        const validRiskLevels: ReadonlyArray<string> = ["low", "medium", "high"];
        const riskLevel: "low" | "medium" | "high" = validRiskLevels.includes(parsed.riskLevel)
          ? parsed.riskLevel
          : "low";
        return {
          commentary: String(parsed.commentary ?? "").slice(0, ERR_SNIPPET_LEN),
          suspectedCount: Math.max(0, Math.round(Number(parsed.suspectedCount ?? 0))),
          riskLevel,
          alert: Boolean(parsed.alert),
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini commentary. Raw text: ${rawText.slice(0, ERR_SNIPPET_LEN)}`,
        });
      }
    }),

  /**
   * Mutation: saveSession
   * Persist the aggregate result of a live monitoring session.
   * Emits an AnomalyReport stub when mismatchPct > ANOMALY_MISMATCH_PCT_THRESHOLD.
   */
  saveSession: protectedProcedure
    .input(
      z.object({
        draftId: z.string().max(100).optional(),
        // 0 = demo mode, no manifest comparison.
        declaredCount: z.number().int().nonnegative().default(0),
        detectedCount: z.number().int().nonnegative(),
        confidence: z.number().min(CONFIDENCE_MIN).max(CONFIDENCE_MAX).default(0.85),
        notes: z.string().max(MAX_NOTES_LEN).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const diff = Math.abs(input.detectedCount - input.declaredCount);
      const mismatch = input.declaredCount > 0 && diff > 0;
      const mismatchPct =
        input.declaredCount > 0 ? Math.min(100, (diff / input.declaredCount) * 100) : 0;

      const doc = await BoxCountResultModel.create({
        userId,
        draftId: input.draftId,
        declaredCount: input.declaredCount,
        detectedCount: input.detectedCount,
        mismatch,
        mismatchPct,
        confidence: input.confidence,
        notes: input.notes,
        createdAt: new Date(),
      });

      await writeAudit(
        userId,
        input.draftId,
        "box-count-save-session",
        `Box count session: declared ${input.declaredCount}, detected ${input.detectedCount}`,
        {
          declaredCount: input.declaredCount,
          detectedCount: input.detectedCount,
          mismatchPct,
          resultId: String(doc._id),
        },
      );

      // Cross-feature linkage: emit AnomalyReport stub on large mismatch.
      if (mismatchPct > ANOMALY_MISMATCH_PCT_THRESHOLD) {
        try {
          await AnomalyReportModel.create({
            userId,
            draftId: input.draftId,
            declaredWeightKg: 0,
            measuredWeightKg: 0,
            declaredCount: input.declaredCount,
            detectedCount: input.detectedCount,
            flags: ["box-count-mismatch"],
            severity: "medium",
            riskScore: clampRiskScore(mismatchPct),
            summary: `Box count mismatch ${mismatchPct.toFixed(1)}% (declared ${input.declaredCount}, detected ${input.detectedCount}).`,
            createdAt: new Date(),
          });
        } catch (err) {
          console.error(
            "[boxCount.saveSession] anomaly emit failed:",
            (err as Error)?.message,
          );
        }
      }

      return doc;
    }),

  /**
   * Query: history
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const results = await BoxCountResultModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return results;
    }),
});
