import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { protectedProcedure, router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_PAYLOAD_BYTES = 4096; // 4 KB — prevent log bloat
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_SUMMARY_LENGTH = 500;
const MAX_DRAFT_ID_LENGTH = 100;

export const auditRouter = router({
  /**
   * Append a new verification event to the audit log for a shipment draft.
   */
  append: protectedProcedure
    .input(
      z.object({
        draftId: z.string().min(1).max(MAX_DRAFT_ID_LENGTH),
        eventType: z.string().min(1).max(MAX_EVENT_TYPE_LENGTH),
        payload: z.record(z.string(), z.unknown()).optional(),
        summary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const payloadToStore = input.payload ?? {};

      // H7 / extra directive: cap payload size to prevent log bloat
      const serialized = JSON.stringify(payloadToStore);
      if (serialized.length > MAX_PAYLOAD_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Audit payload exceeds maximum allowed size of ${MAX_PAYLOAD_BYTES} bytes`,
        });
      }

      const event = await AuditEventModel.create({
        userId,
        draftId: input.draftId,
        eventType: input.eventType,
        payload: payloadToStore,
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
