import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { TrackingPingModel } from "../models/TrackingPing.js";
import { protectedProcedure, router } from "../trpc.js";

/**
 * Haversine formula: returns distance in kilometres between two lat/lng points.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

export const trackingRouter = router({
  /**
   * mutation: ping
   */
  ping: protectedProcedure
    .input(
      z.object({
        draftId: z.string(),
        lat: z.number(),
        lng: z.number(),
        speedKmh: z.number().nonnegative().default(40),
        destinationLat: z.number(),
        destinationLng: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const { draftId, lat, lng, speedKmh, destinationLat, destinationLng } =
        input;

      const distanceKm = haversineKm(lat, lng, destinationLat, destinationLng);
      const effectiveSpeed = Math.max(speedKmh, 1);
      const etaMinutes = (distanceKm / effectiveSpeed) * 60;

      const ping = await TrackingPingModel.create({
        userId,
        draftId,
        lat,
        lng,
        speedKmh,
        destinationLat,
        destinationLng,
        distanceKm,
        etaMinutes,
        createdAt: new Date(),
      });

      await writeAudit(
        userId,
        draftId,
        "tracking-ping",
        `Tracking ping: ${distanceKm.toFixed(1)} km to destination`,
        {
          lat,
          lng,
          distanceKm,
          etaMinutes,
          pingId: String(ping._id),
        },
      );

      return ping;
    }),

  /**
   * query: latest
   */
  latest: protectedProcedure
    .input(z.object({ draftId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireUserId(ctx);
      const ping = await TrackingPingModel.findOne({ draftId: input.draftId })
        .sort({ createdAt: -1 })
        .lean();

      if (!ping) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No tracking pings found for draftId: ${input.draftId}`,
        });
      }

      return ping;
    }),

  /**
   * query: history
   */
  history: protectedProcedure
    .input(
      z.object({
        draftId: z.string(),
        limit: z.number().int().positive().max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireUserId(ctx);
      const pings = await TrackingPingModel.find({ draftId: input.draftId })
        .sort({ createdAt: -1 })
        .limit(input.limit)
        .lean();

      return pings.reverse();
    }),
});
