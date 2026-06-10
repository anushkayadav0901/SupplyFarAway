import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/routers/_app";

/**
 * tRPC React client bound to the AppRouter type.
 *
 * Usage (in App.tsx or a provider wrapper):
 *
 *   import { trpc } from "./lib/trpc";
 *   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 *   import { httpBatchLink } from "@trpc/client";
 *   import superjson from "superjson";
 *
 *   const queryClient = new QueryClient();
 *   const trpcClient = trpc.createClient({
 *     links: [
 *       httpBatchLink({
 *         url: (import.meta.env.VITE_API_URL ?? "http://localhost:5000") + "/trpc",
 *         transformer: superjson,
 *       }),
 *     ],
 *   });
 *
 *   // Wrap your app:
 *   <trpc.Provider client={trpcClient} queryClient={queryClient}>
 *     <QueryClientProvider client={queryClient}>
 *       <App />
 *     </QueryClientProvider>
 *   </trpc.Provider>
 */
export const trpc = createTRPCReact<AppRouter>();

/** Base URL for the tRPC endpoint, defaults to localhost:5000/trpc in dev. */
export const trpcUrl =
  (import.meta.env.VITE_API_URL ?? "http://localhost:5000") + "/trpc";
