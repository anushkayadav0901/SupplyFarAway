import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";

import type { Context } from "../context.js";

/**
 * Extract a validated mongoose.Types.ObjectId from the tRPC context's user
 * payload. Throws a TRPCError BAD_REQUEST if no valid userId is present.
 *
 * Used by every protected mutation across the feature routers so that the
 * "invalid userId" check is standardised in one place.
 */
export function requireUserId(ctx: Context): mongoose.Types.ObjectId {
  const raw = ctx.user?.id ?? ctx.user?._id;
  if (!raw) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid userId format",
    });
  }
  const asStr = String(raw);
  if (!mongoose.Types.ObjectId.isValid(asStr)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid userId format",
    });
  }
  return new mongoose.Types.ObjectId(asStr);
}

/**
 * Validate an arbitrary string as a Mongo ObjectId. Throws TRPCError
 * BAD_REQUEST when the id is malformed.
 */
export function assertObjectId(id: string, label = "id"): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid ${label} format`,
    });
  }
}
