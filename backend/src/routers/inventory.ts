import { GoogleGenerativeAI } from "@google/generative-ai";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { z } from "zod";

import { assertObjectId, requireUserId } from "../lib/auth.js";
import { DraftModel } from "../models/Draft.js";
import { NewsHistoryModel } from "../models/NewsHistory.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Local input schemas
// ---------------------------------------------------------------------------

const CreateDraftInputSchema = z.object({
  originCountry: z.string().min(1).max(100),
  destinationCountry: z.string().min(1).max(100),
  hsCode: z.string().min(1).max(20),
  productDescription: z.string().min(1).max(1000),
  weight: z.number().positive().max(1_000_000),
  perishable: z.boolean().optional(),
  hazardous: z.boolean().optional(),
});

const UpdateDraftInputSchema = z.object({
  id: z.string().min(1),
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
  search: z.string().max(500).optional(),
  page: z.number().int().min(1).max(4).default(1),
  searchMode: z.enum(["direct", "summarized"]).default("direct"),
});

const SummarizeArticleInputSchema = z.object({
  content: z.string().min(1).max(20000),
  url: z.string().min(1).max(2000).url(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const inventoryRouter = router({
  // POST /api/drafts
  createDraft: protectedProcedure
    .input(CreateDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const draft = await DraftModel.create({
        userId,
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

  // PUT /api/drafts/:id
  updateDraft: protectedProcedure
    .input(UpdateDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      assertObjectId(input.id, "draftId");

      const draft = await DraftModel.findOne({ _id: input.id, userId });
      if (!draft) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft not found or not authorized",
        });
      }

      // Drop fields the client should never be able to overwrite (defence-in-
      // depth against IDOR/userId-overwrite via the loose `updateData` Record).
      const sanitizedUpdate: Record<string, unknown> = { ...input.updateData };
      delete sanitizedUpdate.userId;
      delete sanitizedUpdate._id;
      delete sanitizedUpdate.id;

      Object.assign(draft, sanitizedUpdate);
      // The schema uses Mixed for nested fields — Mongoose can't see deep
      // assignments without markModified, so changes would silently not persist.
      for (const key of Object.keys(sanitizedUpdate)) {
        draft.markModified(key);
      }
      await draft.save();

      return {
        message: "Draft updated successfully",
        recordId: draft._id,
      };
    }),

  // GET /api/drafts?tab=...
  getDrafts: protectedProcedure
    .input(GetDraftsInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const query: Record<string, unknown> = { userId };

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

  // GET /api/drafts/user/:userId
  getDraftsByUser: protectedProcedure
    .input(GetDraftsByUserInputSchema)
    .query(async ({ ctx, input }) => {
      const authedUserId = requireUserId(ctx);
      assertObjectId(input.userId, "userId");

      // Defence-in-depth: refuse to expose another user's drafts even if the
      // caller knows their ObjectId. Only the authenticated user can read
      // their own drafts via this endpoint.
      if (String(authedUserId) !== input.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot query drafts for a different user",
        });
      }

      const query: Record<string, unknown> = { userId: input.userId };
      if (input.complianceStatus === "done")
        query["statuses.compliance"] = "compliant";
      if (input.routeOptimizationStatus === "done")
        query["statuses.routeOptimization"] = "done";

      const drafts = await DraftModel.find(query).sort({ timestamp: -1 });
      return { drafts };
    }),

  // GET /api/drafts/:id
  getDraftById: protectedProcedure
    .input(GetDraftByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      assertObjectId(input.id, "draftId");

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

  // DELETE /api/drafts/:id
  deleteDraft: protectedProcedure
    .input(DeleteDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      assertObjectId(input.id, "draftId");

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

  // GET /news
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
          today.getUTCDate() - pageNum,
        ),
      );
      const formattedDate = targetDate.toISOString().split("T")[0];
      const fromDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - 4,
        ),
      )
        .toISOString()
        .split("T")[0];
      const toDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - 1,
        ),
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
          if (!process.env.GOOGLE_API_KEY) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "GOOGLE_API_KEY is not configured",
            });
          }
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
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
          try {
            const result = await model.generateContent(prompt);
            finalQuery = result.response.text();
          } catch (err) {
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: `Gemini summarization failed: ${(err as Error)?.message ?? "unknown"}`,
            });
          }
        } else {
          finalQuery = search;
        }
      } else {
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

      let response;
      try {
        response = await axios.get("https://newsapi.org/v2/everything", {
          params: apiParams,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `News API failed: ${(err as Error)?.message ?? "unknown"}`,
        });
      }

      // Defensive: NewsAPI may return null/undefined for `articles` on no-result
      // days or upstream failures. Coerce to an empty list to prevent
      // `Cannot read properties of undefined` from blowing up the request.
      const rawArticles = ((response.data as { articles?: unknown }).articles ??
        []) as Array<{
        title?: string;
        url?: string;
        description?: string;
        publishedAt?: string;
        source?: { name?: string } | null;
      }>;

      articles = rawArticles
        // NewsAPI sometimes returns sentinel "[Removed]" rows — strip them so
        // we don't render broken cards in the UI.
        .filter(
          (a) =>
            a &&
            typeof a === "object" &&
            a.title !== "[Removed]" &&
            a.url !== "https://removed.com"
        )
        .map((article) => ({
          title: article.title || "No title available",
          link: article.url || "#",
          summary: article.description || "No summary available",
          date: article.publishedAt || new Date().toISOString(),
          source: article.source?.name || "Unknown",
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
          { upsert: true },
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

  // POST /summarize
  summarizeArticle: publicProcedure
    .input(SummarizeArticleInputSchema)
    .mutation(async ({ input }) => {
      const { content, url } = input;

      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GOOGLE_API_KEY is not configured",
        });
      }
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

      const prompt = `
      Summarize the following news article in 5-6 sentences, providing a general overview of its content:
      ${content}

      Then, provide actionable suggestions in a third-person paragraph for logistics providers to mitigate the impact of this event on their shipments.
      **Carefully analyze the article's content for direct or indirect mentions of shipping interruptions, regional disruptions, or supply chain impacts.**

      If the article explicitly details or strongly implies an impact on shipments in a specific region (e.g., road closures, port delays, political instability affecting trade, severe weather in a shipping lane, health-related travel restrictions), then provide specific, concise suggestions. Each suggestion should be 2-3 lines max and include the affected region.

      If the article does NOT genuinely indicate any direct or indirect impact on shipping, supply chains, or trade in any identifiable region, state: "Logistics providers should note that based on current information, this event is not expected to impact shipments in any region. You may proceed with your logistics operations as planned."
    `;

      let text: string;
      try {
        const result = await model.generateContent(prompt);
        text = result.response.text();
      } catch (err) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Gemini summarization failed: ${(err as Error)?.message ?? "unknown"}`,
        });
      }

      // Robust split: accept any whitespace gap of >=1 blank line. Some Gemini
      // responses come back with a single newline, others with multiple. Keep
      // every paragraph after the first as the "suggestions" block so we
      // don't drop content beyond the second paragraph.
      const paragraphs = text
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      const summary = paragraphs[0] ?? "";
      const suggestions = paragraphs.slice(1).join("\n\n");

      return {
        message: "Article summarized successfully",
        summary: summary || "Summary not available",
        suggestions: suggestions || "No suggestions available",
        url,
      };
    }),
});
