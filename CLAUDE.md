# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Two independent npm projects, no monorepo tooling:

- `backend/` — Express 5 + tRPC 11 + Mongoose, TypeScript ESM, runs on port 5000.
- `frontend/` — React 18 + Vite 6 + Tailwind v4, runs on port 5173 (or 5174).

There is no root `package.json`. Run npm commands from inside `backend/` or `frontend/`.

## Common commands

Backend (`cd backend`):
- `npm run dev` — hot-reload server via `tsx watch src/index.ts`
- `npm run build` — `tsc` → `dist/`
- `npm start` — run compiled `dist/index.js`
- No test runner is configured (`npm test` is a placeholder that exits 1).

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint over the project
- `npm run preview` — preview built output
- No test runner is configured.

There is no lint or typecheck script in the backend; run `npx tsc --noEmit` from `backend/` to typecheck.

## Architecture

### End-to-end type safety via tRPC

The frontend imports the backend's router *type* directly through a Vite/TS path alias:

- `frontend/vite.config.ts` and `frontend/tsconfig.json` both map `@server/*` → `../backend/src/*`.
- `frontend/src/lib/trpc.ts` does `import type { AppRouter } from "@server/routers/_app"` to build the typed React-Query client.
- The frontend never bundles backend code — only TypeScript types cross the boundary.

When adding or renaming a tRPC procedure, the frontend's typed call sites update automatically; a `tsc` error on the frontend is the signal you broke the contract.

### Backend request flow

`backend/src/index.ts` mounts three things in order on the same Express app:

1. `/trpc/*` — `createExpressMiddleware({ router: appRouter, createContext })`. This is the primary API.
2. `legacyAuthRouter` — Express REST routes for things tRPC can't do cleanly: Google OAuth redirects (`/auth/google`, `/auth/google/callback`) and multer file uploads (`/api/user/upload-photo`).
3. `legacyComplianceRouter` — Express REST for multer image upload (`/api/analyze-product`).

The split is deliberate: **anything that needs `multipart/form-data` or OAuth redirects stays in `backend/src/legacy/`**; everything else is a tRPC procedure. Don't try to convert these to tRPC — the comment headers in `legacy/auth.ts` and `legacy/compliance.ts` explain why.

### tRPC composition

- `backend/src/trpc.ts` defines `publicProcedure` and `protectedProcedure` (the latter goes through an `isAuthed` middleware that requires `ctx.user`). Use `superjson` as the transformer on both sides.
- `backend/src/context.ts` extracts a JWT from `Authorization: Bearer <token>` *or* cookies (`token` / `authToken`), verifies it with `JWT_SECRET`, and sets `ctx.user`. The frontend client (`frontend/src/lib/trpcProvider.tsx`) always sends `Authorization: Bearer <localStorage.token>`.
- `backend/src/routers/_app.ts` is the only place sub-routers are wired in: `auth`, `inventory`, `compliance`, `logistics`. Add new domain routers here.

### Auth model

- JWTs are signed with `JWT_SECRET`, 1-hour expiry (`TOKEN_EXPIRY = "1h"`). Both `legacy/auth.ts` and `routers/auth.ts` use these constants — keep them in sync if you change them.
- Google OAuth users have `password === "GOOGLE_AUTH_PLACEHOLDER"` in the `User` model. Any password-related procedure (`createAccount`, `loginUser`, `updatePassword`) must check this sentinel and refuse with a specific message. See `backend/src/routers/auth.ts`.
- `backend/src/middleware/auth.ts` (`verifyToken`) is the Express version, used only by the legacy REST routes that need multer.

### Data layer

Mongoose models in `backend/src/models/`: `User`, `Draft`, `SaveRoute`, `ComplianceRecord`, `ProductAnalysis`, `NewsHistory`. `Draft` is shared across compliance and logistics — deleting a user cascades into `DraftModel.deleteMany({ userId })` in `auth.deleteAccount`. Mirror that pattern when adding new per-user collections.

`backend/src/lib/db.ts` exports `connectMongoDB`, called once from `index.ts` at boot; it throws if `MONGODB_URI` isn't set.

### Frontend structure

- `frontend/src/App.tsx` is the route table. Public routes (`/`, `/createAccount`) live outside `<ProtectedRoute />`; everything else lives inside it.
- `ProtectedRoute` (`frontend/src/components/ProtectedRoute.tsx`) gates on `trpc.auth.getMe.useQuery()` — if it fails, it redirects to `/`. This is the canonical client-side auth check; don't reimplement it per page.
- Pages are grouped by feature under `frontend/src/pages/{auth, dashboard, compliance-check, route-optimization, inventory-management, profile, news, documentation}/`. Match this convention when adding pages.
- `main.tsx` wraps the whole app in `TrpcProvider` (which sets up React Query + the tRPC client). A `ChatbotDrawer` is rendered as a sibling to `App` so it floats over every route.
- `vercel.json` rewrites all routes (including `/map(.*)` and `/carbon-footprint(.*)`) to `index.html` for SPA routing on Vercel.

## Conventions

- Backend is ESM with NodeNext resolution — **always use `.js` extensions in relative imports** even though the source files are `.ts` (e.g., `import { router } from "../trpc.js"`). This is required by NodeNext.
- Both `tsconfig.json` files use `"strict": true`. Don't disable it.
- Backend keys are read from `process.env` at module load (e.g., `JWT_SECRET`, `GOOGLE_API_KEY`, `MONGODB_URI`, `FRONTEND_URL`). In production, missing `FRONTEND_URL` throws at startup by design — preserve that behavior.
- Files under `backend/Config/` are gitignored (service account JSONs etc.) except a `.gitkeep`. Don't commit credentials there.

## Environment

Backend reads (see README for full list): `MONGODB_URI`, `JWT_SECRET`, `PORT` (defaults to 5000), `FRONTEND_URL` (defaults to `http://localhost:5173` in dev), `GOOGLE_API_KEY` for Gemini, plus optional Google OAuth / Cloud Storage / Vision / Carbon Interface / News API keys.

Frontend reads `VITE_API_URL` (defaults to `http://localhost:5000`) — the tRPC client appends `/trpc` to it.
