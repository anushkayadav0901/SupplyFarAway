import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Navigation,
  Compass,
  Clock,
  Play,
  RefreshCcw,
  Route as RouteIcon,
} from "lucide-react";
import Header from "../../components/Header";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// Bounding box for US for visual canvas map representation
const LAT_MIN = 24;
const LAT_MAX = 50;
const LNG_MIN = -125;
const LNG_MAX = -66;
const ETA_RING_CAP_MINUTES = 240;
const ADVANCE_STEP_DEG = 0.005;
const ADVANCE_RATE_LIMIT_MS = 1000;

interface Route {
  id: string;
  name: string;
  distanceKm: number;
  durationHours: number;
  costEstimate: number;
  carbonKg: number;
  coordinates: [number, number][]; // lat, lng
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
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function fmtDateTime(d: string | Date): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCoord(n: number): string {
  return n.toFixed(5);
}

function fmtDist(km: number): string {
  return km.toFixed(2) + " km";
}

// ---------------------------------------------------------------------------
// EtaRing Subcomponent
// ---------------------------------------------------------------------------
function EtaRing({ minutes }: { minutes: number }) {
  const shouldReduceMotion = useReducedMotion();
  const pct = Math.max(
    0,
    Math.min(1, 1 - Math.min(minutes, ETA_RING_CAP_MINUTES) / ETA_RING_CAP_MINUTES)
  );
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative w-18 h-18" aria-label={`ETA: ${fmtEta(minutes)}`}>
      <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={r} stroke="#e2e8f0" strokeWidth="4" fill="none" />
        <motion.circle
          cx="36"
          cy="36"
          r={r}
          stroke="#3b82f6"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: shouldReduceMotion ? offset : offset }}
          transition={{ duration: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Clock className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
        <span className="text-[9px] font-black text-slate-700 leading-none text-center">
          {fmtEta(minutes)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function RoutePlanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftId, setDraftId] = useState<string>(searchParams.get("draftId") ?? "");
  const [origin, setOrigin] = useState("Chicago, IL");
  const [destination, setDestination] = useState("Detroit, MI");
  
  // Tracking simulation states
  const [simLat, setSimLat] = useState("");
  const [simLng, setSimLng] = useState("");
  const [simSpeed, setSimSpeed] = useState("60");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAdvanceRef = useRef<number>(0);
  const seededDestForDraftRef = useRef<string | null>(null);
  
  const utils = trpc.useUtils();

  // URL Query Sync
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params);
  }, [draftId, setSearchParams]);

  // Clear pings or seed on draft ID swap
  useEffect(() => {
    seededDestForDraftRef.current = null;
  }, [draftId]);

  // Mutations
  const generateMutation = trpc.logistics.generateRoutes.useMutation({
    onSuccess: (data: any) => {
      toast.success("Routes generated.");
      const items: Route[] = data.routes.map((r: any, idx: number) => ({
        id: String(idx),
        name: r.name || `Route Choice ${idx + 1}`,
        distanceKm: r.distanceKm || 300,
        durationHours: r.durationHours || 5,
        costEstimate: r.costEstimate || 150,
        carbonKg: r.carbonKg || r.distanceKm * 0.12 || 35,
        coordinates: r.path || [[41.8781, -87.6298], [42.3314, -83.0458]],
      }));
      setRoutes(items);
      setSelectedRouteIndex(0);

      // Auto-populate simulation destination coordinates
      const targetRoute = items[0];
      if (targetRoute && targetRoute.coordinates.length > 0) {
        const last = targetRoute.coordinates[targetRoute.coordinates.length - 1];
        if (last) {
          setDestLat(String(last[0]));
          setDestLng(String(last[1]));
        }
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate routes.");
    },
  });

  const pingMutation = trpc.tracking.ping.useMutation({
    onSuccess: () => {
      toast.success("Location ping updated.");
      setSimLat("");
      setSimLng("");
      if (draftId) {
        utils.tracking.latest.invalidate({ draftId }).catch(() => null);
        utils.tracking.history.invalidate({ draftId, limit: 50 }).catch(() => null);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit location ping.");
    },
  });

  // Queries
  const latestPingQuery = trpc.tracking.latest.useQuery(
    { draftId },
    { enabled: Boolean(draftId), retry: false, refetchInterval: 5000 }
  );

  const historyQuery = trpc.tracking.history.useQuery(
    { draftId, limit: 50 },
    { enabled: Boolean(draftId), retry: false, refetchInterval: 10000 }
  );

  const latestPing = (latestPingQuery.data as PingResult | undefined) ?? null;
  const history = (historyQuery.data as unknown as PingResult[] | undefined) ?? [];

  // Seed destination once from latest ping if available
  useEffect(() => {
    if (latestPing && seededDestForDraftRef.current !== latestPing.draftId) {
      setDestLat(String(latestPing.destinationLat));
      setDestLng(String(latestPing.destinationLng));
      seededDestForDraftRef.current = latestPing.draftId;
    }
  }, [latestPing]);

  const handlePlanRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    await generateMutation.mutateAsync({
      origin: origin.trim(),
      destination: destination.trim(),
    });
  };

  const handleSendPing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftId) {
      toast.error("Please select a Draft ID first.");
      return;
    }
    const latNum = parseFloat(simLat);
    const lngNum = parseFloat(simLng);
    const dLat = parseFloat(destLat) || 42.3314;
    const dLng = parseFloat(destLng) || -83.0458;

    if (isNaN(latNum) || isNaN(lngNum)) {
      toast.error("Valid Latitude and Longitude are required.");
      return;
    }

    await pingMutation.mutateAsync({
      draftId,
      lat: latNum,
      lng: lngNum,
      speedKmh: parseFloat(simSpeed) || 60,
      destinationLat: dLat,
      destinationLng: dLng,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSimLat(pos.coords.latitude.toString());
        setSimLng(pos.coords.longitude.toString());
        toast.success("GPS coordinates loaded.");
      },
      () => {
        toast.error("Failed to fetch GPS coordinates.");
      }
    );
  };

  const handleAdvance = () => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < ADVANCE_RATE_LIMIT_MS) {
      toast.info("Please wait a moment before advancing again.");
      return;
    }
    if (!latestPing) {
      toast.info("Send an initial ping first.");
      return;
    }
    const deltaLat = latestPing.destinationLat - latestPing.lat;
    const deltaLng = latestPing.destinationLng - latestPing.lng;
    const dist = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
    if (dist < 1e-6) {
      toast.info("Already at destination.");
      return;
    }
    lastAdvanceRef.current = now;
    const nextLat = latestPing.lat + (deltaLat / dist) * ADVANCE_STEP_DEG;
    const nextLng = latestPing.lng + (deltaLng / dist) * ADVANCE_STEP_DEG;

    pingMutation.mutate({
      draftId: latestPing.draftId,
      lat: nextLat,
      lng: nextLng,
      speedKmh: latestPing.speedKmh,
      destinationLat: latestPing.destinationLat,
      destinationLng: latestPing.destinationLng,
    });
  };

  // Canvas map renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, W, H);

    // Draw grid background
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 50) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 50) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    const toX = (lng: number) => ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
    const toY = (lat: number) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    // Draw calculated routes
    routes.forEach((route, idx) => {
      const isSelected = selectedRouteIndex === idx;
      ctx.beginPath();
      route.coordinates.forEach(([lat, lng], i) => {
        const x = clamp(toX(lng), 10, W - 10);
        const y = clamp(toY(lat), 10, H - 10);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = isSelected ? "#3b82f6" : "#94a3b8";
      ctx.lineWidth = isSelected ? 4 : 2;
      if (!isSelected) ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw live tracking truck location
    if (latestPing) {
      const tx = clamp(toX(latestPing.lng), 10, W - 10);
      const ty = clamp(toY(latestPing.lat), 10, H - 10);
      const dx = clamp(toX(latestPing.destinationLng), 10, W - 10);
      const dy = clamp(toY(latestPing.destinationLat), 10, H - 10);

      // Destination Dot
      ctx.beginPath();
      ctx.arc(dx, dy, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("D", dx, dy);

      // Truck Dot
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText("T", tx, ty);
    }
  }, [routes, selectedRouteIndex, latestPing]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Route Planning &amp; Tracking" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        
        {/* Context Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Operational Context</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select an active shipment/draft to execute tracking or associate optimization results.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Active Draft:</span>
            <DraftPicker value={draftId} onSelect={setDraftId} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: Route generator form & simulation controls */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Route Planning Form */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-600" /> Plan Corridor Path
              </h3>
              <form onSubmit={handlePlanRoute} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Origin</label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Destination</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                >
                  {generateMutation.isPending ? "Generating Paths..." : "Optimize Routes"}
                </button>
              </form>
            </div>

            {/* Generated Routes list */}
            {routes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Available Corridor Paths</h3>
                {routes.map((route, idx) => {
                  const isSelected = selectedRouteIndex === idx;
                  return (
                    <div
                      key={route.id}
                      onClick={() => setSelectedRouteIndex(idx)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? "bg-blue-50/50 border-blue-500 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">{route.name}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{route.distanceKm.toFixed(0)} km</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center border-t border-slate-100 pt-2 text-xs">
                        <div>
                          <p className="text-slate-400">Duration</p>
                          <p className="font-bold text-slate-700">{route.durationHours} hrs</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Cost</p>
                          <p className="font-bold text-slate-700">${route.costEstimate}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Carbon</p>
                          <p className="font-bold text-slate-700">{route.carbonKg.toFixed(0)} kg</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tracking Simulation Form */}
            {draftId && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Play className="w-5 h-5 text-blue-600" /> GPS Simulation (Driver Ping)
                </h3>
                <form onSubmit={handleSendPing} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 41.8781"
                        value={simLat}
                        onChange={(e) => setSimLat(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. -87.6298"
                        value={simLng}
                        onChange={(e) => setSimLng(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Dest Latitude</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 42.3314"
                        value={destLat}
                        onChange={(e) => setDestLat(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Dest Longitude</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. -83.0458"
                        value={destLng}
                        onChange={(e) => setDestLng(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Speed (km/h)</label>
                    <input
                      type="number"
                      value={simSpeed}
                      onChange={(e) => setSimSpeed(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-xs text-blue-600 font-semibold underline underline-offset-2"
                    >
                      Use Device GPS
                    </button>
                    <button
                      type="button"
                      onClick={handleAdvance}
                      disabled={!latestPing || pingMutation.isPending}
                      className="text-xs text-slate-600 hover:text-slate-800 font-semibold underline underline-offset-2 disabled:text-slate-400"
                    >
                      Step Advance
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={pingMutation.isPending}
                    className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
                  >
                    {pingMutation.isPending ? "Pinging..." : "Post Position Ping"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right panel: Map & History logs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Canvas Map Overlay */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
              <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" /> Route Corridor Visualization
              </h3>
              <div className="relative aspect-video w-full border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-cover" />
                
                {/* ETA circle floating card */}
                {latestPing && (
                  <div className="absolute top-3 right-3 bg-white/95 rounded-2xl border border-slate-200 shadow-md p-3 flex items-center gap-3">
                    <EtaRing minutes={latestPing.etaMinutes} />
                    <div className="text-xs">
                      <p className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Remaining</p>
                      <p className="font-black text-slate-800 text-base">{fmtDist(latestPing.distanceKm)}</p>
                      <p className="text-slate-500">{latestPing.speedKmh.toFixed(0)} km/h speed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ping History Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Location Log History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {draftId ? `Scan record for ${draftId.slice(0, 8)}…` : "Select a draft to load ping logs"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch()}
                  disabled={!draftId}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <RefreshCcw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {!draftId ? (
                <div className="py-8 text-center text-slate-400">
                  <RouteIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Operational context is required to query ping logs.</p>
                </div>
              ) : historyQuery.isLoading ? (
                <div className="space-y-2">
                  <CardSkeleton height={40} />
                  <CardSkeleton height={40} />
                </div>
              ) : historyQuery.error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-medium">
                  Failed to load logs. <button onClick={() => historyQuery.refetch()} className="underline text-red-800">Retry</button>
                </div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No GPS simulation logs recorded yet for this corridor.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="min-w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase border-b border-slate-200">
                        <th className="px-3 py-2">Index</th>
                        <th className="px-3 py-2">Logged Time</th>
                        <th className="px-3 py-2 text-right">Latitude</th>
                        <th className="px-3 py-2 text-right">Longitude</th>
                        <th className="px-3 py-2 text-right">Speed</th>
                        <th className="px-3 py-2 text-right">Distance</th>
                        <th className="px-3 py-2 text-right text-blue-600">ETA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((ping, idx) => (
                        <tr key={ping._id ?? idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(ping.createdAt)}</td>
                          <td className="px-3 py-2 text-right text-slate-700 font-mono">{fmtCoord(ping.lat)}</td>
                          <td className="px-3 py-2 text-right text-slate-700 font-mono">{fmtCoord(ping.lng)}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{ping.speedKmh} km/h</td>
                          <td className="px-3 py-2 text-right text-slate-700">{fmtDist(ping.distanceKm)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-600">{fmtEta(ping.etaMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
