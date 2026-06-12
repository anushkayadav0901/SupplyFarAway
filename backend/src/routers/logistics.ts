/**
 * logistics.ts — tRPC router for the logistics domain.
 *
 * Converts the following legacy REST files:
 *  - backend/Routes/routeOptimizationRoutes.js
 *  - backend/Routes/carbonFootprintRoutes.js
 *  - backend/Routes/chooseRoute.js
 *  - backend/Routes/constants.js  → backend/src/lib/routeConstants.ts
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { requireUserId } from "../lib/auth.js";
import { countryOptions } from "../lib/routeConstants.js";
import { DraftModel } from "../models/Draft.js";
import { SaveRouteModel } from "../models/SaveRoute.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
import { geocodeAddress, getDirections } from "../utils/geocode.js";

// ---------------------------------------------------------------------------
// Inline Zod schemas
// ---------------------------------------------------------------------------

const PackageSchema = z.object({
  quantity: z.number().positive(),
  weight: z.number().positive(),
  height: z.number().positive(),
  length: z.number().positive(),
  width: z.number().positive(),
});

const RouteDirectionLegSchema = z.object({
  id: z.string(),
  waypoints: z.array(z.string()),
  state: z.enum(["land", "sea", "air"]),
  distance: z.number().optional(),
});

const RouteDataSchema = z.object({
  routeDirections: z.array(RouteDirectionLegSchema),
  distanceByLeg: z.array(z.number()),
  totalDistance: z.number().optional(),
  totalCost: z.number().optional(),
  totalTime: z.number().optional(),
  totalTimeDaysRange: z.string().optional(),
  totalCarbonScore: z.number().optional(),
  tag: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a free-text place name to an ISO-3166-1 alpha-2 country code
 * using Gemini AI — mirrors the logic in chooseRoute.js.
 */
