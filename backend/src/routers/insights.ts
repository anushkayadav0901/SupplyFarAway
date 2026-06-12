import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";

import { router, protectedProcedure } from "../trpc.js";
import { requireUserId, assertObjectId } from "../lib/auth.js";
import { DraftModel } from "../models/Draft.js";
import { BoxCountResultModel } from "../models/BoxCountResult.js";
import { ShipmentDiffModel } from "../models/ShipmentDiff.js";
import { RfidScanResultModel } from "../models/RfidScanResult.js";
import { WeightCheckModel } from "../models/WeightCheck.js";
import { AnomalyReportModel } from "../models/AnomalyReport.js";
import { AuditEventModel } from "../models/AuditEvent.js";
import { TrackingPingModel } from "../models/TrackingPing.js";
import { ComplianceRecordModel } from "../models/ComplianceRecord.js";
import { LoadOfferModel } from "../models/LoadOffer.js";
import { TruckModel } from "../models/Truck.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Subsystem =
  | "boxCount"
  | "shipmentDiff"
  | "rfid"
  | "weight"
  | "anomaly"
  | "compliance";

interface SubsystemBreakdown {
  score: number;
  weight: number;
  latestAt: Date | null;
  note: string;
}

interface ActivityItem {
  id: string;
  type:
    | "box-count"
    | "shipment-diff"
    | "rfid"
    | "weight"
    | "anomaly"
    | "audit"
    | "tracking"
    | "load"
    | "truck"
    | "compliance";
  timestamp: string;
  summary: string;
  severity?: "low" | "medium" | "high";
  draftId?: string;
  icon: string;
}

const SUBSYSTEM_WEIGHTS: Record<Subsystem, number> = {
  boxCount: 1.0,
  shipmentDiff: 1.2,
  rfid: 1.0,
  weight: 0.8,
  anomaly: 1.3,
  compliance: 0.9,
};

