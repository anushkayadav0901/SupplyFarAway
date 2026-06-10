import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { DraftModel } from "../models/Draft.js";
import { NewsHistoryModel } from "../models/NewsHistory.js";

// ---------------------------------------------------------------------------
// Local input schemas (procedure-specific shapes)
// ---------------------------------------------------------------------------

const CreateDraftInputSchema = z.object({
  originCountry: z.string().min(1),
  destinationCountry: z.string().min(1),
  hsCode: z.string().min(1),
  productDescription: z.string().min(1),
  weight: z.number().positive(),
  perishable: z.boolean().optional(),
  hazardous: z.boolean().optional(),
});

const UpdateDraftInputSchema = z.object({
  id: z.string().min(1),
  // The legacy handler does Object.assign(draft, updateData), so accept any
  // extra fields via passthrough on a loose object — but we keep the known
  // typed fields for IDE discoverability.
  updateData: z.record(z.string(), z.unknown()),
});

const GetDraftsInputSchema = z.object({
  tab: z
    .enum([
      "yet-to-be-checked",
      "compliant",
      "non-compliant",
      "ready-for-shipment",
    ])
    .optional(),
});

const GetDraftsByUserInputSchema = z.object({
  userId: z.string().min(1),
  complianceStatus: z.string().optional(),
  routeOptimizationStatus: z.string().optional(),
});

const GetDraftByIdInputSchema = z.object({
  id: z.string().min(1),
});

const DeleteDraftInputSchema = z.object({
  id: z.string().min(1),
});

const GetNewsInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().min(1).max(4).default(1),
  searchMode: z.enum(["direct", "summarized"]).default("direct"),
});

