import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Polyline,
} from "@react-google-maps/api";
import { Clock, MapPin, Navigation, RefreshCcw } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
const MAP_LIBRARIES: ("geometry")[] = ["geometry"];

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

function formatEta(minutes: number): string {
  if (minutes < 1) return "< 1 minute";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleString();
}

// ---------------------------------------------------------------------------
// EtaRing — circular countdown ring around a clock icon
// ---------------------------------------------------------------------------

function EtaRing({ minutes }: { minutes: number }) {
  const cap = 240; // 4 hours = full ring
  const pct = Math.max(0, Math.min(1, 1 - Math.min(minutes, cap) / cap));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
        <circle
          cx="42"
          cy="42"
          r={r}
          stroke="#e2e8f0"
          strokeWidth="6"
          fill="none"
        />
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
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Clock className="w-4 h-4 text-blue-600 mb-0.5" />
        <span className="text-[10px] font-bold text-slate-700 leading-tight">
          {formatEta(minutes)}
        </span>
      </div>
    </div>
  );
}

const mapContainerStyle = { width: "100%", height: "100%" };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function LiveTracking() {
  const [draftId, setDraftId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [speedKmh, setSpeedKmh] = useState("40");
  const [destinationLat, setDestinationLat] = useState("");
  const [destinationLng, setDestinationLng] = useState("");
  const [latestPing, setLatestPing] = useState<PingResult | null>(null);

  const utils = trpc.useUtils();

  const pingMutation = trpc.tracking.ping.useMutation({
    onSuccess: (data) => {
      setLatestPing(data as unknown as PingResult);
      toast.success("Location ping saved.");
      utils.tracking.latest.invalidate();
      utils.tracking.history.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send ping.");
    },
  });

  const latestQuery = trpc.tracking.latest.useQuery(
    { draftId: draftId },
    {
      enabled: Boolean(draftId.trim()),
      retry: false,
    }
  );

  const historyQuery = trpc.tracking.history.useQuery(
    { draftId, limit: 50 },
    { enabled: Boolean(draftId.trim()), retry: false }
  );

  // When draftId changes, refresh latestPing from the query if available
  useEffect(() => {
    if (latestQuery.data) {
      setLatestPing(latestQuery.data as unknown as PingResult);
      const p = latestQuery.data as unknown as PingResult;
      // Mirror destination fields so Advance works without re-typing
      setDestinationLat(String(p.destinationLat));
      setDestinationLng(String(p.destinationLng));
    }
  }, [latestQuery.data]);

  const handlePingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedSpeed = parseFloat(speedKmh);
    const parsedDestLat = parseFloat(destinationLat);
    const parsedDestLng = parseFloat(destinationLng);

    if (
      !draftId.trim() ||
      isNaN(parsedLat) ||
      isNaN(parsedLng) ||
      isNaN(parsedDestLat) ||
      isNaN(parsedDestLng)
    ) {
      toast.error("Please fill in all required fields with valid values.");
      return;
    }

    pingMutation.mutate({
      draftId: draftId.trim(),
      lat: parsedLat,
      lng: parsedLng,
      speedKmh: isNaN(parsedSpeed) ? 40 : parsedSpeed,
      destinationLat: parsedDestLat,
      destinationLng: parsedDestLng,
    });
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
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
  };

  // Advance the truck toward the destination by ~0.005 deg per click
  const handleAdvance = () => {
    if (!latestPing) {
      toast.info("Send an initial ping first.");
      return;
    }
    const stepDeg = 0.005;
    const dLat = latestPing.destinationLat - latestPing.lat;
    const dLng = latestPing.destinationLng - latestPing.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 1e-6) {
      toast.info("Already at destination.");
      return;
    }
    const nextLat = latestPing.lat + (dLat / dist) * stepDeg;
    const nextLng = latestPing.lng + (dLng / dist) * stepDeg;

    pingMutation.mutate({
      draftId: latestPing.draftId,
      lat: nextLat,
      lng: nextLng,
      speedKmh: latestPing.speedKmh,
      destinationLat: latestPing.destinationLat,
      destinationLng: latestPing.destinationLng,
    });
  };

  const mapCenter = useMemo(() => {
    if (latestPing) {
      return {
        lat: (latestPing.lat + latestPing.destinationLat) / 2,
        lng: (latestPing.lng + latestPing.destinationLng) / 2,
      };
    }
    return { lat: 37.7749, lng: -122.4194 };
  }, [latestPing]);

  const polylinePath = useMemo(() => {
    if (!latestPing) return [];
    return [
      { lat: latestPing.lat, lng: latestPing.lng },
      {
        lat: latestPing.destinationLat,
        lng: latestPing.destinationLng,
      },
    ];
  }, [latestPing]);

  const history = (historyQuery.data as unknown as PingResult[] | undefined) ?? [];

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Live Tracking & ETA" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Map + ETA */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Live Position
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {latestPing
                      ? `Tracking draft ${latestPing.draftId.slice(0, 8)}…`
                      : "Send a ping below or pick a draft to load its latest position."}
                  </p>
                </div>
                <DraftPicker value={draftId} onSelect={setDraftId} />
              </div>
              <div className="h-72 sm:h-96 bg-slate-100 relative">
                {!MAPS_KEY ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                    <MapPin className="w-6 h-6" />
                    <p>Map unavailable — set VITE_GOOGLE_API_KEY to enable.</p>
                  </div>
                ) : (
                  <LoadScript
                    googleMapsApiKey={MAPS_KEY}
                    libraries={MAP_LIBRARIES}
                  >
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={mapCenter}
                      zoom={latestPing ? 9 : 4}
                      options={mapOptions}
                    >
                      {latestPing && (
                        <>
                          <Marker
                            position={{
                              lat: latestPing.lat,
                              lng: latestPing.lng,
                            }}
                            label={{
                              text: "T",
                              color: "white",
                              fontWeight: "bold",
                              fontSize: "11px",
                            }}
                          />
                          <Marker
                            position={{
                              lat: latestPing.destinationLat,
                              lng: latestPing.destinationLng,
                            }}
                            label={{
                              text: "D",
                              color: "white",
                              fontWeight: "bold",
                              fontSize: "11px",
                            }}
                          />
                          <Polyline
                            path={polylinePath}
                            options={{
                              strokeColor: "#3b82f6",
                              strokeWeight: 4,
                              strokeOpacity: 0.85,
                              geodesic: true,
                            }}
                          />
                        </>
                      )}
                    </GoogleMap>
                  </LoadScript>
                )}

                {latestPing && (
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-md p-3 flex items-center gap-3">
                    <EtaRing minutes={latestPing.etaMinutes} />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Remaining
                      </p>
                      <p className="text-lg font-bold text-slate-800">
                        <CountUp
                          value={latestPing.distanceKm}
                          decimals={1}
                          suffix=" km"
                        />
                      </p>
                      <p className="text-xs text-slate-500">
                        <CountUp
                          value={latestPing.speedKmh}
                          decimals={1}
                        />{" "}
                        km/h
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {latestPing
                    ? `Last update: ${formatDate(latestPing.createdAt)}`
                    : "Awaiting first ping."}
                </p>
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={!latestPing || pingMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white shadow-sm flex items-center gap-2"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Advance toward destination
                </button>
              </div>
            </section>

            {/* Ping form */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-800 mb-1">
                Post Location Ping
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Send your current coordinates. The system computes distance and
                ETA to the destination.
              </p>

              <form onSubmit={handlePingSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Draft ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draftId}
                    onChange={(e) => setDraftId(e.target.value)}
                    placeholder="e.g. 6650a1b2c3d4e5f6a7b8c9d0"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Current Latitude <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="e.g. 40.7128"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Current Longitude <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="e.g. -74.0060"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 transition-colors"
                >
                  Use my current location
                </button>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Speed (km/h)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={speedKmh}
                    onChange={(e) => setSpeedKmh(e.target.value)}
                    placeholder="Default: 40"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Destination Latitude{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={destinationLat}
                      onChange={(e) => setDestinationLat(e.target.value)}
                      placeholder="e.g. 51.5074"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Destination Longitude{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={destinationLng}
                      onChange={(e) => setDestinationLng(e.target.value)}
                      placeholder="e.g. -0.1278"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.97 }}
                  disabled={pingMutation.isPending}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {pingMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Ping"
                  )}
                </motion.button>
              </form>
            </section>

            {/* History */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Ping History
                  </h2>
                  <p className="text-sm text-slate-500">
                    {draftId.trim()
                      ? `For draft ${draftId.slice(0, 8)}…`
                      : "Enter a draft above to load history."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {!draftId.trim() ? (
                <p className="text-sm text-slate-400">
                  Set a draft id to view ping history.
                </p>
              ) : historyQuery.isLoading ? (
                <div className="space-y-3">
                  <CardSkeleton height={56} />
                  <CardSkeleton height={56} />
                  <CardSkeleton height={56} />
                </div>
              ) : historyQuery.error ? (
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
                <p className="text-sm text-slate-400">
                  No history found for this draft.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Time</th>
                        <th className="px-4 py-3 text-right">Lat</th>
                        <th className="px-4 py-3 text-right">Lng</th>
                        <th className="px-4 py-3 text-right">Speed (km/h)</th>
                        <th className="px-4 py-3 text-right">Distance (km)</th>
                        <th className="px-4 py-3 text-right">ETA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <AnimatePresence initial>
                        {history.map((ping, idx) => (
                          <motion.tr
                            key={ping._id ?? idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {formatDate(ping.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {ping.lat.toFixed(5)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {ping.lng.toFixed(5)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {ping.speedKmh}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {ping.distanceKm.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                              {formatEta(ping.etaMinutes)}
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
