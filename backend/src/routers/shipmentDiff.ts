import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { router, protectedProcedure } from "../trpc.js";
import { ShipmentDiffModel } from "../models/ShipmentDiff.js";

export const shipmentDiffRouter = router({
  /**
   * POST shipmentDiff.compare
   * Sends two shipment images (before/after) to Gemini 1.5 Flash and persists the analysis.
   */
  compare: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        beforeImageBase64: z.string().min(10),
        afterImageBase64: z.string().min(10),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!mongoose.Types.ObjectId.isValid(userId as string)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid userId format",
        });
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt =
        'Compare these two shipment images (before loading vs after delivery). Respond ONLY with JSON: {"missingItems": string[], "damageDescription": string, "tamperingProbability": number (0-1), "riskScore": number (0-100), "summary": string}';

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: input.beforeImageBase64,
            mimeType: input.mimeType,
          },
        },
        {
          inlineData: {
            data: input.afterImageBase64,
            mimeType: input.mimeType,
          },
        },
      ]);

      const rawText = result.response.text();

      let parsed: {
        missingItems: string[];
        damageDescription: string;
        tamperingProbability: number;
        riskScore: number;
        summary: string;
      };

      try {
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}") + 1;
        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error("No JSON object found in response");
        }
        const cleanText = rawText.slice(jsonStart, jsonEnd).trim();
        parsed = JSON.parse(cleanText);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Gemini response. Raw snippet: ${rawText.slice(0, 200)}`,
        });
      }

      const doc = await ShipmentDiffModel.create({
        userId: new mongoose.Types.ObjectId(userId as string),
        draftId: input.draftId,
        riskScore: parsed.riskScore,
        tamperingProbability: parsed.tamperingProbability,
        missingItems: parsed.missingItems,
        damageDescription: parsed.damageDescription,
        summary: parsed.summary,
        createdAt: new Date(),
      });

      return doc;
    }),

  /**
   * GET shipmentDiff.history
   * Returns the last N ShipmentDiff records for the authenticated user, newest first.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const records = await ShipmentDiffModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(input.limit);

      return records;
    }),
});
