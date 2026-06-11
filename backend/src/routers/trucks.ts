import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";
import { TruckModel } from "../models/Truck.js";

export const trucksRouter = router({
  /**
   * POST trucks.register — Register a new truck for the authenticated user.
   */
  register: protectedProcedure
    .input(
      z.object({
        plate: z.string().min(1),
        capacityKg: z.number().positive(),
        baseCity: z.string().min(1),
        driverName: z.string().min(1),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid userId format",
        });
      }

      const truck = await TruckModel.create({
        userId: new mongoose.Types.ObjectId(String(userId)),
        plate: input.plate,
        capacityKg: input.capacityKg,
        baseCity: input.baseCity,
        driverName: input.driverName,
        phone: input.phone,
      });

      return truck;
    }),

  /**
   * GET trucks.list — List all trucks for the authenticated user.
   */
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const userId = ctx.user.id ?? ctx.user._id;

      const trucks = await TruckModel.find({ userId }).sort({ createdAt: -1 });

      return trucks;
    }),

  /**
   * DELETE trucks.remove — Remove a truck owned by the authenticated user.
   */
  remove: protectedProcedure
    .input(z.object({ truckId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;

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
