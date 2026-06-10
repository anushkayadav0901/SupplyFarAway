import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import passport from "./config/passport.js";
import connectMongoDB from "./lib/db.js";
import { appRouter } from "./routers/_app.js";
import { createContext } from "./context.js";
import legacyAuthRouter from "./legacy/auth.js";
import legacyComplianceRouter from "./legacy/compliance.js";

// Load environment variables
dotenv.config();
void connectMongoDB();

// Initialize Express app
const app = express();
const PORT = Number(process.env.PORT) || 5000;

const isProduction = process.env.NODE_ENV === "production";

const FRONTEND_URL = isProduction
  ? (process.env.FRONTEND_URL ?? (() => { throw new Error("FRONTEND_URL must be set in production"); })())
  : "http://localhost:5173";

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(passport.initialize());

// Basic Route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello, this is the Backend Server");
});

// Mount tRPC. Domain agents will add procedures to appRouter in Phase 2.
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Legacy Express REST routes (OAuth callbacks, multer file uploads, CSV upload,
// image upload) mounted below.
app.use(legacyAuthRouter);
app.use(legacyComplianceRouter);

app.listen(PORT, () => {
  console.log(`Server is running on Port ${PORT}`);
});

export type { AppRouter } from "./routers/_app.js";
