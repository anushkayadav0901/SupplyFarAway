import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";
import { WeightCheckModel } from "../models/WeightCheck.js";

export const weightCheckRouter = router({
  /**
   * POST → weightCheck.submit
   * Compares measured load-sensor weight against declared shipment weight.
   * Flags deviations beyond the configured threshold.
   */
  submit: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        declaredWeightKg: z.number().positive(),
        measuredWeightKg: z.number().nonnegative(),
        thresholdPct: z.number().nonnegative().default(5),
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

      const { draftId, declaredWeightKg, measuredWeightKg, thresholdPct } = input;

      const deviationKg = measuredWeightKg - declaredWeightKg;
      const deviationPct = (Math.abs(deviationKg) / declaredWeightKg) * 100;
      const flagged = deviationPct > thresholdPct;

      const doc = await WeightCheckModel.create({
        userId: new mongoose.Types.ObjectId(String(userId)),
        ...(draftId ? { draftId } : {}),
        declaredWeightKg,
        measuredWeightKg,
        deviationKg,
        deviationPct,
        thresholdPct,
        flagged,
      });

      return doc;
    }),

  /**
   * GET → weightCheck.history
   * Returns the last N weight-check records for the authenticated user.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const records = await WeightCheckModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return records;
    }),
});
