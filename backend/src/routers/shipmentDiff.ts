import { GoogleGenerativeAI } from "@google/generative-ai";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AnomalyReportModel } from "../models/AnomalyReport.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { ShipmentDiffModel } from "../models/ShipmentDiff.js";
import { protectedProcedure, router } from "../trpc.js";

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

export const shipmentDiffRouter = router({
  /**
   * POST shipmentDiff.compare
   */
  compare: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        beforeImageBase64: z.string().min(10),
        afterImageBase64: z.string().min(10),
        mimeType: z.string().default("image/jpeg"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GOOGLE_API_KEY is not configured",
        });
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt =
        'Compare these two shipment images (before loading vs after delivery). Respond ONLY with JSON: {"missingItems": string[], "damageDescription": string, "tamperingProbability": number (0-1), "riskScore": number (0-100), "summary": string}';

      let rawText: string;
      try {
        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              data: input.beforeImageBase64,
              mimeType: input.mimeType,
            },
          },
          {
            inlineData: {
              data: input.afterImageBase64,
              mimeType: input.mimeType,
            },
          },
        ]);
        rawText = result.response.text();
      } catch (err) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Gemini API failed: ${(err as Error)?.message ?? "unknown"}`,
        });
      }

      let parsed: {
        missingItems: string[];
        damageDescription: string;
        tamperingProbability: number;
        riskScore: number;
        summary: string;
      };

      try {
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}") + 1;
        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error("No JSON object found in response");
        }
        const cleanText = rawText.slice(jsonStart, jsonEnd).trim();
        parsed = JSON.parse(cleanText);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini response. Raw snippet: ${rawText.slice(0, 200)}`,
        });
      }

      const riskScore = Math.min(100, Math.max(0, Number(parsed.riskScore ?? 0)));
      const tamperingProbability = Math.min(
        1,
        Math.max(0, Number(parsed.tamperingProbability ?? 0)),
      );

      const doc = await ShipmentDiffModel.create({
        userId,
        draftId: input.draftId,
        riskScore,
        tamperingProbability,
        missingItems: Array.isArray(parsed.missingItems) ? parsed.missingItems : [],
        damageDescription: parsed.damageDescription ?? "",
        summary: parsed.summary ?? "",
        createdAt: new Date(),
      });

      await writeAudit(
        userId,
        input.draftId,
        "shipment-diff-compare",
        `Shipment diff: risk ${riskScore}, tampering ${(tamperingProbability * 100).toFixed(0)}%`,
        {
          riskScore,
          tamperingProbability,
          missingItems: parsed.missingItems,
          resultId: String(doc._id),
        },
      );

      // Cross-feature linkage: emit high-severity AnomalyReport when riskScore > 70.
      if (riskScore > 70) {
        try {
          await AnomalyReportModel.create({
            userId,
            draftId: input.draftId,
            declaredWeightKg: 0,
            measuredWeightKg: 0,
            declaredCount: 0,
            detectedCount: 0,
            originCity: "n/a",
            destinationCity: "n/a",
            routeDeviationKm: 0,
            flags: ["shipment-diff-high-risk"],
            severity: "high",
            riskScore,
            summary: `Shipment diff risk ${riskScore}: ${parsed.summary ?? parsed.damageDescription ?? ""}`.slice(0, 600),
            createdAt: new Date(),
          });
        } catch (err) {
          console.error(
            "[shipmentDiff.compare] anomaly emit failed:",
            (err as Error)?.message,
          );
        }
      }

      return doc;
    }),

  /**
   * GET shipmentDiff.history
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const records = await ShipmentDiffModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return records;
    }),
});