const NEUTRAL_SCORE = 70;
const NEUTRAL_WEIGHT = 0.5;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const insightsRouter = router({
  /**
   * Aggregate trust score for a single draft, weighting verification
   * subsystems and returning a per-system breakdown.
   */
  shipmentTrustScore: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const { draftId } = input;

      const [latestBox, latestDiff, latestRfid, latestWeight, latestAnomaly] =
        await Promise.all([
          BoxCountResultModel.findOne({ userId, draftId })
            .sort({ createdAt: -1 })
            .lean(),
          ShipmentDiffModel.findOne({ userId, draftId })
            .sort({ createdAt: -1 })
            .lean(),
          RfidScanResultModel.findOne({ userId, draftId })
            .sort({ createdAt: -1 })
            .lean(),
          WeightCheckModel.findOne({ userId, draftId })
            .sort({ createdAt: -1 })
            .lean(),
          AnomalyReportModel.findOne({ userId, draftId })
            .sort({ createdAt: -1 })
            .lean(),
        ]);

      // Compliance is linked via draft (no direct draftId on ComplianceRecord).
      let latestCompliance: Record<string, unknown> | null = null;
      if (mongoose.Types.ObjectId.isValid(draftId)) {
        const draft = await DraftModel.findOne({ _id: draftId, userId }).lean();
        if (draft) {
          const draftCompliance =
            (draft as unknown as Record<string, unknown>).complianceData;
          if (
            draftCompliance &&
            typeof draftCompliance === "object" &&
            Object.keys(draftCompliance).length > 0
          ) {
            latestCompliance = draftCompliance as Record<string, unknown>;
          }
        }
      }

      // ----- per-subsystem score helpers -----
      const breakdown: Record<Subsystem, SubsystemBreakdown> = {
        boxCount: scoreBoxCount(latestBox),
        shipmentDiff: scoreShipmentDiff(latestDiff),
        rfid: scoreRfid(latestRfid),
        weight: scoreWeight(latestWeight),
        anomaly: scoreAnomaly(latestAnomaly),
        compliance: scoreCompliance(latestCompliance),
      };

      // Weighted average
      let totalWeighted = 0;
      let totalWeight = 0;
      const signals: Array<{ type: string; value: number; contribution: number }> = [];
      for (const key of Object.keys(breakdown) as Subsystem[]) {
        const b = breakdown[key];
        totalWeighted += b.score * b.weight;
        totalWeight += b.weight;
        signals.push({
          type: key,
          value: b.score,
          contribution: Math.round(b.score * b.weight * 100) / 100,
        });
      }
      signals.sort((a, b) => b.contribution - a.contribution);

      const score = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 0;
      const verdict: "trusted" | "watch" | "high-risk" =
        score >= 80 ? "trusted" : score >= 60 ? "watch" : "high-risk";

      return {
        score,
        verdict,
        breakdown,
        signals,
      };
    }),

  /**
   * Returns a unified, time-sorted list of activity across all verification
   * subsystems. Optional draftId restricts to a single shipment.
   */
  recentActivity: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(25),
        draftId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const { limit, draftId } = input;

      const baseFilter: Record<string, unknown> = { userId };
      if (draftId) baseFilter.draftId = draftId;

      const [boxes, diffs, rfids, weights, anomalies, audits, pings, loads, trucks] =
        await Promise.all([
          BoxCountResultModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
          ShipmentDiffModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
          RfidScanResultModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
          WeightCheckModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
          AnomalyReportModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
          AuditEventModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
          draftId
            ? TrackingPingModel.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean()
            : Promise.resolve([]),
          draftId
            ? Promise.resolve([])
            : LoadOfferModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
          draftId
            ? Promise.resolve([])
            : TruckModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
        ]);

      const items: ActivityItem[] = [];

      for (const b of boxes) {
        const created = (b as Record<string, unknown>).createdAt as Date | undefined;
        items.push({
          id: String((b as Record<string, unknown>)._id ?? ""),
          type: "box-count",
          timestamp: (created ?? new Date()).toISOString(),
          summary: `Box count: declared ${(b as Record<string, unknown>).declaredCount}, detected ${(b as Record<string, unknown>).detectedCount}`,
          severity:
            ((b as Record<string, unknown>).mismatchPct as number) > 20
              ? "high"
              : ((b as Record<string, unknown>).mismatchPct as number) > 5
                ? "medium"
                : "low",
          draftId: ((b as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "package",
        });
      }
      for (const d of diffs) {
        const created = (d as Record<string, unknown>).createdAt as Date | undefined;
        const risk = ((d as Record<string, unknown>).riskScore as number) ?? 0;
        items.push({
          id: String((d as Record<string, unknown>)._id ?? ""),
          type: "shipment-diff",
          timestamp: (created ?? new Date()).toISOString(),
          summary:
            (((d as Record<string, unknown>).summary as string) ??
              `Shipment diff (risk ${risk})`).slice(0, 220),
          severity: risk > 70 ? "high" : risk > 40 ? "medium" : "low",
          draftId: ((d as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "scan",
        });
      }
      for (const r of rfids) {
        const created = (r as Record<string, unknown>).createdAt as Date | undefined;
        const matchPct = ((r as Record<string, unknown>).matchPct as number) ?? 0;
        items.push({
          id: String((r as Record<string, unknown>)._id ?? ""),
          type: "rfid",
          timestamp: (created ?? new Date()).toISOString(),
          summary: `RFID match ${matchPct.toFixed(1)}%`,
          severity: matchPct < 80 ? "high" : matchPct < 95 ? "medium" : "low",
          draftId: ((r as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "tag",
        });
      }
      for (const w of weights) {
        const created = (w as Record<string, unknown>).createdAt as Date | undefined;
        const dev = ((w as Record<string, unknown>).deviationPct as number) ?? 0;
        const flagged = Boolean((w as Record<string, unknown>).flagged);
        items.push({
          id: String((w as Record<string, unknown>)._id ?? ""),
          type: "weight",
          timestamp: (created ?? new Date()).toISOString(),
          summary: `Weight deviation ${dev.toFixed(1)}%${flagged ? " (flagged)" : ""}`,
          severity: flagged && dev > 15 ? "high" : flagged ? "medium" : "low",
          draftId: ((w as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "scale",
        });
      }
      for (const a of anomalies) {
        const created = (a as Record<string, unknown>).createdAt as Date | undefined;
        const sev = ((a as Record<string, unknown>).severity as
          | "low"
          | "medium"
          | "high"
          | undefined) ?? "low";
        items.push({
          id: String((a as Record<string, unknown>)._id ?? ""),
          type: "anomaly",
          timestamp: (created ?? new Date()).toISOString(),
          summary:
            (((a as Record<string, unknown>).summary as string) ?? "Anomaly report").slice(
              0,
              220
            ),
          severity: sev,
          draftId: ((a as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "alert",
        });
      }
      for (const ev of audits) {
        const created = (ev as Record<string, unknown>).createdAt as Date | undefined;
        items.push({
          id: String((ev as Record<string, unknown>)._id ?? ""),
          type: "audit",
          timestamp: (created ?? new Date()).toISOString(),
          summary:
            (((ev as Record<string, unknown>).summary as string) ??
              ((ev as Record<string, unknown>).eventType as string) ??
              "Audit event").slice(0, 220),
          severity: "low",
          draftId: ((ev as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "audit",
        });
      }
      for (const p of pings) {
        const created = (p as Record<string, unknown>).createdAt as Date | undefined;
        items.push({
          id: String((p as Record<string, unknown>)._id ?? ""),
          type: "tracking",
          timestamp: (created ?? new Date()).toISOString(),
          summary: `Tracking ping (${Math.round(
            ((p as Record<string, unknown>).distanceKm as number) ?? 0
          )} km to destination)`,
          severity: "low",
          draftId: ((p as Record<string, unknown>).draftId as string | undefined) ?? undefined,
          icon: "map",
        });
      }
      for (const lo of loads) {
        const created = (lo as Record<string, unknown>).createdAt as Date | undefined;
        items.push({
          id: String((lo as Record<string, unknown>)._id ?? ""),
          type: "load",
          timestamp: (created ?? new Date()).toISOString(),
          summary: `Load offer ${(lo as Record<string, unknown>).originCity} → ${(lo as Record<string, unknown>).destinationCity}`,
          severity: "low",
          icon: "truck",
        });
      }
      for (const t of trucks) {
        const created = (t as Record<string, unknown>).createdAt as Date | undefined;
        items.push({
          id: String((t as Record<string, unknown>)._id ?? ""),
          type: "truck",
          timestamp: (created ?? new Date()).toISOString(),
          summary: `Truck ${(t as Record<string, unknown>).plate} registered`,
          severity: "low",
          icon: "truck",
        });
      }

      items.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return items.slice(0, limit);
    }),

  /**
   * Returns every linked artefact for a single draft — used by the
   * "Shipment dossier" UI so the frontend can render the full story with
   * one query.
   */
  draftBundle: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const { draftId } = input;

      if (!mongoose.Types.ObjectId.isValid(draftId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid draftId format",
        });
      }

      const [
        draft,
        boxCount,
        shipmentDiff,
        rfid,
        weight,
        anomaly,
        latestPing,
        audit,
      ] = await Promise.all([
        DraftModel.findOne({ _id: draftId, userId }).lean(),
        BoxCountResultModel.findOne({ userId, draftId })
          .sort({ createdAt: -1 })
          .lean(),
        ShipmentDiffModel.findOne({ userId, draftId })
          .sort({ createdAt: -1 })
          .lean(),
        RfidScanResultModel.findOne({ userId, draftId })
          .sort({ createdAt: -1 })
          .lean(),
        WeightCheckModel.findOne({ userId, draftId })
          .sort({ createdAt: -1 })
          .lean(),
        AnomalyReportModel.findOne({ userId, draftId })
          .sort({ createdAt: -1 })
          .lean(),
        TrackingPingModel.findOne({ userId, draftId })
          .sort({ createdAt: -1 })
          .lean(),
        AuditEventModel.find({ userId, draftId })
          .sort({ createdAt: 1 })
          .lean(),
      ]);

      // Compliance is keyed off draft only (no draftId on ComplianceRecord);
      // for the bundle we return the most recent compliance record for the
      // user as a best-effort.
      let compliance: Record<string, unknown> | null = null;
      if (draft) {
        const recent = await ComplianceRecordModel.findOne({ userId })
          .sort({ timestamp: -1 })
          .lean();
        compliance = (recent as Record<string, unknown> | null) ?? null;
      }

      return {
        draft: draft ?? null,
        boxCount: boxCount ?? null,
        shipmentDiff: shipmentDiff ?? null,
        rfid: rfid ?? null,
        weight: weight ?? null,
        anomaly: anomaly ?? null,
        latestPing: latestPing ?? null,
        audit: audit ?? [],
        compliance,
      };
    }),

  /**
   * Live operations ticker — counts and rolling averages displayed in the
   * dashboard hero strip.
   */
  operationsTicker: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const userId = requireUserId(ctx);

      const now = Date.now();
      const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000);

      const [
        activeShipments,
        openLoads,
        registeredTrucks,
        highRiskEventsLast24h,
        drafts,
        recentTicks,
      ] = await Promise.all([
        DraftModel.countDocuments({ userId }),
        LoadOfferModel.countDocuments({ userId, status: "open" }),
        TruckModel.countDocuments({ userId }),
        AnomalyReportModel.countDocuments({
          userId,
          severity: "high",
          createdAt: { $gte: twentyFourHoursAgo },
        }),
        DraftModel.find({ userId }).select({ _id: 1 }).lean(),
        AuditEventModel.find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      const draftIds = drafts.map((d) => String((d as Record<string, unknown>)._id));

      const avgTrustScore = await computeAvgTrustScore(userId, draftIds, undefined);
      const avgTrustScore24hAgo = await computeAvgTrustScore(
        userId,
        draftIds,
        fortyEightHoursAgo,
      );

      const ticks = recentTicks.map((ev) => {
        const created = (ev as Record<string, unknown>).createdAt as Date | undefined;
        return {
          type: ((ev as Record<string, unknown>).eventType as string) ?? "audit",
          summary:
            (((ev as Record<string, unknown>).summary as string) ?? "Event").slice(0, 200),
          ts: (created ?? new Date()).toISOString(),
          severity: "low" as const,
        };
      });

      return {
        activeShipments,
        openLoads,
        registeredTrucks,
        highRiskEventsLast24h,
        avgTrustScore: Math.round(avgTrustScore),
        avgTrustScoreDelta:
          Math.round(avgTrustScore) - Math.round(avgTrustScore24hAgo),
        recentTicks: ticks,
      };
    }),
});

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreBoxCount(doc: Record<string, unknown> | null): SubsystemBreakdown {
  if (!doc) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "No box count check on record",
    };
  }
  const mismatchPct = Number(doc.mismatchPct ?? 0);
  const score = Math.max(0, 100 - Math.min(100, mismatchPct * 2));
  return {
    score,
    weight: SUBSYSTEM_WEIGHTS.boxCount,
    latestAt: (doc.createdAt as Date | undefined) ?? null,
    note: `Mismatch ${mismatchPct.toFixed(1)}% (declared ${doc.declaredCount}, detected ${doc.detectedCount})`,
  };
}

function scoreShipmentDiff(
  doc: Record<string, unknown> | null,
): SubsystemBreakdown {
  if (!doc) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "No before/after diff on record",
    };
  }
  const risk = Number(doc.riskScore ?? 0);
  const score = Math.max(0, 100 - risk);
  return {
    score,
    weight: SUBSYSTEM_WEIGHTS.shipmentDiff,
    latestAt: (doc.createdAt as Date | undefined) ?? null,
    note: `Risk ${risk} — ${(doc.summary as string | undefined)?.slice(0, 80) ?? ""}`,
  };
}

