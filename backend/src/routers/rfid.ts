import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { AnomalyReportModel } from "../models/AnomalyReport.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { RfidScanResultModel } from "../models/RfidScanResult.js";
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const { draftId, manifestTags, scannedTags } = input;

      const normalizeTag = (t: string) => t.trim().toLowerCase();

      const normalizedManifest = manifestTags.map(normalizeTag);
      const normalizedScanned = scannedTags.map(normalizeTag);

      const manifestSet = new Set(normalizedManifest);
      const scannedSet = new Set(normalizedScanned);

      const matched = manifestTags.filter((t) =>
        scannedSet.has(normalizeTag(t)),
      );
      const missing = manifestTags.filter(
        (t) => !scannedSet.has(normalizeTag(t)),
      );
      const extra = scannedTags.filter(
        (t) => !manifestSet.has(normalizeTag(t)),
      );

      const matchPct =
        manifestTags.length > 0
          ? (matched.length / manifestTags.length) * 100
          : 0;

      const doc = await RfidScanResultModel.create({
        userId,
        ...(draftId ? { draftId } : {}),
        manifestTags,
        scannedTags,
        matched,
        missing,
        extra,
        matchPct,
        createdAt: new Date(),
      });

      await writeAudit(
        userId,
        draftId,
        "rfid-verify",
        `RFID scan: ${matched.length}/${manifestTags.length} matched (${matchPct.toFixed(1)}%)`,
        {
          matchPct,
          missingCount: missing.length,
          extraCount: extra.length,
          resultId: String(doc._id),
        },
      );

      // Cross-feature linkage: emit AnomalyReport when match rate is low.
      if (matchPct < 80) {
        try {
          await AnomalyReportModel.create({
            userId,
            draftId,
            declaredWeightKg: 0,
            measuredWeightKg: 0,
            declaredCount: manifestTags.length,
            detectedCount: matched.length,
            originCity: "n/a",
            destinationCity: "n/a",
            routeDeviationKm: 0,
            flags: ["rfid-shortfall"],
            severity: matchPct < 50 ? "high" : "medium",
            riskScore: Math.min(100, Math.round(100 - matchPct)),
            summary: `RFID scan shortfall: ${matchPct.toFixed(1)}% matched (${missing.length} missing tags).`,
            createdAt: new Date(),
          });
        } catch (err) {
          console.error("[rfid.verify] anomaly emit failed:", (err as Error)?.message);
        }
      }

      return doc;
    }),

  /**
   * GET rfid.history
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const results = await RfidScanResultModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return results;
    }),
});
