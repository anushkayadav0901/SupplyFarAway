import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";
import { TrackingPingModel } from "../models/TrackingPing.js";

/**
 * Haversine formula: returns distance in kilometres between two lat/lng points.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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

export const trackingRouter = router({
  /**
   * mutation: ping
   * Driver posts a geolocation update. Computes distance + ETA and persists.
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const { draftId, lat, lng, speedKmh, destinationLat, destinationLng } =
        input;

      const distanceKm = haversineKm(lat, lng, destinationLat, destinationLng);
      const effectiveSpeed = Math.max(speedKmh, 1);
      const etaMinutes = (distanceKm / effectiveSpeed) * 60;

      const ping = await TrackingPingModel.create({
        userId: new mongoose.Types.ObjectId(userId as string),
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

      return ping;
    }),

  /**
   * query: latest
   * Returns the most recent TrackingPing for the given draftId.
   */
  latest: protectedProcedure
    .input(z.object({ draftId: z.string() }))
    .query(async ({ input }) => {
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
   * Returns the last N TrackingPing docs for draftId, oldest first.
   */
  history: protectedProcedure
    .input(
      z.object({
        draftId: z.string(),
        limit: z.number().int().positive().max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const pings = await TrackingPingModel.find({ draftId: input.draftId })
        .sort({ createdAt: -1 })
        .limit(input.limit)
        .lean();

      // Reverse so oldest is first
      return pings.reverse();
    }),
});