function scoreRfid(doc: Record<string, unknown> | null): SubsystemBreakdown {
  if (!doc) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "No RFID scan on record",
    };
  }
  const matchPct = Number(doc.matchPct ?? 0);
  return {
    score: Math.max(0, Math.min(100, matchPct)),
    weight: SUBSYSTEM_WEIGHTS.rfid,
    latestAt: (doc.createdAt as Date | undefined) ?? null,
    note: `Match ${matchPct.toFixed(1)}%`,
  };
}

function scoreWeight(doc: Record<string, unknown> | null): SubsystemBreakdown {
  if (!doc) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "No weight check on record",
    };
  }
  const flagged = Boolean(doc.flagged);
  const deviationPct = Number(doc.deviationPct ?? 0);
  const score = flagged ? Math.max(0, 100 - deviationPct * 5) : 100;
  return {
    score,
    weight: SUBSYSTEM_WEIGHTS.weight,
    latestAt: (doc.createdAt as Date | undefined) ?? null,
    note: flagged
      ? `Flagged — deviation ${deviationPct.toFixed(1)}%`
      : "Within tolerance",
  };
}

function scoreAnomaly(doc: Record<string, unknown> | null): SubsystemBreakdown {
  if (!doc) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "No anomaly check on record",
    };
  }
  const risk = Number(doc.riskScore ?? 0);
  const severity = (doc.severity as string | undefined) ?? "low";
  let score = Math.max(0, 100 - risk);
  if (severity === "high") {
    score = Math.max(0, score - 10);
  }
  return {
    score,
    weight: SUBSYSTEM_WEIGHTS.anomaly,
    latestAt: (doc.createdAt as Date | undefined) ?? null,
    note: `Severity ${severity}, risk ${risk}`,
  };
}

