import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { router, protectedProcedure } from "../trpc.js";
import { BoxCountResultModel } from "../models/BoxCountResult.js";

export const boxCountRouter = router({
  /**
   * Mutation: verify
   * Upload a shipment image (base64) and compare AI-detected box count
   * against the declared manifest count.
   */
  verify: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        declaredCount: z.number().int().positive(),
        imageBase64: z.string().min(10),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt =
        'Count the number of distinct boxes/packages visible in this image. Respond ONLY with a JSON object {"count": number, "confidence": number (0-1), "notes": string}';

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: input.imageBase64,
            mimeType: input.mimeType,
          },
        },
      ]);

      const rawText = result.response.text();

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
      } catch (_err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini response as JSON. Raw text: ${rawText.slice(0, 300)}`,
        });
      }

      const detectedCount = Math.round(parsed.count ?? 0);
      const confidence = parsed.confidence ?? 0;
      const notes = parsed.notes ?? "";

      const diff = Math.abs(detectedCount - input.declaredCount);
      const mismatch = diff > 0;
      const mismatchPct =
        input.declaredCount > 0 ? (diff / input.declaredCount) * 100 : 0;

      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid userId format",
        });
      }

      const validatedUserId = new mongoose.Types.ObjectId(String(userId));

      const doc = await BoxCountResultModel.create({
        userId: validatedUserId,
        draftId: input.draftId,
        declaredCount: input.declaredCount,
        detectedCount,
        mismatch,
        mismatchPct,
        confidence,
        notes,
        createdAt: new Date(),
      });

      return doc;
    }),

  /**
   * Mutation: liveCommentary
   * Single-frame fast commentary for the live camera. Combines a YOLO class-count
   * snapshot (from the browser's /yolo/detect call) with a Gemini multimodal pass
   * over the same frame. Returns one short natural-language line plus a
   * suspected box count and risk level.
   */
  liveCommentary: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string().min(10),
        mimeType: z.string().default("image/jpeg"),
        manifestCount: z.number().int().nonnegative().optional(),
        yoloClassCounts: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const yoloSummary = input.yoloClassCounts
        ? Object.entries(input.yoloClassCounts)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")
        : "no YOLO data";

      const prompt = `You are a logistics inspector analysing a live camera frame from a warehouse.
YOLO detector saw: ${yoloSummary}.
Declared manifest count: ${input.manifestCount ?? "unknown"}.

Respond ONLY with strict JSON:
{
  "commentary": "<one short sentence describing what you see in this frame, in the voice of a shipment inspector>",
  "suspectedCount": <integer, your best estimate of distinct boxes/packages visible>,
  "riskLevel": "low" | "medium" | "high",
  "alert": <true if you see anything suspicious — damage, tampering, mismatch with manifest, missing items>
}`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
      ]);
      const rawText = result.response.text();

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
        return {
          commentary: String(parsed.commentary ?? "").slice(0, 240),
          suspectedCount: Math.max(0, Math.round(parsed.suspectedCount ?? 0)),
          riskLevel: (parsed.riskLevel ?? "low") as "low" | "medium" | "high",
          alert: Boolean(parsed.alert),
        };
      } catch (_err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini commentary. Raw text: ${rawText.slice(0, 240)}`,
        });
      }
    }),

  /**
   * Mutation: saveSession
   * Persist the aggregate result of a live monitoring session as a
   * BoxCountResult document (so it shows up in history alongside single
   * uploads).
   */
  saveSession: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        declaredCount: z.number().int().positive(),
        detectedCount: z.number().int().nonnegative(),
        confidence: z.number().min(0).max(1).default(0.85),
        notes: z.string().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;
      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid userId format",
        });
      }
      const diff = Math.abs(input.detectedCount - input.declaredCount);
      const mismatch = diff > 0;
      const mismatchPct =
        input.declaredCount > 0 ? (diff / input.declaredCount) * 100 : 0;

      const doc = await BoxCountResultModel.create({
        userId: new mongoose.Types.ObjectId(String(userId)),
        draftId: input.draftId,
        declaredCount: input.declaredCount,
        detectedCount: input.detectedCount,
        mismatch,
        mismatchPct,
        confidence: input.confidence,
        notes: input.notes,
        createdAt: new Date(),
      });
      return doc;
    }),

  /**
   * Query: history
   * Return the last N BoxCountResult docs for the authenticated user, newest first.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const results = await BoxCountResultModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return results;
    }),
});
