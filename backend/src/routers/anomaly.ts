import { GoogleGenerativeAI } from "@google/generative-ai";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AnomalyReportModel } from "../models/AnomalyReport.js";
import { AuditEventModel } from "../models/AuditEvent.js";
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

export const anomalyRouter = router({
  /**
   * mutation: analyze
   */
  analyze: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        declaredWeightKg: z.number().nonnegative(),
        measuredWeightKg: z.number().nonnegative(),
        declaredCount: z.number().int().nonnegative(),
        detectedCount: z.number().int().nonnegative(),
        originCity: z.string(),
        destinationCity: z.string(),
        routeDeviationKm: z.number().nonnegative().default(0),
        extraNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const {
        draftId,
        declaredWeightKg,
        measuredWeightKg,
        declaredCount,
        detectedCount,
        originCity,
        destinationCity,
        routeDeviationKm,
        extraNotes,
      } = input;

      const weightDiffPct =
        declaredWeightKg > 0
          ? (Math.abs(measuredWeightKg - declaredWeightKg) / declaredWeightKg) * 100
          : 0;

      const countDiff = Math.abs(detectedCount - declaredCount);

      const prompt = `
You are a logistics fraud and anomaly detection AI. Analyze the following shipment data and identify suspicious patterns.

Shipment Details:
- Origin City: ${originCity}
- Destination City: ${destinationCity}
- Declared Weight: ${declaredWeightKg} kg
- Measured/Actual Weight: ${measuredWeightKg} kg
- Weight Discrepancy: ${weightDiffPct.toFixed(1)}%
- Declared Item Count: ${declaredCount}
- Detected Item Count: ${detectedCount}
- Count Discrepancy: ${countDiff} units
- Route Deviation: ${routeDeviationKm} km from expected route
${extraNotes ? `- Additional Notes: ${extraNotes}` : ""}

Based on this data, identify any anomalies or suspicious patterns. Consider:
1. Weight discrepancies (>5% is suspicious, >15% is highly suspicious)
2. Count discrepancies (any missing/extra units)
3. Route deviations (>50 km is suspicious)
4. Any combination of factors that suggests fraud, mislabeling, theft, or contraband

Return ONLY a valid JSON object with no markdown or extra text, in exactly this format:
{
  "flags": ["<specific anomaly 1>", "<specific anomaly 2>"],
  "severity": "low" | "medium" | "high",
  "riskScore": <integer 0-100>,
  "summary": "<2-3 sentence professional summary of findings and recommendations>"
}

Rules for severity:
- "high": riskScore >= 70 or multiple serious flags
- "medium": riskScore 40-69 or one significant flag
- "low": riskScore < 40 or minor discrepancies only
`;

      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GOOGLE_API_KEY is not configured",
        });
      }
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      let geminiResult;
      try {
        geminiResult = await model.generateContent(prompt);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Gemini API call failed: ${(err as Error).message}`,
        });
      }

      const rawText = geminiResult.response.text();

      let parsed: {
        flags: string[];
        severity: "low" | "medium" | "high";
        riskScore: number;
        summary: string;
      };

      try {
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}") + 1;
        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error("No JSON object found in response");
        }
        const cleanJson = rawText.slice(jsonStart, jsonEnd).trim();
        parsed = JSON.parse(cleanJson);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini response as JSON. Raw response snippet: ${rawText.slice(0, 200)}`,
        });
      }

      if (
        !Array.isArray(parsed.flags) ||
        !["low", "medium", "high"].includes(parsed.severity) ||
        typeof parsed.riskScore !== "number" ||
        typeof parsed.summary !== "string"
      ) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gemini response has unexpected shape. Raw: ${rawText.slice(0, 200)}`,
        });
      }

      const report = await AnomalyReportModel.create({
        userId,
        draftId: draftId ?? undefined,
        declaredWeightKg,
        measuredWeightKg,
        declaredCount,
        detectedCount,
        originCity,
        destinationCity,
        routeDeviationKm,
        flags: parsed.flags,
        severity: parsed.severity,
        riskScore: parsed.riskScore,
        summary: parsed.summary,
        createdAt: new Date(),
      });

      await writeAudit(
        userId,
        draftId,
        "anomaly-analyze",
        `Anomaly analysis: severity ${parsed.severity}, risk ${parsed.riskScore}`,
        {
          severity: parsed.severity,
          riskScore: parsed.riskScore,
          flags: parsed.flags,
          resultId: String(report._id),
        },
      );

      return report;
    }),

  /**
   * query: history
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const reports = await AnomalyReportModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return reports;
    }),
});
