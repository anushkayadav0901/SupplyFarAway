import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const auditEventSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    draftId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    summary: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { strict: false }
);

// Hot path: audit.recent / insights.operationsTicker list per-user, newest first.
auditEventSchema.index({ userId: 1, createdAt: -1 });
// Hot path: audit.forDraft list per-user-and-draft, oldest first.
auditEventSchema.index({ userId: 1, draftId: 1, createdAt: 1 });

export type AuditEventDocument = InferSchemaType<typeof auditEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditEventModel: Model<AuditEventDocument> =
  (mongoose.models.AuditEvent as Model<AuditEventDocument>) ||
  mongoose.model<AuditEventDocument>("AuditEvent", auditEventSchema);

export default AuditEventModel;
