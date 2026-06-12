import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import {
  Clock,
  MapPin,
  Navigation,
  RefreshCcw,
  Route,
} from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ETA_RING_CAP_MINUTES = 240; // 4 hours = full ring
const DEFAULT_SPEED_KMH = 40;
const ADVANCE_STEP_DEG = 0.005;
const ADVANCE_RATE_LIMIT_MS = 1000; // 1 click per second
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }; // San Francisco

// Env key — supports both VITE_GOOGLE_MAPS_KEY and legacy VITE_GOOGLE_API_KEY
const MAPS_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ||
  "";

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
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
// Types
// ---------------------------------------------------------------------------

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
// EtaRing — circular countdown ring around a clock icon
// ---------------------------------------------------------------------------

function EtaRing({ minutes }: { minutes: number }) {
  const shouldReduceMotion = useReducedMotion();
  const pct = Math.max(
    0,
    Math.min(1, 1 - Math.min(minutes, ETA_RING_CAP_MINUTES) / ETA_RING_CAP_MINUTES)
  );
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div
      className="relative w-24 h-24"
      aria-label={`ETA: ${fmtEta(minutes)}`}
    >
      <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="42" cy="42" r={r} stroke="#e2e8f0" strokeWidth="6" fill="none" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          stroke="#3b82f6"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: shouldReduceMotion ? offset : offset }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Clock className="w-4 h-4 text-blue-600 mb-0.5" aria-hidden="true" />
        <span className="text-[10px] font-bold text-slate-700 leading-tight text-center px-1">
          {fmtEta(minutes)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StaticMapFallback — rendered when MAPS_KEY is absent (V3 / live-tracking
// specific extra directive). Canvas with labeled cities and a route line.
// ---------------------------------------------------------------------------

interface StaticCity {
  label: string;
  x: number;
  y: number;
  isTruck?: boolean;
  isDest?: boolean;
}

function StaticMapFallback({ ping }: { ping: PingResult | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background gradient (C2)
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#f0f9ff");
    bg.addColorStop(1, "#ecfdf5");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 60) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 60) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    // Default city positions for reference
    const staticCities: StaticCity[] = [
      { label: "New York", x: 0.75 * W, y: 0.35 * H },
      { label: "Chicago", x: 0.5 * W, y: 0.3 * H },
      { label: "Los Angeles", x: 0.15 * W, y: 0.55 * H },
      { label: "Houston", x: 0.45 * W, y: 0.7 * H },
      { label: "Miami", x: 0.7 * W, y: 0.75 * H },
    ];

    if (ping) {
      // Normalize lat/lng to canvas coordinates.
      // Approximate bounding box: lat 24–50, lng -125 to -66
      const latMin = 24, latMax = 50, lngMin = -125, lngMax = -66;
      const toX = (lng: number) => ((lng - lngMin) / (lngMax - lngMin)) * W;
      const toY = (lat: number) => ((latMax - lat) / (latMax - latMin)) * H;

      const tx = toX(ping.lng);
      const ty = toY(ping.lat);
      const dx = toX(ping.destinationLng);
      const dy = toY(ping.destinationLat);

      // Route line
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(dx, dy);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Truck dot
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("T", tx, ty);

      // Destination dot
      ctx.beginPath();
      ctx.arc(dx, dy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText("D", dx, dy);

      // Labels
      ctx.fillStyle = "#334155";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Truck", tx + 12, ty);
      ctx.fillText("Destination", dx + 12, dy);
    } else {
      // Draw static reference cities
      staticCities.forEach(({ label, x, y }) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#94a3b8";
        ctx.fill();
        ctx.fillStyle = "#475569";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(label, x + 8, y + 4);
      });
    }
  }, [ping]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        width={640}
        height={384}
        className="w-full h-full"
        aria-label="Static map fallback"
      />
      <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-slate-500 flex items-center gap-1">
        <MapPin className="w-3 h-3" aria-hidden="true" />
        Map preview — set VITE_GOOGLE_MAPS_KEY to enable live maps
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GoogleMapView — lazy-loaded only when key is present (avoids script injection
// when key is missing, which would silently fail)
// ---------------------------------------------------------------------------

interface GoogleMapViewProps {
  ping: PingResult;
}

function GoogleMapView({ ping }: GoogleMapViewProps) {
  // Dynamic import to avoid bundling @react-google-maps/api when unused.
  // We render a tiny wrapper that lazy-loads the library via LoadScript.
  // Re-use the already-imported types via inline JSX.
  const [Lib, setLib] = useState<null | {
    LoadScript: React.ComponentType<React.PropsWithChildren<{ googleMapsApiKey: string; libraries?: string[] }>>;
    GoogleMap: React.ComponentType<React.PropsWithChildren<{ mapContainerStyle: React.CSSProperties; center: { lat: number; lng: number }; zoom: number; options?: object }>>;
    Marker: React.ComponentType<{ position: { lat: number; lng: number }; label?: object }>;
    Polyline: React.ComponentType<{ path: { lat: number; lng: number }[]; options?: object }>;
  }>(null);
  const [libError, setLibError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@react-google-maps/api")
      .then((mod) => {
        if (!cancelled) {
          setLib({
            LoadScript: mod.LoadScript as unknown as GoogleMapViewProps["ping"] extends infer _P
              ? React.ComponentType<React.PropsWithChildren<{ googleMapsApiKey: string; libraries?: string[] }>>
              : never,
            GoogleMap: mod.GoogleMap as unknown as React.ComponentType<
              React.PropsWithChildren<{
                mapContainerStyle: React.CSSProperties;
                center: { lat: number; lng: number };
                zoom: number;
                options?: object;
              }>
            >,
            Marker: mod.Marker as unknown as React.ComponentType<{
              position: { lat: number; lng: number };
              label?: object;
            }>,
            Polyline: mod.Polyline as unknown as React.ComponentType<{
              path: { lat: number; lng: number }[];
              options?: object;
            }>,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLibError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (libError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
        <MapPin className="w-6 h-6" aria-hidden="true" />
        <p>Failed to load Google Maps library.</p>
      </div>
    );
  }

  if (!Lib) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"
          aria-label="Loading map"
        />
      </div>
    );
  }

  const center = {
    lat: (ping.lat + ping.destinationLat) / 2,
    lng: (ping.lng + ping.destinationLng) / 2,
  };
  const path = [
    { lat: ping.lat, lng: ping.lng },
    { lat: ping.destinationLat, lng: ping.destinationLng },
  ];
  const mapStyle = { width: "100%", height: "100%" };
  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
    ],
  };

  const { LoadScript, GoogleMap, Marker, Polyline } = Lib;
  return (
    <LoadScript googleMapsApiKey={MAPS_KEY} libraries={["geometry"]}>
      <GoogleMap
        mapContainerStyle={mapStyle}
        center={center}
        zoom={9}
        options={mapOptions}
      >
        <Marker
          position={{ lat: ping.lat, lng: ping.lng }}
          label={{ text: "T", color: "white", fontWeight: "bold", fontSize: "11px" }}
        />
        <Marker
          position={{ lat: ping.destinationLat, lng: ping.destinationLng }}
          label={{ text: "D", color: "white", fontWeight: "bold", fontSize: "11px" }}
        />
        <Polyline
          path={path}
          options={{
            strokeColor: "#3b82f6",
            strokeWeight: 4,
            strokeOpacity: 0.85,
            geodesic: true,
          }}
        />
      </GoogleMap>
    </LoadScript>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function LiveTracking() {
  const [draftId, setDraftId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [speedKmh, setSpeedKmh] = useState(String(DEFAULT_SPEED_KMH));
  const [destinationLat, setDestinationLat] = useState("");
  const [destinationLng, setDestinationLng] = useState("");
  const [latestPing, setLatestPing] = useState<PingResult | null>(null);

  // Rate-limit for the Advance button: track timestamp of last click (V-live-tracking)
  const lastAdvanceRef = useRef<number>(0);

  const utils = trpc.useUtils();

  const pingMutation = trpc.tracking.ping.useMutation({
    onSuccess: (data) => {
      const p = data as unknown as PingResult;
      setLatestPing(p);
      toast.success("Location ping saved.");
      // Reset position fields after successful ping
      setLat("");
      setLng("");
      utils.tracking.latest.invalidate({ draftId }).catch(() => null);
      utils.tracking.history.invalidate({ draftId, limit: 50 }).catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send ping.");
    },
  });

  const latestQuery = trpc.tracking.latest.useQuery(
    { draftId },
    { enabled: Boolean(draftId.trim()), retry: false }
  );

  const historyQuery = trpc.tracking.history.useQuery(
    { draftId, limit: 50 },
    { enabled: Boolean(draftId.trim()), retry: false }
  );

  // Sync latest ping from query (V4: no stale closure issues)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!latestQuery.data) return;
    if (!mountedRef.current) return;
    const p = latestQuery.data as unknown as PingResult;
    setLatestPing(p);
    setDestinationLat(String(p.destinationLat));
    setDestinationLng(String(p.destinationLng));
  }, [latestQuery.data]);

  const handlePingSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const parsedSpeed = parseFloat(speedKmh);
      const parsedDestLat = parseFloat(destinationLat);
      const parsedDestLng = parseFloat(destinationLng);

      if (!draftId.trim()) {
        toast.error("Draft ID is required.");
        return;
      }
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        toast.error("Current latitude and longitude are required.");
        return;
      }
      if (isNaN(parsedDestLat) || isNaN(parsedDestLng)) {
        toast.error("Destination latitude and longitude are required.");
        return;
      }

      pingMutation.mutate({
        draftId: draftId.trim(),
        lat: parsedLat,
        lng: parsedLng,
        speedKmh: isNaN(parsedSpeed) || parsedSpeed < 0 ? DEFAULT_SPEED_KMH : parsedSpeed,
        destinationLat: parsedDestLat,
        destinationLng: parsedDestLng,
      });
    },
    [draftId, lat, lng, speedKmh, destinationLat, destinationLng, pingMutation]
  );

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        setLat(pos.coords.latitude.toString());
        setLng(pos.coords.longitude.toString());
        if (pos.coords.speed !== null && pos.coords.speed > 0) {
          setSpeedKmh((pos.coords.speed * 3.6).toFixed(1));
        }
        toast.success("Current location loaded.");
      },
      () => {
        toast.error("Unable to retrieve your location.");
      }
    );
  }, []);

  // Rate-limited advance (1 click per second — extra directive for live-tracking)
  const handleAdvance = useCallback(() => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < ADVANCE_RATE_LIMIT_MS) {
      toast.info("Please wait a moment before advancing again.");
      return;
    }
    if (!latestPing) {
      toast.info("Send an initial ping first.");
      return;
    }
    const dLat = latestPing.destinationLat - latestPing.lat;
    const dLng = latestPing.destinationLng - latestPing.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 1e-6) {
      toast.info("Already at destination.");
      return;
    }
    lastAdvanceRef.current = now;
    const nextLat = latestPing.lat + (dLat / dist) * ADVANCE_STEP_DEG;
    const nextLng = latestPing.lng + (dLng / dist) * ADVANCE_STEP_DEG;

    pingMutation.mutate({
      draftId: latestPing.draftId,
      lat: nextLat,
      lng: nextLng,
      speedKmh: latestPing.speedKmh,
      destinationLat: latestPing.destinationLat,
      destinationLng: latestPing.destinationLng,
    });
  }, [latestPing, pingMutation]);

  const mapCenter = useMemo(() => {
    if (!latestPing) return DEFAULT_CENTER;
    return {
      lat: (latestPing.lat + latestPing.destinationLat) / 2,
      lng: (latestPing.lng + latestPing.destinationLng) / 2,
    };
  }, [latestPing]);

  const history = useMemo(
    () => (historyQuery.data as unknown as PingResult[] | undefined) ?? [],
    [historyQuery.data]
  );

  // Suppress unused var warning — mapCenter used below
  void mapCenter;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Live Tracking & ETA" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">

            {/* Map + ETA card (C8: rounded-2xl) */}
            <section
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              aria-label="Live position map"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Live Position
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5" aria-live="polite">
                    {latestPing
                      ? `Tracking draft ${latestPing.draftId.slice(0, 8)}…`
                      : "Send a ping below or pick a draft to load its latest position."}
                  </p>
                </div>
                <DraftPicker value={draftId} onSelect={setDraftId} />
              </div>

              {/* Map area */}
              <div className="h-72 sm:h-96 bg-slate-100 relative">
                <AnimatePresence mode="wait">
                  {!MAPS_KEY ? (
                    <motion.div
                      key="static-map"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <StaticMapFallback ping={latestPing} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="google-map"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      {latestPing ? (
                        <GoogleMapView ping={latestPing} />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Route className="w-8 h-8" aria-hidden="true" />
                          <p className="text-sm">Send a ping to see the map.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ETA overlay — C1: glow effect on card */}
                {latestPing && (
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-md shadow-blue-100 p-3 flex items-center gap-3">
                    <EtaRing minutes={latestPing.etaMinutes} />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Remaining
                      </p>
                      <p className="text-lg font-bold text-slate-800">
                        {/* C6: animated count */}
                        <CountUp
                          value={latestPing.distanceKm}
                          decimals={1}
                          suffix=" km"
                        />
                      </p>
                      <p className="text-xs text-slate-500">
                        <CountUp value={latestPing.speedKmh} decimals={1} /> km/h
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer bar */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-slate-500" aria-live="polite">
                  {latestPing
                    ? `Last update: ${fmtDateTime(latestPing.createdAt)}`
                    : "Awaiting first ping."}
                </p>
                {/* Advance button — rate-limited (1/s), C1: glow on active */}
                <motion.button
                  type="button"
                  onClick={handleAdvance}
                  whileTap={{ scale: 0.96 }}
                  disabled={!latestPing || pingMutation.isPending}
                  aria-label="Advance truck toward destination by one step"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-200 disabled:bg-slate-300 text-white shadow-sm flex items-center gap-2 transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  Advance toward destination
                </motion.button>
              </div>
            </section>

            {/* Ping Form (C2: gradient header bg, C8: card style) */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-800 mb-1">
                Post Location Ping
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Send current coordinates. The system computes distance and ETA
                to the destination.
              </p>

              <form onSubmit={handlePingSubmit} className="space-y-5" noValidate>
                {/* Draft ID */}
                <div>
                  <label
                    htmlFor="lt-draftId"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Draft ID <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="lt-draftId"
                    type="text"
                    value={draftId}
                    onChange={(e) => setDraftId(e.target.value)}
                    placeholder="e.g. 6650a1b2c3d4e5f6a7b8c9d0"
                    maxLength={200}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                    aria-required="true"
                  />
                </div>

                {/* Current position */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="lt-lat"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Current Latitude{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="lt-lat"
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="e.g. 40.7128"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lt-lng"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Current Longitude{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="lt-lng"
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="e.g. -74.0060"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                      aria-required="true"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  aria-label="Use my current GPS location"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 transition-colors"
                >
                  Use my current location
                </button>

                {/* Speed */}
                <div>
                  <label
                    htmlFor="lt-speed"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Speed (km/h)
                  </label>
                  <input
                    id="lt-speed"
                    type="number"
                    step="any"
                    min="0"
                    value={speedKmh}
                    onChange={(e) => setSpeedKmh(e.target.value)}
                    placeholder={`Default: ${DEFAULT_SPEED_KMH}`}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Destination */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="lt-destLat"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Destination Latitude{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="lt-destLat"
                      type="number"
                      step="any"
                      value={destinationLat}
                      onChange={(e) => setDestinationLat(e.target.value)}
                      placeholder="e.g. 51.5074"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lt-destLng"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Destination Longitude{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="lt-destLng"
                      type="number"
                      step="any"
                      value={destinationLng}
                      onChange={(e) => setDestinationLng(e.target.value)}
                      placeholder="e.g. -0.1278"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                      aria-required="true"
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  disabled={pingMutation.isPending}
                  aria-label="Send location ping"
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-200 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all duration-150 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {pingMutation.isPending ? (
                    <>
                      <span
                        className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                        aria-hidden="true"
                      />
                      Sending…
                    </>
                  ) : (
                    "Send Ping"
                  )}
                </motion.button>
              </form>
            </section>

            {/* Ping History */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Ping History</h2>
                  <p className="text-sm text-slate-500">
                    {draftId.trim()
                      ? `For draft ${draftId.slice(0, 8)}…`
                      : "Enter a draft above to load history."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch()}
                  aria-label="Refresh ping history"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Refresh
                </button>
              </div>

              {!draftId.trim() ? (
                /* V2: empty state */
                <div className="flex flex-col items-center py-10 text-center">
                  <Route className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
                  <p className="text-sm text-slate-500">
                    Set a draft ID to view ping history.
                  </p>
                </div>
              ) : historyQuery.isLoading ? (
                <div className="space-y-3" aria-busy="true">
                  <CardSkeleton height={56} />
                  <CardSkeleton height={56} />
                  <CardSkeleton height={56} />
                </div>
              ) : historyQuery.error ? (
                /* V3: error + retry */
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-medium">
                    {historyQuery.error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => historyQuery.refetch()}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : history.length === 0 ? (
                /* V2: warm empty */
                <div className="flex flex-col items-center py-10 text-center">
                  <MapPin className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
                  <p className="text-sm text-slate-500 font-medium">
                    No pings found for this draft.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Send your first ping using the form above.
                  </p>
                </div>
              ) : (
                /* V8: overflow-x for mobile */
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm" role="table">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                        <th scope="col" className="px-4 py-3 text-left">#</th>
                        <th scope="col" className="px-4 py-3 text-left">Time</th>
                        <th scope="col" className="px-4 py-3 text-right">Lat</th>
                        <th scope="col" className="px-4 py-3 text-right">Lng</th>
                        <th scope="col" className="px-4 py-3 text-right">Speed (km/h)</th>
                        <th scope="col" className="px-4 py-3 text-right">Distance</th>
                        <th scope="col" className="px-4 py-3 text-right">ETA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <AnimatePresence initial={false}>
                        {history.map((ping, idx) => (
                          <motion.tr
                            key={ping._id ?? idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {fmtDateTime(ping.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {fmtCoord(ping.lat)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {fmtCoord(ping.lng)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {ping.speedKmh}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {fmtDist(ping.distanceKm)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                              {fmtEta(ping.etaMinutes)}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail
              draftId={draftId.trim() || undefined}
              title="Verification Activity"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
