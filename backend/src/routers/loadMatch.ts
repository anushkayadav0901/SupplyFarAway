import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";
import { LoadOfferModel } from "../models/LoadOffer.js";

export const loadMatchRouter = router({
  /**
   * Create a new load offer.
   */
  createOffer: protectedProcedure
    .input(
      z.object({
        originCity: z.string().min(1),
        destinationCity: z.string().min(1),
        weightKg: z.number().positive(),
        pickupDate: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const offer = await LoadOfferModel.create({
        userId: new mongoose.Types.ObjectId(userId as string),
        originCity: input.originCity,
        destinationCity: input.destinationCity,
        weightKg: input.weightKg,
        pickupDate: new Date(input.pickupDate),
        status: "open",
        notes: input.notes,
        createdAt: new Date(),
      });

      return { message: "Load offer created successfully", offer };
    }),

  /**
   * List all load offers belonging to the authenticated user, newest first.
   */
  listMine: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const offers = await LoadOfferModel.find({ userId }).sort({ createdAt: -1 });

      return { offers };
    }),

  /**
   * Find matching open load offers for a given offer.
   * Matches on overlapping route corridors and compatible pickup dates/weights.
   */
  findMatches: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!mongoose.Types.ObjectId.isValid(input.offerId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid offerId format" });
      }

      const offer = await LoadOfferModel.findOne({
        _id: input.offerId,
        userId,
      });

      if (!offer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found or not authorized" });
      }

      const pickupDate = new Date(offer.pickupDate);
      const minDate = new Date(pickupDate);
      minDate.setDate(minDate.getDate() - 2);
      const maxDate = new Date(pickupDate);
      maxDate.setDate(maxDate.getDate() + 2);

      const originLower = offer.originCity.toLowerCase();
      const destLower = offer.destinationCity.toLowerCase();

      // Find all open offers from other users within the date window
      const candidates = await LoadOfferModel.find({
        _id: { $ne: offer._id },
        userId: { $ne: userId },
        status: "open",
        pickupDate: { $gte: minDate, $lte: maxDate },
      });

      // Filter by route corridor match (case-insensitive substring either way) and weight
      const matches = candidates
        .filter((candidate) => {
          const candOriginLower = candidate.originCity.toLowerCase();
          const candDestLower = candidate.destinationCity.toLowerCase();

          const originMatch =
            originLower.includes(candOriginLower) ||
            candOriginLower.includes(originLower);

          const destMatch =
            destLower.includes(candDestLower) ||
            candDestLower.includes(destLower);

          const combinedWeight = offer.weightKg + candidate.weightKg;

          return originMatch && destMatch && combinedWeight <= 5000;
        })
        .map((candidate) => {
          const candOriginLower = candidate.originCity.toLowerCase();
          const candDestLower = candidate.destinationCity.toLowerCase();

          const exactOrigin = originLower === candOriginLower;
          const exactDest = destLower === candDestLower;

          const candidatePickup = new Date(candidate.pickupDate);
          const daysApart = Math.abs(
            (pickupDate.getTime() - candidatePickup.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          const similarityScore = Math.max(
            0,
            50 +
              (exactOrigin ? 25 : 0) +
              (exactDest ? 25 : 0) -
              Math.round(daysApart) * 10
          );

          return {
            ...candidate.toObject(),
            similarityScore,
          };
        })
        .sort((a, b) => b.similarityScore - a.similarityScore);

      return { matches };
    }),

  /**
   * Cancel a load offer owned by the authenticated user.
   */
  cancel: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!mongoose.Types.ObjectId.isValid(input.offerId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid offerId format" });
      }

      const updated = await LoadOfferModel.findOneAndUpdate(
        { _id: input.offerId, userId },
        { status: "cancelled" },
        { new: true }
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found or not authorized" });
      }

      return { message: "Offer cancelled successfully", offer: updated };
    }),
});
