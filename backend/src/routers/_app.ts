import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { inventoryRouter } from "./inventory.js";
import { complianceRouter } from "./compliance.js";
import { logisticsRouter } from "./logistics.js";

/**
 * Root tRPC router. Domain agents will add their sub-routers
 * here in Phase 2 (auth, compliance, routes, carbon, products, drafts,
 * users, news).
 */
export const appRouter = router({
  auth: authRouter,
  inventory: inventoryRouter,
  compliance: complianceRouter,
  logistics: logisticsRouter,
});

export type AppRouter = typeof appRouter;
