import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const shipmentDiffSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  draftId: {
    type: String,
    required: false,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  tamperingProbability: {
    type: Number,
    required: true,
  },
  missingItems: {
    type: [String],
    default: [],
  },
  damageDescription: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export type ShipmentDiffDocument = InferSchemaType<typeof shipmentDiffSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ShipmentDiffModel: Model<ShipmentDiffDocument> =
  (mongoose.models.ShipmentDiff as Model<ShipmentDiffDocument>) ||
  mongoose.model<ShipmentDiffDocument>("ShipmentDiff", shipmentDiffSchema);

export default ShipmentDiffModel;