async function normalizeCountry(
  placeName: string,
  genAI: GoogleGenerativeAI
): Promise<{ countryName: string; countryCode: string; confidence: number } | null> {
  if (!placeName) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
You are a precise and structured AI.

Given the place name "${placeName}", return ONLY the following information as a **valid JSON object**:
{
  "countryName": "Full country name (e.g., 'United States')",
  "countryCode": "ISO 3166-1 alpha-2 code (e.g., 'US')",
  "confidence": Confidence score between 0 and 1 (e.g., 0.95)
}

Instructions:
- If the input is ambiguous or not a valid location, return:
  {
    "countryName": null,
    "countryCode": null,
    "confidence": 0
  }

STRICTLY RETURN ONLY JSON with no explanations, headings, or extra text.
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Remove markdown code block wrappers if present
    if (responseText.startsWith("```")) {
      responseText = responseText
        .replace(/```(?:json)?/gi, "")
        .replace(/```$/, "")
        .trim();
    }

    let aiResult: { countryName: string | null; countryCode: string | null; confidence: number };
    try {
      aiResult = JSON.parse(responseText);
    } catch {
      console.error(`Failed to parse Gemini response for ${placeName}`);
      return null;
    }

    if (aiResult?.countryCode) {
      const option = countryOptions.find(
        (opt) => opt.value.toLowerCase() === aiResult.countryCode!.toLowerCase()
      );
      if (option) {
        return {
          countryName: option.label,
          countryCode: option.value,
          confidence: aiResult.confidence ?? 0.9,
        };
      }
    }
    return null;
  } catch (error) {
    console.error(`Gemini AI error for ${placeName}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const logisticsRouter = router({
  // -------------------------------------------------------------------------
  // POST /api/route-optimization  (public)
  // Generate 7 AI-powered shipping routes from → to.
  // -------------------------------------------------------------------------
  generateRoutes: publicProcedure
    .input(
      z.object({
        from: z.string().min(1).max(200),
        to: z.string().min(1).max(200),
        package: PackageSchema,
        description: z.string().min(1).max(500),
        draftId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GOOGLE_API_KEY is not configured" });
      }

      const { from, to, description, draftId } = input;
      const pkg = input.package;

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Generate 7 shipping routes from ${from} to ${to}. Package: ${pkg.quantity} units, ${pkg.weight}kg, ${pkg.length}x${pkg.width}x${pkg.height}cm, "${description}".

Rules:
- 2 air routes, 2 sea routes, 3 multimodal
- Use geocodable city names: "City, Country"
- Ports: "Port Name, City, Country"
- Airports: "Airport Name, City, Country"

Calculate:
- Distance: Land(road), Air(great-circle), Sea(maritime)
- Cost: DHL rates, volumetric weight=(l*w*h)/5000, multiply by quantity
- Time: Land(60km/h +6h), Air(48-72h), Sea(192-1080h)
- Carbon: Air(70-100), Sea(20-40), Land(40-60)
- Tag best 3: "popular"

JSON format:
[{"routeDirections":[{"id":"leg1","waypoints":["${from}","Airport"],"state":"land","distance":50}],"totalDistance":50,"totalCost":200,"totalTime":24,"totalTimeDaysRange":"1 day","totalCarbonScore":45,"tag":"popular"}]`;

      const timeoutMs = 60000;
      let result;
      try {
        result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`AI timeout after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      } catch (aiErr) {
        console.error("[ROUTE-OPT] AI error:", (aiErr as Error)?.message);
        throw new TRPCError({ code: "BAD_GATEWAY", message: "AI service error" });
      }

      let rawResponse: string;
      try {
        rawResponse = result.response.text();
      } catch (readErr) {
        console.error("[ROUTE-OPT] Read error:", (readErr as Error)?.message);
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Failed to read AI response" });
      }

      const jsonStart = rawResponse.indexOf("[");
      const jsonEnd = rawResponse.lastIndexOf("]") + 1;
      const cleanResponseText = rawResponse.slice(jsonStart, jsonEnd).trim();

      let aiGeneratedRoutes: unknown[];
      try {
        aiGeneratedRoutes = JSON.parse(
          cleanResponseText.replace(/"tag":\s*undefined/g, '"tag": null')
        );
        if (!Array.isArray(aiGeneratedRoutes)) throw new Error("Not an array");
      } catch (parseError) {
        console.error("Parse error:", (parseError as Error)?.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid AI response format" });
      }

      const finalRoutes = (aiGeneratedRoutes as Array<Record<string, unknown>>).map((route) => {
        if (
          !Array.isArray(route.routeDirections) ||
          (route.routeDirections as unknown[]).length === 0 ||
          typeof route.totalCost !== "number"
        ) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid route data" });
        }

        const legs = route.routeDirections as Array<{
          id: string;
          waypoints: string[];
          state: string;
          distance: number;
        }>;
        const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance || 0), 0);

        return {
          routeDirections: legs.map((leg) => ({
            id: leg.id,
            waypoints: leg.waypoints,
            state: leg.state,
            distance: Math.round(leg.distance * 100) / 100,
          })),
          totalDistance: Math.round(totalDistance * 100) / 100,
          totalCost: Math.round((route.totalCost as number) * 100) / 100,
          totalTime: Math.round((route.totalTime as number) * 100) / 100,
          totalTimeDaysRange: route.totalTimeDaysRange as string,
          totalCarbonScore: Math.round((route.totalCarbonScore as number) * 100) / 100,
          tag: route.tag as string | null,
          distanceByLeg: legs.map((leg) => Math.round(leg.distance * 100) / 100),
          ...(draftId ? { draftId } : {}),
        };
      });

      return finalRoutes;
    }),

  // -------------------------------------------------------------------------
  // GET /api/ai-health  (public)
  // Quick AI liveness check.
  // -------------------------------------------------------------------------
  aiHealth: publicProcedure.query(async () => {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const start = Date.now();
    try {
      const result = await Promise.race([
        model.generateContent("Return: OK"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        ),
      ]);
      const response = await result.response.text();
      return { ok: true, elapsedMs: Date.now() - start, sample: response.slice(0, 50) };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: (err as Error)?.message,
      });
    }
  }),

  // -------------------------------------------------------------------------
  // POST /api/routes  (protected)
  // Geocode / clean up route waypoints via Gemini, store map data in Draft.
  // -------------------------------------------------------------------------
  processRoutes: protectedProcedure
    .input(
      z.object({
        routes: z.array(
          z.object({
            id: z.string(),
            waypoints: z.array(z.string()),
            state: z.enum(["land", "sea", "air"]),
          })
        ),
        draftId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const { routes: routesData, draftId } = input;

      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GOOGLE_API_KEY is not configured" });
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

      const prompt = `
      You are a geocoding validation AI tasked with correcting and standardizing waypoints in shipping routes to ensure they are geocodable by Google Maps API and formatted for display. For each waypoint in the provided routes, return a specific, geocodable place name in the format expected by Google Maps (e.g., cities as "City, Country", ports and airports with their official names and locations like "Jawaharlal Nehru Port, Mumbai, Maharashtra, India"). Handle the following cases:

      - **Cities** (e.g., "Pune", "Tokyo"):
        - Format as "City, Country" (e.g., "Pune" → "Pune, India", "Tokyo" → "Tokyo, Japan").
      - **Country codes or vague regions** (e.g., "EU", "FR", "IN"):
        - Replace with a major city in that region/country (e.g., "EU" → "Brussels, Belgium", "FR" → "Paris, France", "IN" → "Mumbai, Maharashtra, India").
      - **Ports** (e.g., "Mumbai Port", "Tokyo Port"):
        - Convert to their official port names as recognized by Google Maps, including the city and country (e.g., "Mumbai Port" → "Jawaharlal Nehru Port, Mumbai, Maharashtra, India", "Tokyo Port" → "Port of Tokyo, Tokyo, Japan").
      - **Airports** (e.g., "DEL Airport", "NRT Airport"):
        - Convert to their official airport names as recognized by Google Maps, including the city and country (e.g., "DEL Airport" → "Indira Gandhi International Airport, Delhi, India", "NRT Airport" → "Narita International Airport, Narita, Chiba, Japan").
      - **Invalid or non-existent locations**:
        - Replace with a sensible default city in the same region or country, or the closest major city (e.g., "UnknownPort" → "Mumbai, Maharashtra, India" if in India).
      - **Ensure waypoints match the transport mode**:
        - Land: Major cities or logistics hubs (e.g., "Delhi, India").
        - Sea: Major ports with official names (e.g., "Jawaharlal Nehru Port, Mumbai, Maharashtra, India").
        - Air: Airports with official names (e.g., "Indira Gandhi International Airport, Delhi, India").
      - **Already geocodable waypoints** (e.g., "Mumbai BOM", "Port of Rotterdam"):
        - If already geocodable, format for consistency (e.g., "Mumbai BOM" → "Chhatrapati Shivaji Maharaj International Airport, Mumbai, Maharashtra, India", "Port of Rotterdam" → "Port of Rotterdam, Rotterdam, Netherlands").

      **Input**:
      ${JSON.stringify(routesData, null, 2)}

      **Output Format**:
      Return a JSON array matching the input structure, with corrected and standardized waypoints. Preserve the "id" and "state" fields. Only modify "waypoints" to ensure they are geocodable and properly formatted for display. Example:
      [
        {
          "id": "segment1",
          "waypoints": ["Pune, India", "Jawaharlal Nehru Port, Mumbai, Maharashtra, India"],
          "state": "land"
        }
      ]

      **Instructions**:
      - Return only the JSON array, with no additional text or explanations.
      - Ensure all waypoints are specific, geocodable, and formatted as "Place, City, Country" or "Official Name, City, Country" for ports and airports.
      - If a waypoint cannot be corrected, use a default major city in the same region.
    `;

      let cleanedRoutesData: Array<{ id: string; waypoints: string[]; state: string }> = routesData;

      try {
        const result = await model.generateContent(prompt);
        const rawResponse = result.response.text();

        const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error("No valid JSON array found in Gemini response");
        }

        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          id: string;
          waypoints: string[];
          state: string;
        }>;

        if (!Array.isArray(parsed) || parsed.length !== routesData.length) {
          throw new Error("Invalid cleaned routes data structure");
        }

        for (let i = 0; i < parsed.length; i++) {
          const cleaned = parsed[i];
          const original = routesData[i];
          if (
            !cleaned.id ||
            !cleaned.waypoints ||
            !cleaned.state ||
            cleaned.id !== original.id ||
            cleaned.state !== original.state ||
            !Array.isArray(cleaned.waypoints) ||
            cleaned.waypoints.length !== original.waypoints.length
          ) {
            throw new Error("Cleaned route segment does not match original structure");
          }
        }

        cleanedRoutesData = parsed;
      } catch (geminiError) {
        console.error("Error cleaning routes with Gemini:", geminiError);
        console.warn("Using original routesData due to Gemini failure");
      }

      // Geocode / polyline each leg
      const responseData: Record<string, unknown> = {};
      for (const route of cleanedRoutesData) {
        try {
          if (!route.id || !route.waypoints || !route.state) {
            throw new Error("Missing required route fields");
          }
          if (route.state === "land") {
            const encodedPolyline = await getDirections(route.waypoints);
            responseData[route.id] = { encodedPolyline, state: route.state };
          } else if (route.state === "sea" || route.state === "air") {
            const coordinates = await Promise.all(route.waypoints.map(geocodeAddress));
            responseData[route.id] = { coordinates, state: route.state };
          }
        } catch (routeError) {
          console.error(`Error processing route ${route.id}:`, routeError);
          responseData[route.id] = {
            error: `Failed to process route: ${(routeError as Error).message}`,
            state: route.state,
          };
        }
      }

      const mapData = { routes: responseData, originalRoute: cleanedRoutesData };

      let draft;
      if (draftId) {
        if (!mongoose.Types.ObjectId.isValid(draftId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid draftId format" });
        }

        draft = await DraftModel.findOneAndUpdate(
          { _id: draftId, userId },
          { $set: { mapData } },
          { new: true, runValidators: true }
        );

        if (!draft) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found or not authorized" });
        }
      } else {
        draft = new DraftModel({
          userId,
          formData: {},
          statuses: {
            compliance: "Not applicable",
            routeOptimization: "Not applicable",
          },
          mapData: { routes: responseData, originalRoute: cleanedRoutesData },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        await draft.save();
      }

      return {
        ...responseData,
        draftId: (draft._id as mongoose.Types.ObjectId).toString(),
      };
    }),

  // -------------------------------------------------------------------------
  // GET /api/routes/:draftId  (protected)
  // Retrieve map data stored in a draft.
  // -------------------------------------------------------------------------
  getMapData: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      requireUserId(ctx);

      if (!mongoose.Types.ObjectId.isValid(input.draftId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid draftId format" });
      }

      const draft = await DraftModel.findById(input.draftId);
      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      }
      const mapData = (draft as unknown as Record<string, unknown>).mapData;
      if (!mapData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No map data found for this draft" });
      }
      return mapData;
    }),

  // -------------------------------------------------------------------------
  // POST /api/save-route  (protected)
  // Save a chosen route against the authenticated user.
  // -------------------------------------------------------------------------
  saveRoute: protectedProcedure
    .input(
      z.object({
        formData: z.object({
          from: z.string().min(1),
          to: z.string().min(1),
          package: z.object({ weight: z.number().positive() }),
        }),
        routeData: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);

      const saveRoute = await SaveRouteModel.create({
        userId,
        formData: {
          from: input.formData.from,
          to: input.formData.to,
          weight: input.formData.package.weight,
        },
        routeData: input.routeData,
        timestamp: new Date(),
      });

      return {
        message: "Route saved successfully",
        recordId: (saveRoute._id as mongoose.Types.ObjectId).toString(),
      };
    }),

  // -------------------------------------------------------------------------
  // GET /api/route-history  (protected)
  // Fetch all saved routes for the authenticated user.
  // -------------------------------------------------------------------------
  getRouteHistory: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const routeHistory = await SaveRouteModel.find({ userId }).sort({ timestamp: -1 });
    return { routeHistory };
  }),

  // -------------------------------------------------------------------------
  // DELETE /api/route-history/:recordId  (protected)
  // Delete a saved route record for the authenticated user.
  // -------------------------------------------------------------------------
  deleteRouteRecord: protectedProcedure
    .input(z.object({ recordId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);

      if (!mongoose.Types.ObjectId.isValid(input.recordId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid recordId format" });
      }

      const record = await SaveRouteModel.findOneAndDelete({
        _id: input.recordId,
        userId,
      });

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Route record not found" });
      }

      return { message: "Route record deleted successfully" };
    }),

  // -------------------------------------------------------------------------
  // POST /api/carbon-footprint  (protected)
  // Calculate per-leg emissions via Carbon Interface, then generate AI
  // suggestions with Gemini.
  // -------------------------------------------------------------------------
  calculateCarbonFootprint: protectedProcedure
    .input(
      z.object({
        origin: z.string().min(1),
        destination: z.string().min(1),
        distance: z.number().positive(),
        weight: z.number().positive(),
        routeDirections: z.array(
          z.object({
            state: z.string(),
            waypoints: z.array(z.string()),
          })
        ),
        distanceByLeg: z.array(z.number().positive()),
        draftId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const {
        origin,
        destination,
        distance,
        weight,
        routeDirections,
        distanceByLeg,
        draftId,
      } = input;

      if (distanceByLeg.length !== routeDirections.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "distanceByLeg array length must match the number of routeDirections legs",
        });
      }

      const sumOfDistances = distanceByLeg.reduce((sum, dist) => sum + dist, 0);
      const tolerance = Math.max(1, distance * 0.01);
      if (Math.abs(sumOfDistances - distance) > tolerance) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sum of distanceByLeg must equal the total distance",
        });
      }

      const CARBON_INTERFACE_API_KEY = process.env.CARBON_INTERFACE_API_KEY;
      if (!CARBON_INTERFACE_API_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Carbon Interface API key is not configured. Please set CARBON_INTERFACE_API_KEY in your environment variables.",
        });
      }

      // Step 1: Calculate emissions for each leg via Carbon Interface API
      let totalEmissions = 0;
      const routeAnalysis: Array<{
        leg: string;
        origin: string;
        destination: string;
        mode: string;
        distance: string;
        emissions: string;
      }> = [];
      const perLegEmissions: number[] = [];

      for (let i = 0; i < routeDirections.length; i++) {
        const segment = routeDirections[i];
        const mode = segment.state.toLowerCase();
        const segmentDistance = distanceByLeg[i];

        let transportMethod: string;
        switch (mode) {
          case "land":
            transportMethod = "truck";
            break;
          case "sea":
            transportMethod = "ship";
            break;
          case "air":
            transportMethod = "plane";
            break;
          default:
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Unsupported transport mode: ${mode}`,
            });
        }

        let apiResponse;
        try {
          apiResponse = await axios.post(
            "https://www.carboninterface.com/api/v1/estimates",
            {
              type: "shipping",
              weight_value: weight,
              weight_unit: "kg",
              distance_value: segmentDistance,
              distance_unit: "km",
              transport_method: transportMethod,
            },
            {
              headers: {
                Authorization: `Bearer ${CARBON_INTERFACE_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          );
        } catch (carbonErr) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Carbon Interface API request failed: ${(carbonErr as Error)?.message ?? "unknown"}`,
          });
        }

        if (![200, 201].includes(apiResponse.status) || !apiResponse.data?.data) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Carbon Interface API failed: Status ${apiResponse.status}`,
          });
        }

        const emissions: number = apiResponse.data.data.attributes.carbon_kg;
        totalEmissions += emissions;
        perLegEmissions.push(emissions);

        routeAnalysis.push({
          leg: `Leg ${i + 1}`,
          origin: segment.waypoints[0],
          destination: segment.waypoints[segment.waypoints.length - 1],
          mode,
          distance: `${segmentDistance.toFixed(2)} km`,
          emissions: `${emissions.toFixed(2)} kg CO2e`,
        });
      }

      // Step 2: Gemini AI suggestions & environmental impact
      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GOOGLE_API_KEY is not configured" });
      }
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const legLines = perLegEmissions
        .map((e, i) => `        - Leg ${i + 1} emissions: ${e} kg CO2e`)
        .join("\n");

      const prompt = `
      You are a carbon footprint analysis AI for Movex, focused on providing actionable insights to reduce environmental impact. Use the following data to generate suggestions for reducing emissions and a description of the environmental impact as of June 08, 2025.

      **Inputs**:
      - **Origin**: ${origin}
      - **Destination**: ${destination}
      - **Total Distance**: ${distance} km
      - **Total Emissions**: ${totalEmissions} kg CO2e
      - **Weight**: ${weight} kg
      - **Route Analysis**: ${JSON.stringify(routeAnalysis)}
      - **Per-Leg Emissions (kg CO2e)**: ${JSON.stringify(perLegEmissions)}

      **Instructions**:
      - Analyze the **Route Analysis** and **Per-Leg Emissions** to identify high-emission segments.
      - For each leg in the Route Analysis, note the emissions from Per-Leg Emissions:
${legLines}
      - Consider the total emissions (${totalEmissions} kg CO2e), weight (${weight} kg), and per-leg emissions to provide practical suggestions.
      - For suggestions, focus on:
        1. Reducing emissions by targeting high-emission segments.
        2. Practical actions like optimizing shipment weight, consolidating shipments, or adjusting routes.
      - For earthImpact, estimate the environmental impact using a relatable metric.

      **Response Format**:
      {
        "suggestions": [
          "Targeted suggestion based on per-leg emissions",
          "Practical suggestion"
        ],
        "earthImpact": "A short description of the environmental impact"
      }

      Ensure the response is concise, actionable, and directly uses the provided per-leg emissions data.
    `;

      let rawResponse: string;
      try {
        const result = await model.generateContent(prompt);
        rawResponse = result.response.text();
      } catch (geminiErr) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Gemini carbon suggestions failed: ${(geminiErr as Error)?.message ?? "unknown"}`,
        });
      }

      const jsonMatch = rawResponse.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No valid JSON found in AI response" });
      }

      let aiData: { suggestions: string[]; earthImpact: string };
      try {
        aiData = JSON.parse(jsonMatch[0]);
      } catch {
        const cleanedResponse = rawResponse
          .replace(/([{,]\s*)(\w+)(:)/g, '$1"$2"$3')
          .replace(/'/g, '"');
        try {
          aiData = JSON.parse(cleanedResponse);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse AI response as valid JSON" });
        }
      }

      // Step 3: Build response
      const responseData = {
        totalDistance: `${distance.toFixed(2)} km`,
        totalEmissions: `${totalEmissions.toFixed(2)} kg CO2e`,
        routeAnalysis,
        suggestions: aiData.suggestions,
        earthImpact: aiData.earthImpact,
      };

      // Step 4: Save / update draft
      let draft;
      if (draftId) {
        if (!mongoose.Types.ObjectId.isValid(draftId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid draftId format" });
        }

        draft = await DraftModel.findOneAndUpdate(
          { _id: draftId, userId },
          { $set: { carbonAnalysisData: responseData } },
          { new: true, runValidators: true }
        );

        if (!draft) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found or not authorized" });
        }
      } else {
        draft = new DraftModel({
          userId,
          formData: {
            ShipmentDetails: {
              "Origin Country": { value: origin, label: origin },
              "Destination Country": { value: destination, label: destination },
              Weight: weight,
            },
          },
          statuses: {
            compliance: "Not applicable",
            routeOptimization: "Not applicable",
          },
          carbonAnalysisData: responseData,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        await draft.save();
      }

      if (!draft) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create or update draft" });
      }

      return {
        ...responseData,
        draftId: (draft._id as mongoose.Types.ObjectId).toString(),
      };
    }),

  // -------------------------------------------------------------------------
  // GET /api/carbon-footprint/:draftId  (protected)
  // Retrieve previously-calculated carbon analysis stored in a draft.
  // -------------------------------------------------------------------------
  getCarbonFootprint: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      requireUserId(ctx);

      if (!mongoose.Types.ObjectId.isValid(input.draftId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid draftId format" });
      }

      const draft = await DraftModel.findById(input.draftId);
      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      }
      const carbonAnalysis = (draft as unknown as Record<string, unknown>).carbonAnalysisData;
      if (!carbonAnalysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No carbon analysis found for this draft" });
      }
      return carbonAnalysis;
    }),

  // -------------------------------------------------------------------------
  // POST /api/choose-route  (protected)
  // Choose a route: update existing draft or create a new one with
  // Gemini-normalised country codes.
  // -------------------------------------------------------------------------
  chooseRoute: protectedProcedure
    .input(
      z.object({
        draftId: z.string().optional(),
        routeData: RouteDataSchema,
        formData: z
          .object({
            from: z.string().min(1),
            to: z.string().min(1),
            package: z.object({ weight: z.number().positive() }),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const { draftId, routeData, formData } = input;

      // Validate distanceByLeg
      for (let i = 0; i < routeData.distanceByLeg.length; i++) {
        const distance = routeData.distanceByLeg[i];
        if (isNaN(distance) || distance <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `distanceByLeg[${i}] must be a positive number`,
          });
        }
      }

      if (routeData.distanceByLeg.length !== routeData.routeDirections.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "distanceByLeg length must match the number of routeDirections",
        });
      }

      if (draftId) {
        // Update existing draft
        if (!mongoose.Types.ObjectId.isValid(draftId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid draftId format" });
        }

        const draft = await DraftModel.findOne({ _id: draftId, userId });
        if (!draft) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found or not authorized" });
        }

        (draft as unknown as Record<string, unknown>).routeData = {
          ...routeData,
          distanceByLeg: routeData.distanceByLeg,
        };
        (draft as unknown as Record<string, unknown>).statuses = {
          ...((draft as unknown as Record<string, unknown>).statuses as Record<string, unknown>),
          routeOptimization: "done",
        };
        draft.markModified("statuses");
        draft.markModified("routeData");
        await draft.save();

        return {
          message: "Draft updated successfully",
          recordId: (draft._id as mongoose.Types.ObjectId).toString(),
        };
      }

      // Create new draft
      if (!formData?.from || !formData?.to || !formData?.package?.weight) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "formData must include from, to, and package with weight for new draft",
        });
      }

      if (!process.env.GOOGLE_API_KEY) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GOOGLE_API_KEY is not configured" });
      }
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

      let originResult, destinationResult;
      try {
        [originResult, destinationResult] = await Promise.all([
          normalizeCountry(formData.from, genAI),
          normalizeCountry(formData.to, genAI),
        ]);
      } catch (normalizeError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to normalize countries: ${(normalizeError as Error).message}`,
        });
      }

      if (!originResult?.countryCode || !originResult?.countryName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not determine country for ${formData.from}`,
        });
      }
      if (!destinationResult?.countryCode || !destinationResult?.countryName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not determine country for ${formData.to}`,
        });
      }

      const originJson = {
        input: formData.from,
        countryName: originResult.countryName,
        countryCode: originResult.countryCode,
        confidence: originResult.confidence,
      };
      const destinationJson = {
        input: formData.to,
        countryName: destinationResult.countryName,
        countryCode: destinationResult.countryCode,
        confidence: destinationResult.confidence,
      };

      const draft = await DraftModel.create({
        userId,
        formData: {
          ShipmentDetails: {
            "Origin Country": originResult.countryCode,
            "Destination Country": destinationResult.countryCode,
            "Gross Weight": formData.package.weight,
          },
        },
        routeData: {
          ...routeData,
          distanceByLeg: routeData.distanceByLeg,
        },
        statuses: {
          compliance: "notDone",
          routeOptimization: "done",
        },
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return {
        message: "Route chosen and draft saved successfully",
        recordId: (draft._id as mongoose.Types.ObjectId).toString(),
        originAnalysis: originJson,
        destinationAnalysis: destinationJson,
      };
    }),
});
