import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";

// ---------------------------------------------------------------------------
// Graceful model accessor — returns the Mongoose model if it has been
// registered (by another agent), otherwise returns null so missing models
// don't break this router at startup or compile time.
// ---------------------------------------------------------------------------

function getModel(name: string): mongoose.Model<mongoose.Document> | null {
  try {
    return mongoose.model(name) as mongoose.Model<mongoose.Document>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types for aggregated recent events
// ---------------------------------------------------------------------------

interface RecentEvent {
  type: string;
  riskScore: number;
  createdAt: Date;
  summary: string;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const fraudRouter = router({
  /**
   * fraud.summary — aggregated risk metrics for the current user.
   *
   * Reads five models created by other agents:
   *   BoxCountResult, ShipmentDiff, RfidScanResult, WeightCheck, AnomalyReport
   *
   * Missing models are silently skipped and contribute zeros to the totals.
   */
  summary: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID not found in token",
        });
      }

      const recentEvents: RecentEvent[] = [];

      // ---------------------------------------------------------------
      // 1. BoxCountResult — count mismatches where expected !== actual
      // ---------------------------------------------------------------
      let boxCountMismatches = 0;
      const BoxCountResult = getModel("BoxCountResult");
      if (BoxCountResult) {
        try {
          boxCountMismatches = await BoxCountResult.countDocuments({
            userId,
            mismatch: true,
          });

          // Fallback: if no mismatch field, count where expectedCount !== actualCount
          if (boxCountMismatches === 0) {
            const pipeline = [
              { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
              {
                $match: {
                  $expr: { $ne: ["$expectedCount", "$actualCount"] },
                },
              },
              { $count: "total" },
            ];
            const result = await BoxCountResult.aggregate(pipeline);
            boxCountMismatches = result[0]?.total ?? 0;
          }

          const recentBoxEvents = await BoxCountResult.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

          for (const doc of recentBoxEvents) {
            const d = doc as Record<string, unknown>;
            recentEvents.push({
              type: "BoxCount",
              riskScore:
                typeof d.riskScore === "number"
                  ? d.riskScore
                  : d.mismatch
                  ? 0.7
                  : 0.1,
              createdAt:
                d.createdAt instanceof Date
                  ? d.createdAt
                  : new Date(String(d.createdAt ?? Date.now())),
              summary:
                typeof d.summary === "string"
                  ? d.summary
                  : `Box count check: expected ${d.expectedCount ?? "?"}, got ${d.actualCount ?? "?"}`,
            });
          }
        } catch {
          // model exists but query failed — skip gracefully
        }
      }

      // ---------------------------------------------------------------
      // 2. ShipmentDiff — average damage risk score
      // ---------------------------------------------------------------
      let avgDamageRiskScore = 0;
      const ShipmentDiff = getModel("ShipmentDiff");
      if (ShipmentDiff) {
        try {
          const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
            {
              $group: {
                _id: null,
                avg: { $avg: "$damageRiskScore" },
              },
            },
          ];
          const result = await ShipmentDiff.aggregate(pipeline);
          avgDamageRiskScore = result[0]?.avg ?? 0;

          const recentDiffEvents = await ShipmentDiff.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

          for (const doc of recentDiffEvents) {
            const d = doc as Record<string, unknown>;
            recentEvents.push({
              type: "ShipmentDiff",
              riskScore:
                typeof d.damageRiskScore === "number"
                  ? d.damageRiskScore
                  : typeof d.riskScore === "number"
                  ? d.riskScore
                  : 0.5,
              createdAt:
                d.createdAt instanceof Date
                  ? d.createdAt
                  : new Date(String(d.createdAt ?? Date.now())),
              summary:
                typeof d.summary === "string"
                  ? d.summary
                  : `Shipment diff detected for shipment ${d.shipmentId ?? d._id ?? "unknown"}`,
            });
          }
        } catch {
          // skip
        }
      }

      // ---------------------------------------------------------------
      // 3. RfidScanResult — total missing RFID tags
      // ---------------------------------------------------------------
      let totalRfidMissing = 0;
      const RfidScanResult = getModel("RfidScanResult");
      if (RfidScanResult) {
        try {
          const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
            {
              $group: {
                _id: null,
                total: { $sum: "$missingCount" },
              },
            },
          ];
          const result = await RfidScanResult.aggregate(pipeline);
          totalRfidMissing = result[0]?.total ?? 0;

          // Fallback: count documents where status === 'missing'
          if (totalRfidMissing === 0) {
            totalRfidMissing = await RfidScanResult.countDocuments({
              userId,
              status: "missing",
            });
          }

          const recentRfidEvents = await RfidScanResult.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

          for (const doc of recentRfidEvents) {
            const d = doc as Record<string, unknown>;
            recentEvents.push({
              type: "RfidScan",
              riskScore:
                typeof d.riskScore === "number"
                  ? d.riskScore
                  : (d.missingCount as number) > 0
                  ? 0.8
                  : 0.1,
              createdAt:
                d.createdAt instanceof Date
                  ? d.createdAt
                  : new Date(String(d.createdAt ?? Date.now())),
              summary:
                typeof d.summary === "string"
                  ? d.summary
                  : `RFID scan: ${d.missingCount ?? 0} missing tag(s)`,
            });
          }
        } catch {
          // skip
        }
      }

      // ---------------------------------------------------------------
      // 4. WeightCheck — count flagged weight discrepancies
      // ---------------------------------------------------------------
      let weightFlagged = 0;
      const WeightCheck = getModel("WeightCheck");
      if (WeightCheck) {
        try {
          weightFlagged = await WeightCheck.countDocuments({
            userId,
            flagged: true,
          });

          // Fallback: count where status === 'flagged'
          if (weightFlagged === 0) {
            weightFlagged = await WeightCheck.countDocuments({
              userId,
              status: "flagged",
            });
          }

          const recentWeightEvents = await WeightCheck.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

          for (const doc of recentWeightEvents) {
            const d = doc as Record<string, unknown>;
            recentEvents.push({
              type: "WeightCheck",
              riskScore:
                typeof d.riskScore === "number"
                  ? d.riskScore
                  : d.flagged
                  ? 0.75
                  : 0.15,
              createdAt:
                d.createdAt instanceof Date
                  ? d.createdAt
                  : new Date(String(d.createdAt ?? Date.now())),
              summary:
                typeof d.summary === "string"
                  ? d.summary
                  : `Weight check: declared ${d.declaredWeight ?? "?"}kg, actual ${d.actualWeight ?? "?"}kg`,
            });
          }
        } catch {
          // skip
        }
      }

      // ---------------------------------------------------------------
      // 5. AnomalyReport — count high-severity anomalies
      // ---------------------------------------------------------------
      let anomalyHighSeverity = 0;
      const AnomalyReport = getModel("AnomalyReport");
      if (AnomalyReport) {
        try {
          anomalyHighSeverity = await AnomalyReport.countDocuments({
            userId,
            severity: "high",
          });

          // Fallback: also try 'critical'
          if (anomalyHighSeverity === 0) {
            anomalyHighSeverity = await AnomalyReport.countDocuments({
              userId,
              $or: [{ severity: "high" }, { severity: "critical" }],
            });
          }

          const recentAnomalyEvents = await AnomalyReport.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

          for (const doc of recentAnomalyEvents) {
            const d = doc as Record<string, unknown>;
            recentEvents.push({
              type: "Anomaly",
              riskScore:
                typeof d.riskScore === "number"
                  ? d.riskScore
                  : d.severity === "high" || d.severity === "critical"
                  ? 0.9
                  : d.severity === "medium"
                  ? 0.55
                  : 0.2,
              createdAt:
                d.createdAt instanceof Date
                  ? d.createdAt
                  : new Date(String(d.createdAt ?? Date.now())),
              summary:
                typeof d.summary === "string"
                  ? d.summary
                  : typeof d.description === "string"
                  ? d.description
                  : `Anomaly detected — severity: ${d.severity ?? "unknown"}`,
            });
          }
        } catch {
          // skip
        }
      }

      // ---------------------------------------------------------------
      // Sort recent events by createdAt desc and cap at 20
      // ---------------------------------------------------------------
      const sortedRecentEvents = recentEvents
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20);

      return {
        boxCountMismatches,
        avgDamageRiskScore: Number(avgDamageRiskScore.toFixed(3)),
        totalRfidMissing,
        weightFlagged,
        anomalyHighSeverity,
        recentEvents: sortedRecentEvents,
      };
    }),
});
