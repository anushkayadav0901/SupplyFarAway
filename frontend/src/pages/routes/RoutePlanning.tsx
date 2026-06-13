import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MapPin,
  Navigation,
  Compass,
  Clock,
  Wind,
  DollarSign,
  Route as RouteIcon,
  RefreshCcw,
  Play,
  Square,
  Leaf,
} from "lucide-react";
import MapView from "../inventory/MapView";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedRoute {
  routeDirections: Array<{ id: string; waypoints: string[]; state: string; distance?: number }>;
  distanceByLeg: number[];
  totalDistance: number;
  totalCost: number;
  totalTime: number;
  totalTimeDaysRange?: string;
  totalCarbonScore: number;
  tag: string | null;
}

interface PingResult {
  _id: string;
  draftId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  destinationLat: number;
  destinationLng: number;
  distanceKm: number;
  etaMinutes: number;
  createdAt: string | Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtEta(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function modeColor(state: string): string {
  if (state === "air") return "text-blue-600 bg-blue-50";
  if (state === "sea") return "text-emerald-600 bg-emerald-50";
  return "text-slate-600 bg-slate-100";
}

function modeLabel(state: string): string {
  if (state === "air") return "Air";
  if (state === "sea") return "Sea";
  return "Land";
}

// ---------------------------------------------------------------------------
// LiveTrackingRow — per-shipment toggle
// ---------------------------------------------------------------------------

interface SavedRoute {
  _id: string;
  formData: { from: string; to: string; weight: number };
  timestamp: string | Date;
}

function LiveTrackingRow({ route }: { route: SavedRoute }) {
  const [tracking, setTracking] = useState(false);
  const recordId = route._id;

  const latestPingQuery = trpc.tracking.latest.useQuery(
    { draftId: recordId },
    { enabled: tracking, retry: false, refetchInterval: tracking ? 5000 : false }
  );

  const ping = latestPingQuery.data as PingResult | undefined;

  return (
    <div className="flex items-center justify-between py-3 px-1 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {route.formData.from} → {route.formData.to}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {route.formData.weight} kg &middot; {new Date(route.timestamp).toLocaleDateString()}
        </p>
        {tracking && ping && (
          <p className="text-xs text-blue-600 mt-0.5 font-medium">
            {ping.distanceKm.toFixed(1)} km remaining &middot; ETA {fmtEta(ping.etaMinutes)}
          </p>
        )}
        {tracking && !ping && !latestPingQuery.isLoading && (
          <p className="text-xs text-slate-400 mt-0.5">No ping data yet</p>
        )}
      </div>
      <button
        onClick={() => setTracking((t) => !t)}
        title={tracking ? "Stop tracking" : "Start tracking"}
        className={`ml-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
          tracking
            ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
            : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"
        }`}
      >
        {tracking ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {tracking ? "Live" : "Track"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function RoutePlanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftId, setDraftId] = useState<string>(searchParams.get("draftId") ?? "");

  // Form state
  const [from, setFrom] = useState("Mumbai, India");
  const [to, setTo] = useState("Rotterdam, Netherlands");
  const [weight, setWeight] = useState("500");
  const [description, setDescription] = useState("General cargo");

  // Results
  const [routes, setRoutes] = useState<GeneratedRoute[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Sync draftId to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params, { replace: true });
  }, [draftId, setSearchParams]);

  // Generate routes mutation
  const generateMutation = trpc.logistics.generateRoutes.useMutation({
    onSuccess: (data) => {
      const items = data as GeneratedRoute[];
      if (!items || items.length === 0) {
        toast.error("No routes returned. Try different locations.");
        return;
      }
      setRoutes(items);
      setSelectedIndex(0);
      toast.success(`${items.length} routes generated.`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate routes.");
    },
  });

  // Route history (saved routes = "active shipments")
  const historyQuery = trpc.logistics.getRouteHistory.useQuery(undefined, {
    retry: false,
  });
  const savedRoutes = (historyQuery.data?.routeHistory ?? []) as unknown as SavedRoute[];

  const handlePlanRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from.trim() || !to.trim()) return;
    const w = parseFloat(weight) || 100;
    generateMutation.mutate({
      from: from.trim(),
      to: to.trim(),
      description: description.trim() || "General cargo",
      package: {
        quantity: 1,
        weight: w,
        height: 50,
        length: 50,
        width: 50,
      },
      ...(draftId ? { draftId } : {}),
    });
  };

  const selectedRoute = selectedIndex !== null ? routes[selectedIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* Draft context bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Operational Context</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Optionally link results to an active draft for map processing and compliance hand-off.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Draft:</span>
            <DraftPicker value={draftId} onSelect={setDraftId} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left: form + results */}
          <div className="lg:col-span-5 space-y-6">

            {/* Plan form */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-600" /> Plan Route
              </h3>
              <form onSubmit={handlePlanRoute} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      From
                    </label>
                    <input
                      type="text"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="e.g. Mumbai, India"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      To
                    </label>
                    <input
                      type="text"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="e.g. Rotterdam, Netherlands"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Cargo weight (kg)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="General cargo"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors"
                >
                  {generateMutation.isPending ? "Generating routes..." : "Plan Route"}
                </button>
              </form>
            </div>

            {/* Loading skeleton */}
            {generateMutation.isPending && (
              <div className="space-y-3">
                <CardSkeleton height={88} />
                <CardSkeleton height={88} />
                <CardSkeleton height={88} />
              </div>
            )}

            {/* Route results */}
            {!generateMutation.isPending && routes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">
                  {routes.length} Routes — select one
                </h3>
                {routes.map((route, idx) => {
                  const isSelected = selectedIndex === idx;
                  const primaryMode = route.routeDirections[0]?.state ?? "land";
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-blue-50 border-blue-500 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${modeColor(primaryMode)}`}>
                            {modeLabel(primaryMode)}
                          </span>
                          {route.tag === "popular" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              Popular
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {route.totalDistance?.toFixed(0)} km
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-2">
                        <div>
                          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mb-0.5">
                            <DollarSign className="w-3 h-3" /> Cost
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            ${route.totalCost?.toFixed(0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mb-0.5">
                            <Clock className="w-3 h-3" /> Time
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {route.totalTimeDaysRange ?? `${route.totalTime?.toFixed(0)}h`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mb-0.5">
                            <Leaf className="w-3 h-3" /> CO2
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {route.totalCarbonScore?.toFixed(0)} kg
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state — no routes yet */}
            {!generateMutation.isPending && routes.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <RouteIcon className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-600">No routes planned yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Enter an origin and destination above, then click Plan Route.
                </p>
              </div>
            )}
          </div>

          {/* Right: map + active shipments */}
          <div className="lg:col-span-7 space-y-6">

            {/* Route visualization */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" /> Route Visualization
              </h3>
              <MapView
                inlineRoutes={selectedRoute ? selectedRoute.routeDirections.map((d) => ({
                  id: d.id,
                  waypoints: d.waypoints,
                  state: d.state as "land" | "sea" | "air",
                })) : undefined}
              />

              {/* Selected route detail strip */}
              {selectedRoute && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                    Route legs
                  </p>
                  <div className="space-y-1.5">
                    {selectedRoute.routeDirections.map((leg, i) => (
                      <div key={leg.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${modeColor(leg.state)}`}>
                          {modeLabel(leg.state)}
                        </span>
                        <span className="truncate">
                          {leg.waypoints[0]} → {leg.waypoints[leg.waypoints.length - 1]}
                        </span>
                        {selectedRoute.distanceByLeg[i] !== undefined && (
                          <span className="ml-auto shrink-0 text-slate-400">
                            {selectedRoute.distanceByLeg[i].toFixed(0)} km
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p className="text-slate-400">Total Distance</p>
                      <p className="font-bold text-slate-700">{selectedRoute.totalDistance?.toFixed(0)} km</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Est. Cost</p>
                      <p className="font-bold text-slate-700">${selectedRoute.totalCost?.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Carbon</p>
                      <p className="font-bold text-emerald-600">{selectedRoute.totalCarbonScore?.toFixed(0)} kg CO2</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active shipments — live tracking */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" /> Active Shipments
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Toggle live tracking on any saved route.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RefreshCcw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {historyQuery.isLoading ? (
                <div className="space-y-2">
                  <CardSkeleton height={48} />
                  <CardSkeleton height={48} />
                </div>
              ) : historyQuery.error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                  Failed to load shipments.{" "}
                  <button onClick={() => historyQuery.refetch()} className="underline">
                    Retry
                  </button>
                </div>
              ) : savedRoutes.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Wind className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No saved routes yet. Plan and save a route to track it here.</p>
                </div>
              ) : (
                <div>
                  {savedRoutes.map((route) => (
                    <LiveTrackingRow key={route._id} route={route} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
