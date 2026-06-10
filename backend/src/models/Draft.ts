import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const draftSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    formData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    complianceData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    routeData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    carbonAnalysisData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    productAnalysisData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { strict: false }
);

export type DraftDocument = InferSchemaType<typeof draftSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DraftModel: Model<DraftDocument> =
  (mongoose.models.Draft as Model<DraftDocument>) ||
  mongoose.model<DraftDocument>("Draft", draftSchema);

export default DraftModel;