const SummarizeArticleInputSchema = z.object({
  content: z.string().min(1),
  url: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function assertValidObjectId(id: string, label: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid ${label} format`,
    });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const inventoryRouter = router({
  // POST /api/drafts — create a new draft
  createDraft: protectedProcedure
    .input(CreateDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.user.id ?? ctx.user._id) as string;
      assertValidObjectId(userId, "userId");

      const validatedUserId = new mongoose.Types.ObjectId(userId);

      const draft = await DraftModel.create({
        userId: validatedUserId,
        formData: {
          ShipmentDetails: {
            "Origin Country": input.originCountry,
            "Destination Country": input.destinationCountry,
            "HS Code": input.hsCode,
            "Product Description": input.productDescription,
            "Gross Weight": input.weight,
          },
          TradeAndRegulatoryDetails: {
            Perishable: input.perishable,
            "Hazardous Material": input.hazardous,
          },
        },
        statuses: {
          compliance: "notDone",
          routeOptimization: "notDone",
        },
        timestamp: new Date(),
      });

      return {
        message: "Draft created successfully",
        recordId: draft._id,
      };
    }),

  // PUT /api/drafts/:id — update a draft
  updateDraft: protectedProcedure
    .input(UpdateDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.user.id ?? ctx.user._id) as string;
      assertValidObjectId(input.id, "draftId");
      assertValidObjectId(userId, "userId");

      const draft = await DraftModel.findOne({ _id: input.id, userId });
      if (!draft) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft not found or not authorized",
        });
      }

      Object.assign(draft, input.updateData);
      await draft.save();

      return {
        message: "Draft updated successfully",
        recordId: draft._id,
      };
    }),

  // GET /api/drafts?tab=... — list drafts with optional tab filter
  getDrafts: protectedProcedure
    .input(GetDraftsInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = (ctx.user.id ?? ctx.user._id) as string;
      assertValidObjectId(userId, "userId");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: Record<string, any> = { userId };

      if (input.tab) {
        switch (input.tab) {
          case "yet-to-be-checked":
            query.$or = [
              {
                "statuses.compliance": "notDone",
                "statuses.routeOptimization": "notDone",
              },
              {
                "statuses.compliance": "notDone",
                "statuses.routeOptimization": "done",
              },
            ];
            break;
          case "compliant":
            query["statuses.compliance"] = "compliant";
            query["statuses.routeOptimization"] = "notDone";
            break;
          case "non-compliant":
            query["statuses.compliance"] = "nonCompliant";
            query["statuses.routeOptimization"] = "notDone";
            break;
          case "ready-for-shipment":
            query["statuses.compliance"] = "compliant";
            query["statuses.routeOptimization"] = "done";
            break;
        }
      }

      const drafts = await DraftModel.find(query).sort({ timestamp: -1 });

      return {
        message: "Drafts retrieved successfully",
        drafts,
      };
    }),

  // GET /api/drafts/user/:userId — drafts by explicit userId with status filters
  getDraftsByUser: protectedProcedure
    .input(GetDraftsByUserInputSchema)
    .query(async ({ input }) => {
      assertValidObjectId(input.userId, "userId");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: Record<string, any> = { userId: input.userId };
      if (input.complianceStatus === "done")
        query["statuses.compliance"] = "compliant";
      if (input.routeOptimizationStatus === "done")
        query["statuses.routeOptimization"] = "done";

      const drafts = await DraftModel.find(query).sort({ timestamp: -1 });
      return { drafts };
    }),

  // GET /api/drafts/:id — single draft
  getDraftById: protectedProcedure
    .input(GetDraftByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = (ctx.user.id ?? ctx.user._id) as string;
      assertValidObjectId(input.id, "draftId");
      assertValidObjectId(userId, "userId");

      const draft = await DraftModel.findOne({ _id: input.id, userId });
      if (!draft) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft not found or not authorized",
        });
      }

      return {
        message: "Draft retrieved successfully",
        draft,
      };
    }),

  // DELETE /api/drafts/:id — delete a draft
  deleteDraft: protectedProcedure
    .input(DeleteDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.user.id ?? ctx.user._id) as string;
      assertValidObjectId(input.id, "draftId");
      assertValidObjectId(userId, "userId");

      const deletedDraft = await DraftModel.findOneAndDelete({
        _id: input.id,
        userId,
      });

      if (!deletedDraft) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft not found or not authorized",
        });
      }

      return { message: "Draft deleted successfully" };
    }),

  // GET /news — fetch trade-disruption news with optional search & pagination
  getNews: publicProcedure
    .input(GetNewsInputSchema)
    .query(async ({ input }) => {
      const { search, page, searchMode } = input;
      const pageNum = page;

      const today = new Date();
      const targetDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - pageNum
        )
      );
      const formattedDate = targetDate.toISOString().split("T")[0];
      const fromDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - 4
        )
      )
        .toISOString()
        .split("T")[0];
      const toDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - 1
        )
      )
        .toISOString()
        .split("T")[0];

      let finalQuery =
        '"pandemic" OR "epidemic" OR "outbreak" OR "disease spread" OR "public health crisis" OR "geopolitical event" OR "political instability" OR "trade war" OR "sanctions" OR "natural disaster" OR "extreme weather" OR "environmental hazard"';
      let articles: Array<{
        title: string;
        link: string;
        summary: string;
        date: string;
        source: string;
      }> = [];

      if (search) {
        if (searchMode === "summarized") {
          const genAI = new GoogleGenerativeAI(
            process.env.GOOGLE_API_KEY as string
          );
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
          const prompt = `
Summarize the following user query into 1 to 2 high-impact keywords or proper nouns for news search.
Focus on specific people, places, events, organizations, or major topics.
Remove filler words, dates, conversational phrases, and general context.
The goal is to extract core terms that will return the broadest relevant results from a news API.

Example: "What happened with the US-China trade war tariffs in 2024?" → ("us china tariffs")

Query: "${search}"
Return only the keywords.
`;
          const result = await model.generateContent(prompt);
          finalQuery = result.response.text();
        } else {
          finalQuery = search;
        }
      } else {
        // No search term — try cache first
        const cachedNews = await NewsHistoryModel.findOne({
          date: formattedDate,
          query: "default",
        });
        if (cachedNews) {
          return {
            message: "News fetched from cache",
            articles: cachedNews.articles,
            totalResults: cachedNews.articles.length,
            query: finalQuery,
            fromDate,
            toDate,
          };
        }
      }

      const newsApiKey = process.env.NEWS_API_KEY;
      if (!newsApiKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "NEWS_API_KEY is not configured",
        });
      }

      const apiParams = {
        q: finalQuery,
        searchIn: "title",
        sortBy: "popularity",
        pageSize: 10,
        language: "en",
        apiKey: newsApiKey,
        from: formattedDate,
        to: formattedDate,
      };

      const response = await axios.get("https://newsapi.org/v2/everything", {
        params: apiParams,
      });

      articles = (
        response.data.articles as Array<{
          title?: string;
          url?: string;
          description?: string;
          publishedAt?: string;
          source: { name?: string };
        }>
      ).map((article) => ({
        title: article.title || "No title available",
        link: article.url || "#",
        summary: article.description || "No summary available",
        date: article.publishedAt || new Date().toISOString(),
        source: article.source.name || "Unknown",
      }));

      if (!search && articles.length > 0) {
        await NewsHistoryModel.findOneAndUpdate(
          { date: formattedDate, query: "default" },
          {
            date: formattedDate,
            query: "default",
            articles,
            timestamp: new Date(),
          },
          { upsert: true }
        );
      }

      return {
        message: articles.length
          ? "News fetched successfully"
          : `No news found for query: "${
              search || finalQuery
            }" on ${formattedDate}`,
        articles,
        totalResults: articles.length,
        query: search || finalQuery,
        fromDate,
        toDate,
      };
    }),

  // POST /summarize — summarize a news article with Gemini
  summarizeArticle: publicProcedure
    .input(SummarizeArticleInputSchema)
    .mutation(async ({ input }) => {
      const { content, url } = input;

      const genAI = new GoogleGenerativeAI(
        process.env.GOOGLE_API_KEY as string
      );
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

      const prompt = `
      Summarize the following news article in 5-6 sentences, providing a general overview of its content:
      ${content}

      Then, provide actionable suggestions in a third-person paragraph for logistics providers to mitigate the impact of this event on their shipments.
      **Carefully analyze the article's content for direct or indirect mentions of shipping interruptions, regional disruptions, or supply chain impacts.**

      If the article explicitly details or strongly implies an impact on shipments in a specific region (e.g., road closures, port delays, political instability affecting trade, severe weather in a shipping lane, health-related travel restrictions), then provide specific, concise suggestions. Each suggestion should be 2-3 lines max and include the affected region. Examples:
      - "Logistics providers may consider delaying shipments to [Affected Region] due to [reason, e.g., severe flooding causing road closures] to avoid prolonged transit times and potential damage."
      - "For shipments destined for [Affected Region], it is advisable to explore alternative routes or modes of transport, such as [e.g., air freight instead of sea], to bypass [reason, e.g., port congestion]."
      - "Providers with existing shipments in [Affected Region] should advise clients of potential delays and monitor the situation closely, as [reason, e.g., ongoing protests] may cause further disruptions."

      If the article does NOT genuinely indicate any direct or indirect impact on shipping, supply chains, or trade in any identifiable region, state: "Logistics providers should note that based on current information, this event is not expected to impact shipments in any region. You may proceed with your logistics operations as planned."
    `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const [summary, suggestions] = text.split("\n\n");

      return {
        message: "Article summarized successfully",
        summary: summary || "Summary not available",
        suggestions: suggestions || "No suggestions available",
        url,
      };
    }),
});
