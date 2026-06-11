import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";
import { RfidScanResultModel } from "../models/RfidScanResult.js";

export const rfidRouter = router({
  /**
   * POST rfid.verify
   * Compares a manifest tag list against a scanned tag list and persists the result.
   */
  verify: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        manifestTags: z.array(z.string().min(1)).min(1),
        scannedTags: z.array(z.string().min(1)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid userId" });
      }

      const { draftId, manifestTags, scannedTags } = input;

      // Normalize all tags: trim + lowercase for comparison
      const normalizeTag = (t: string) => t.trim().toLowerCase();

      const normalizedManifest = manifestTags.map(normalizeTag);
      const normalizedScanned = scannedTags.map(normalizeTag);

      const manifestSet = new Set(normalizedManifest);
      const scannedSet = new Set(normalizedScanned);

      // matched: tags in both manifest and scanned (use original manifest casing)
      const matched = manifestTags.filter((t) =>
        scannedSet.has(normalizeTag(t))
      );

      // missing: tags in manifest but not in scanned (original manifest casing)
      const missing = manifestTags.filter(
        (t) => !scannedSet.has(normalizeTag(t))
      );

      // extra: tags in scanned but not in manifest (original scanned casing)
      const extra = scannedTags.filter(
        (t) => !manifestSet.has(normalizeTag(t))
      );

      const matchPct =
        manifestTags.length > 0
          ? (matched.length / manifestTags.length) * 100
          : 0;

      const doc = await RfidScanResultModel.create({
        userId: new mongoose.Types.ObjectId(String(userId)),
        ...(draftId ? { draftId } : {}),
        manifestTags,
        scannedTags,
        matched,
        missing,
        extra,
        matchPct,
        createdAt: new Date(),
      });

      return doc;
    }),

  /**
   * GET rfid.history
   * Returns the last N RFID scan results for the authenticated user.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid userId" });
      }

      const results = await RfidScanResultModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return results;
    }),
});
