import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const anomalyReportSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  draftId: {
    type: String,
    required: false,
    index: true,
  },
  declaredWeightKg: {
    type: Number,
    required: true,
  },
  measuredWeightKg: {
    type: Number,
    required: true,
  },
  declaredCount: {
    type: Number,
    required: true,
  },
  detectedCount: {
    type: Number,
    required: true,
  },
  originCity: {
    type: String,
    required: true,
  },
  destinationCity: {
    type: String,
    required: true,
  },
  routeDeviationKm: {
    type: Number,
    required: true,
    default: 0,
  },
  flags: {
    type: [String],
    default: [],
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high"],
    required: true,
  },
  riskScore: {
    type: Number,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Hot path: history list per-user, newest first.
anomalyReportSchema.index({ userId: 1, createdAt: -1 });
// Hot path: insights.operationsTicker + fraud.summary count
// high-severity events in the last 24h, scoped per user.
anomalyReportSchema.index({ userId: 1, severity: 1, createdAt: -1 });
// Hot path: shipmentTrustScore + draftBundle find latest by (userId, draftId).
anomalyReportSchema.index({ userId: 1, draftId: 1, createdAt: -1 });

export type AnomalyReportDocument = InferSchemaType<typeof anomalyReportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AnomalyReportModel: Model<AnomalyReportDocument> =
  (mongoose.models.AnomalyReport as Model<AnomalyReportDocument>) ||
  mongoose.model<AnomalyReportDocument>("AnomalyReport", anomalyReportSchema);

export default AnomalyReportModel;
