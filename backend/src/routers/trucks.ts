import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { TruckModel } from "../models/Truck.js";
import { FleetTripModel } from "../models/FleetTrip.js";
import { protectedProcedure, router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Seed data helpers
// ---------------------------------------------------------------------------

const DEMO_CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune", "Kolkata"];

const DEMO_TRUCKS = [
  { plate: "MH-04-AC-1234", capacityKg: 15000, baseCity: "Mumbai",    driverName: "Rahul Sharma",    phone: "98200-11001" },
  { plate: "MH-04-BZ-5678", capacityKg: 10000, baseCity: "Mumbai",    driverName: "Sanjay Patil",    phone: "98200-22002" },
  { plate: "DL-01-AA-9012", capacityKg: 20000, baseCity: "Delhi",     driverName: "Vikas Yadav",     phone: "98100-33003" },
  { plate: "DL-01-CB-3456", capacityKg: 8000,  baseCity: "Delhi",     driverName: "Mohan Gupta",     phone: "98100-44004" },
  { plate: "KA-05-MN-7890", capacityKg: 12000, baseCity: "Bangalore", driverName: "Kiran Kumar",     phone: "98440-55005" },
  { plate: "KA-05-PQ-2345", capacityKg: 25000, baseCity: "Bangalore", driverName: "Suresh Naidu",    phone: "98440-66006" },
  { plate: "TN-09-XY-6789", capacityKg: 18000, baseCity: "Chennai",   driverName: "Murugan Raja",    phone: "98410-77007" },
  { plate: "TN-09-ZA-0123", capacityKg: 30000, baseCity: "Chennai",   driverName: "Arjun Pillai",    phone: "98410-88008" },
  { plate: "MH-12-CD-4567", capacityKg: 7000,  baseCity: "Pune",      driverName: "Prakash Desai",   phone: "98220-99009" },
  { plate: "MH-12-EF-8901", capacityKg: 16000, baseCity: "Pune",      driverName: "Nilesh Joshi",    phone: "98220-10010" },
  { plate: "WB-02-GH-2345", capacityKg: 22000, baseCity: "Kolkata",   driverName: "Debasis Bose",    phone: "98300-11011" },
  { plate: "WB-02-IJ-6789", capacityKg: 5000,  baseCity: "Kolkata",   driverName: "Suman Ghosh",     phone: "98300-22022" },
];

// Realistic city-pair distances (km)
const ROUTE_DISTANCES: Record<string, number> = {
  "Mumbai-Pune":       149,
  "Mumbai-Bangalore":  984,
  "Mumbai-Chennai":   1338,
  "Mumbai-Delhi":     1421,
  "Mumbai-Kolkata":   1967,
  "Delhi-Kolkata":    1472,
  "Delhi-Bangalore":  2150,
  "Delhi-Chennai":    2194,
  "Bangalore-Chennai":  346,
  "Bangalore-Kolkata": 1871,
  "Chennai-Kolkata":  1659,
  "Pune-Bangalore":    838,
  "Pune-Chennai":     1185,
};

function routeDistance(a: string, b: string): number {
  return ROUTE_DISTANCES[`${a}-${b}`] ?? ROUTE_DISTANCES[`${b}-${a}`] ?? 600;
}

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function rng(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function buildTrips(
  userId: mongoose.Types.ObjectId,
  truckId: mongoose.Types.ObjectId,
  capacityKg: number,
  baseCity: string,
  count: number,
) {
  const cities = DEMO_CITIES.filter((c) => c !== baseCity);
  const trips = [];

  for (let i = 0; i < count; i++) {
    const dest = cities[Math.floor(Math.random() * cities.length)];
    const dist = routeDistance(baseCity, dest);
    const payload = Math.round(rng(0.4, 0.95) * capacityKg);
    const durationHours = parseFloat((dist / rng(55, 70)).toFixed(1));
    const fuelCost = Math.round(dist * rng(3.2, 4.5));         // INR per km
    const onTime = Math.random() > 0.18;                         // ~82% on-time
    const daysAgo = Math.floor(rng(0, 30));

    trips.push({
      userId,
      truckId,
      dateISO: isoDate(daysAgo),
      originCity: baseCity,
      destCity: dest,
      payloadKg: payload,
      distanceKm: dist,
      durationHours,
      fuelCost,
      onTime,
    });
  }

  return trips;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const trucksRouter = router({
  /**
   * POST trucks.register
   */
  register: protectedProcedure
    .input(
      z.object({
        plate: z.string().min(1).max(20).trim(),
        capacityKg: z.number().positive().max(200000),
        baseCity: z.string().min(1).max(120).trim(),
        driverName: z.string().min(1).max(120).trim(),
        phone: z.string().max(30).trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const truck = await TruckModel.create({
        userId,
        plate: input.plate,
        capacityKg: input.capacityKg,
        baseCity: input.baseCity,
        driverName: input.driverName,
        phone: input.phone ? input.phone : undefined,
      });

      return truck;
    }),

  /**
   * GET trucks.list
   */
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const userId = requireUserId(ctx);

      const trucks = await TruckModel.find({ userId }).sort({ createdAt: -1 });

      return trucks;
    }),

  /**
   * DELETE trucks.remove
   */
  remove: protectedProcedure
    .input(z.object({ truckId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      if (!mongoose.Types.ObjectId.isValid(input.truckId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid truckId format",
        });
      }

      const deleted = await TruckModel.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(input.truckId),
        userId,
      });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Truck not found or not authorized",
        });
      }

      // Also remove associated trips
      await FleetTripModel.deleteMany({ userId, truckId: new mongoose.Types.ObjectId(input.truckId) });

      return { ok: true };
    }),

  /**
   * POST trucks.seedDemoFleet
   * Idempotent: tops up to 12 trucks; generates ~25-30 historical trips.
   */
  seedDemoFleet: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const userId = requireUserId(ctx);

      const existing = await TruckModel.find({ userId }).select("_id plate").lean();
      const existingPlates = new Set(existing.map((t) => t.plate));

      // Top up to 12 demo trucks
      const toCreate = DEMO_TRUCKS.filter((t) => !existingPlates.has(t.plate));
      const newTrucks = toCreate.length > 0
        ? await TruckModel.insertMany(
            toCreate.map((t) => ({ ...t, userId })),
          )
        : [];

      const allTrucks = [
        ...existing,
        ...newTrucks.map((t) => ({ _id: t._id, plate: t.plate })),
      ];

      // Build trips only for trucks that don't already have trips
      const trucksWithTrips = await FleetTripModel.distinct("truckId", { userId });
      const trucksWithTripsSet = new Set(trucksWithTrips.map(String));

      const allTruckDocs = await TruckModel.find({ userId }).lean();
      const truckMap = new Map(allTruckDocs.map((t) => [String(t._id), t]));

      type TripInput = {
        userId: mongoose.Types.ObjectId;
        truckId: mongoose.Types.ObjectId;
        dateISO: string;
        originCity: string;
        destCity: string;
        payloadKg: number;
        distanceKm: number;
        durationHours: number;
        fuelCost: number;
        onTime: boolean;
      };

      const tripDocs: TripInput[] = [];
      for (const t of allTrucks) {
        const idStr = String(t._id);
        if (trucksWithTripsSet.has(idStr)) continue;
        const doc = truckMap.get(idStr);
        if (!doc) continue;
        const tripsForTruck = Math.floor(rng(2, 4));    // 2-3 trips per truck → ~25-30 total
        tripDocs.push(
          ...buildTrips(userId, t._id, doc.capacityKg, doc.baseCity, tripsForTruck),
        );
      }

      if (tripDocs.length > 0) {
        await FleetTripModel.insertMany(tripDocs);
      }

      return { trucksAdded: newTrucks.length, tripsAdded: tripDocs.length };
    }),

  /**
   * GET trucks.analytics
   * Returns per-truck utilization + fleet-wide KPIs.
   */
  analytics: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const userId = requireUserId(ctx);

      const [trucks, trips] = await Promise.all([
        TruckModel.find({ userId }).lean(),
        FleetTripModel.find({ userId }).lean(),
      ]);

      if (trucks.length === 0) {
        return {
          perTruck: [] as {
            truckId: string;
            plate: string;
            baseCity: string;
            totalTrips: number;
            utilizationPct: number;
            onTimeRate: number;
          }[],
          fleet: {
            avgUtilizationPct: 0,
            onTimePct: 0,
            totalFuelLastWeek: 0,
            maintenanceFlags: 0,
          },
        };
      }

      // Group trips by truckId
      const tripsByTruck = new Map<string, typeof trips>();
      for (const trip of trips) {
        const key = String(trip.truckId);
        if (!tripsByTruck.has(key)) tripsByTruck.set(key, []);
        tripsByTruck.get(key)!.push(trip);
      }

      // Last 7 days fence
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fenceISO = sevenDaysAgo.toISOString().slice(0, 10);

      let totalFuelLastWeek = 0;
      let maintenanceFlags = 0;

      const perTruck = trucks.map((truck) => {
        const truckTrips = tripsByTruck.get(String(truck._id)) ?? [];
        const totalTrips = truckTrips.length;

        // Utilization: average payload / capacity across all trips
        const utilizationPct =
          totalTrips === 0
            ? 0
            : Math.min(
                100,
                Math.round(
                  (truckTrips.reduce((s, t) => s + t.payloadKg, 0) /
                    (totalTrips * truck.capacityKg)) *
                    100,
                ),
              );

        const onTimeCount = truckTrips.filter((t) => t.onTime).length;
        const onTimeRate = totalTrips === 0 ? 100 : Math.round((onTimeCount / totalTrips) * 100);

        // Fleet-wide aggregations
        for (const trip of truckTrips) {
          if (trip.dateISO >= fenceISO) {
            totalFuelLastWeek += trip.fuelCost;
          }
        }

        // Maintenance flag: >20 trips without a service interval (heuristic)
        if (totalTrips > 20) maintenanceFlags += 1;

        return {
          truckId: String(truck._id),
          plate: truck.plate,
          baseCity: truck.baseCity,
          totalTrips,
          utilizationPct,
          onTimeRate,
        };
      });

      const trucksWithTripsData = perTruck.filter((t) => t.totalTrips > 0);
      const avgUtilizationPct =
        trucksWithTripsData.length === 0
          ? 0
          : Math.round(
              trucksWithTripsData.reduce((s, t) => s + t.utilizationPct, 0) /
                trucksWithTripsData.length,
            );

      const allTripsCount = trips.length;
      const onTimeCount = trips.filter((t) => t.onTime).length;
      const onTimePct =
        allTripsCount === 0 ? 100 : Math.round((onTimeCount / allTripsCount) * 100);

      return {
        perTruck,
        fleet: {
          avgUtilizationPct,
          onTimePct,
          totalFuelLastWeek: Math.round(totalFuelLastWeek),
          maintenanceFlags,
        },
      };
    }),
});
