import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { protectedProcedure, router } from "../trpc.js";

export const auditRouter = router({
  /**
   * Append a new verification event to the audit log for a shipment draft.
   */
  append: protectedProcedure
    .input(
      z.object({
        draftId: z.string(),
        eventType: z.string().min(1),
        payload: z.record(z.string(), z.unknown()).optional(),
        summary: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const event = await AuditEventModel.create({
        userId,
        draftId: input.draftId,
        eventType: input.eventType,
        payload: input.payload ?? {},
        summary: input.summary,
        createdAt: new Date(),
      });

      return event;
    }),

  /**
   * Return all audit events for a given draft, oldest first.
   */
  forDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireUserId(ctx);
      const events = await AuditEventModel.find({ draftId: input.draftId }).sort(
        { createdAt: 1 },
      );
      return events;
    }),

  /**
   * Return the most recent N audit events for the authenticated user.
   */
  recent: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const events = await AuditEventModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return events;
    }),
});
