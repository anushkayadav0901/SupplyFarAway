import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireUserId } from "../lib/auth.js";
import { TruckModel } from "../models/Truck.js";
import { protectedProcedure, router } from "../trpc.js";

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

      return { ok: true };
    }),
});
