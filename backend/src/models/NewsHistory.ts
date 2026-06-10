import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const newsHistorySchema = new Schema({
  date: {
    type: String,
    required: true,
    index: true,
  },
  query: {
    type: String,
    required: true,
    default: "default",
  },
  articles: [
    {
      title: { type: String, default: "No title available" },
      link: { type: String, default: "#" },
      summary: { type: String, default: "No summary available" },
      date: { type: String, default: () => new Date().toISOString() },
      source: { type: String, default: "Unknown" },
    },
  ],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

newsHistorySchema.index({ date: 1, query: 1 });

export type NewsHistoryDocument = InferSchemaType<typeof newsHistorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const NewsHistoryModel: Model<NewsHistoryDocument> =
  (mongoose.models.NewsHistory as Model<NewsHistoryDocument>) ||
  mongoose.model<NewsHistoryDocument>("NewsHistory", newsHistorySchema);

export default NewsHistoryModel;