function scoreCompliance(
  doc: Record<string, unknown> | null,
): SubsystemBreakdown {
  if (!doc) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "No compliance data linked to draft",
    };
  }
  const riskLevel = doc.riskLevel as Record<string, unknown> | undefined;
  const riskScore =
    typeof doc.riskScore === "number"
      ? (doc.riskScore as number)
      : typeof riskLevel?.riskScore === "number"
        ? (riskLevel.riskScore as number)
        : null;
  if (riskScore === null) {
    return {
      score: NEUTRAL_SCORE,
      weight: NEUTRAL_WEIGHT,
      latestAt: null,
      note: "Compliance present but no risk score",
    };
  }
  return {
    score: Math.max(0, 100 - riskScore),
    weight: SUBSYSTEM_WEIGHTS.compliance,
    latestAt: null,
    note: `Compliance risk ${riskScore}`,
  };
}

// ---------------------------------------------------------------------------
// Avg trust score helper (used by operationsTicker)
// ---------------------------------------------------------------------------

async function computeAvgTrustScore(
  userId: mongoose.Types.ObjectId,
  draftIds: string[],
  asOf?: Date,
): Promise<number> {
  if (draftIds.length === 0) return 0;

  // Limit how many drafts we inspect — averaging is approximate.
  const sampled = draftIds.slice(0, 25);
  let total = 0;
  let counted = 0;
  for (const draftId of sampled) {
    try {
      const dateClause: Record<string, unknown> | undefined = asOf
        ? { createdAt: { $lte: asOf } }
        : undefined;
      const findFilter: Record<string, unknown> = { userId, draftId };
      if (dateClause) Object.assign(findFilter, dateClause);
      const [box, diff, rfid, weight, anomaly] = await Promise.all([
        BoxCountResultModel.findOne(findFilter).sort({ createdAt: -1 }).lean(),
        ShipmentDiffModel.findOne(findFilter).sort({ createdAt: -1 }).lean(),
        RfidScanResultModel.findOne(findFilter).sort({ createdAt: -1 }).lean(),
        WeightCheckModel.findOne(findFilter).sort({ createdAt: -1 }).lean(),
        AnomalyReportModel.findOne(findFilter).sort({ createdAt: -1 }).lean(),
      ]);
      const breakdown: SubsystemBreakdown[] = [
        scoreBoxCount(box as Record<string, unknown> | null),
        scoreShipmentDiff(diff as Record<string, unknown> | null),
        scoreRfid(rfid as Record<string, unknown> | null),
        scoreWeight(weight as Record<string, unknown> | null),
        scoreAnomaly(anomaly as Record<string, unknown> | null),
        scoreCompliance(null),
      ];
      let weighted = 0;
      let weightSum = 0;
      for (const b of breakdown) {
        weighted += b.score * b.weight;
        weightSum += b.weight;
      }
      if (weightSum > 0) {
        total += weighted / weightSum;
        counted += 1;
      }
    } catch {
      // swallow — averaging is best-effort
    }
  }
  return counted > 0 ? total / counted : 0;
}

// Re-export so non-call-sites can reference the helper if needed.
export { assertObjectId };
