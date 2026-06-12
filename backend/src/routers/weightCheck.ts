import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AnomalyReportModel } from "../models/AnomalyReport.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { WeightCheckModel } from "../models/WeightCheck.js";
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

export const weightCheckRouter = router({
  /**
   * POST → weightCheck.submit
   */
  submit: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        declaredWeightKg: z.number().positive(),
        measuredWeightKg: z.number().nonnegative(),
        thresholdPct: z.number().nonnegative().default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const { draftId, declaredWeightKg, measuredWeightKg, thresholdPct } = input;

      const deviationKg = measuredWeightKg - declaredWeightKg;
      const deviationPct = (Math.abs(deviationKg) / declaredWeightKg) * 100;
      const flagged = deviationPct > thresholdPct;

      const doc = await WeightCheckModel.create({
        userId,
        ...(draftId ? { draftId } : {}),
        declaredWeightKg,
        measuredWeightKg,
        deviationKg,
        deviationPct,
        thresholdPct,
        flagged,
      });

      await writeAudit(
        userId,
        draftId,
        "weight-check-submit",
        `Weight check: declared ${declaredWeightKg}kg, measured ${measuredWeightKg}kg (deviation ${deviationPct.toFixed(1)}%)`,
        {
          declaredWeightKg,
          measuredWeightKg,
          deviationPct,
          flagged,
          resultId: String(doc._id),
        },
      );

      // Cross-feature linkage: emit AnomalyReport when flagged AND deviationPct > 15.
      if (flagged && deviationPct > 15) {
        try {
          await AnomalyReportModel.create({
            userId,
            draftId,
            declaredWeightKg,
            measuredWeightKg,
            declaredCount: 0,
            detectedCount: 0,
            originCity: "n/a",
            destinationCity: "n/a",
            routeDeviationKm: 0,
            flags: ["weight-mismatch"],
            severity: deviationPct > 30 ? "high" : "medium",
            riskScore: Math.min(100, Math.round(deviationPct * 2)),
            summary: `Weight mismatch: declared ${declaredWeightKg}kg vs measured ${measuredWeightKg}kg (${deviationPct.toFixed(1)}% deviation).`,
            createdAt: new Date(),
          });
        } catch (err) {
          console.error(
            "[weightCheck.submit] anomaly emit failed:",
            (err as Error)?.message,
          );
        }
      }

      return doc;
    }),

  /**
   * GET → weightCheck.history
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const records = await WeightCheckModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return records;
    }),
});
