import express, { type Request, type Response, type NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import passport from "./config/passport.js";
import connectMongoDB from "./lib/db.js";
import { appRouter } from "./routers/_app.js";
import { createContext } from "./context.js";
import legacyAuthRouter from "./legacy/auth.js";
import legacyComplianceRouter from "./legacy/compliance.js";

// Load environment variables before anything else.
dotenv.config();

// Connect to MongoDB. Surface errors clearly — a failed connection is fatal
// at startup and should not be silently swallowed.
connectMongoDB().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[index] Startup aborted — database connection failed:", message);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const isProduction = process.env.NODE_ENV === "production";

// In production the FRONTEND_URL must be explicitly configured so CORS is not
// left open to any origin.
const FRONTEND_URL = isProduction
  ? (process.env.FRONTEND_URL ??
      (() => {
        throw new Error(
          "[index] FRONTEND_URL must be set in production environment",
        );
      })())
  : "http://localhost:5173";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: "5mb" }));
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
app.use(passport.initialize());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "supply-chain-backend" });
});

// ---------------------------------------------------------------------------
// tRPC handler
// ---------------------------------------------------------------------------

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ path, error }) {
      // Log server-side errors at warn/error so they appear in structured
      // logs without exposing stack traces to the client.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] INTERNAL_SERVER_ERROR on /${path ?? "unknown"}:`, error.message);
      } else {
        console.warn(`[trpc] ${error.code} on /${path ?? "unknown"}:`, error.message);
      }
    },
  }),
);

// ---------------------------------------------------------------------------
// Legacy Express REST routes (OAuth callbacks, multer file uploads, etc.)
// ---------------------------------------------------------------------------

app.use(legacyAuthRouter);
app.use(legacyComplianceRouter);

// ---------------------------------------------------------------------------
// 404 fallback — unknown paths must not crash the response cycle.
// ---------------------------------------------------------------------------

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Global JSON error formatter middleware
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";
  console.error("[index] Unhandled Express error:", message);
  res.status(500).json({ error: message });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[index] Server listening on port ${PORT} (${isProduction ? "production" : "development"})`);
});

export type { AppRouter } from "./routers/_app.js";
