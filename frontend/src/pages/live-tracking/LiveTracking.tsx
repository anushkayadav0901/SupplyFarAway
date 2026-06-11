import { useState } from "react";
import { toast } from "react-toastify";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

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

export default function LiveTracking() {
  // ── Ping form state ────────────────────────────────────────────────────────
  const [draftId, setDraftId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [speedKmh, setSpeedKmh] = useState("40");
  const [destinationLat, setDestinationLat] = useState("");
  const [destinationLng, setDestinationLng] = useState("");

  // ── Query controls ─────────────────────────────────────────────────────────
  const [queryDraftId, setQueryDraftId] = useState("");
  const [activeQueryDraftId, setActiveQueryDraftId] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState("50");

  // ── Latest ping result (returned from mutation) ────────────────────────────
  const [latestPing, setLatestPing] = useState<PingResult | null>(null);

  // ── tRPC ───────────────────────────────────────────────────────────────────
  const pingMutation = trpc.tracking.ping.useMutation({
    onSuccess: (data) => {
      setLatestPing(data as unknown as PingResult);
      toast.success("Location ping saved successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send ping.");
    },
  });

  const latestQuery = trpc.tracking.latest.useQuery(
    { draftId: activeQueryDraftId ?? "" },
    {
      enabled: Boolean(activeQueryDraftId),
      retry: false,
    }
  );

  const historyQuery = trpc.tracking.history.useQuery(
    {
      draftId: activeQueryDraftId ?? "",
      limit: parseInt(historyLimit, 10) || 50,
    },
    {
      enabled: Boolean(activeQueryDraftId),
      retry: false,
    }
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryDraftId.trim()) {
      toast.error("Please enter a Draft ID to query.");
      return;
    }
    setActiveQueryDraftId(queryDraftId.trim());
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Live Tracking & ETA" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* ── Post a Location Ping ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Post Location Ping</h2>
          <p className="text-sm text-gray-500 mb-6">
            Send your current coordinates. The system computes distance and ETA to the destination.
          </p>

          <form onSubmit={handlePingSubmit} className="space-y-5">
            {/* Draft ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Draft ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="e.g. 6650a1b2c3d4e5f6a7b8c9d0"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            {/* Current position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Current Latitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 40.7128"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Current Longitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="e.g. -74.0060"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Use browser geolocation */}
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 transition-colors"
            >
              Use my current location
            </button>

            {/* Speed */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Speed (km/h)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={speedKmh}
                onChange={(e) => setSpeedKmh(e.target.value)}
                placeholder="Default: 40"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Destination Latitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={destinationLat}
                  onChange={(e) => setDestinationLat(e.target.value)}
                  placeholder="e.g. 51.5074"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Destination Longitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={destinationLng}
                  onChange={(e) => setDestinationLng(e.target.value)}
                  placeholder="e.g. -0.1278"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pingMutation.isPending}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {pingMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Ping"
              )}
            </button>
          </form>

          {/* Ping result card */}
          {latestPing && (
            <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h3 className="text-sm font-bold text-emerald-700 mb-3 uppercase tracking-wide">
                Ping Recorded
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Distance" value={`${latestPing.distanceKm.toFixed(2)} km`} />
                <Stat label="ETA" value={formatEta(latestPing.etaMinutes)} highlight />
                <Stat label="Speed" value={`${latestPing.speedKmh} km/h`} />
                <Stat label="Lat" value={latestPing.lat.toFixed(5)} />
                <Stat label="Lng" value={latestPing.lng.toFixed(5)} />
                <Stat label="At" value={formatDate(latestPing.createdAt)} />
              </div>
            </div>
          )}
        </section>

        {/* ── Query Tracking History ───────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Query Tracking Data</h2>
          <p className="text-sm text-gray-500 mb-6">
            Look up the latest ping or full history for a shipment draft.
          </p>

          <form onSubmit={handleQuerySubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              value={queryDraftId}
              onChange={(e) => setQueryDraftId(e.target.value)}
              placeholder="Enter Draft ID"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Limit:</label>
              <input
                type="number"
                min="1"
                max="200"
                value={historyLimit}
                onChange={(e) => setHistoryLimit(e.target.value)}
                className="w-20 px-3 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors"
            >
              Load Data
            </button>
          </form>

          {activeQueryDraftId && (
            <div className="space-y-6">
              {/* Latest ping */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Latest Ping for <span className="text-blue-600">{activeQueryDraftId}</span>
                </h3>

                {latestQuery.isLoading && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    Loading...
                  </div>
                )}

                {latestQuery.error && (
                  <p className="text-sm text-red-500 py-2">
                    {latestQuery.error.message}
                  </p>
                )}

                {latestQuery.data && !latestQuery.isLoading && (
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Stat
                        label="Distance Remaining"
                        value={`${(latestQuery.data as unknown as PingResult).distanceKm.toFixed(2)} km`}
                      />
                      <Stat
                        label="ETA"
                        value={formatEta((latestQuery.data as unknown as PingResult).etaMinutes)}
                        highlight
                      />
                      <Stat
                        label="Speed"
                        value={`${(latestQuery.data as unknown as PingResult).speedKmh} km/h`}
                      />
                      <Stat
                        label="Position"
                        value={`${(latestQuery.data as unknown as PingResult).lat.toFixed(4)}, ${(latestQuery.data as unknown as PingResult).lng.toFixed(4)}`}
                      />
                      <Stat
                        label="Destination"
                        value={`${(latestQuery.data as unknown as PingResult).destinationLat.toFixed(4)}, ${(latestQuery.data as unknown as PingResult).destinationLng.toFixed(4)}`}
                      />
                      <Stat
                        label="Last Update"
                        value={formatDate((latestQuery.data as unknown as PingResult).createdAt)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Ping History
                </h3>

                {historyQuery.isLoading && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    Loading history...
                  </div>
                )}

                {historyQuery.error && (
                  <p className="text-sm text-red-500 py-2">
                    {historyQuery.error.message}
                  </p>
                )}

                {historyQuery.data && !historyQuery.isLoading && (
                  <>
                    {(historyQuery.data as unknown as PingResult[]).length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No history found for this draft.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                              <th className="px-4 py-3 text-left">#</th>
                              <th className="px-4 py-3 text-left">Time</th>
                              <th className="px-4 py-3 text-right">Lat</th>
                              <th className="px-4 py-3 text-right">Lng</th>
                              <th className="px-4 py-3 text-right">Speed (km/h)</th>
                              <th className="px-4 py-3 text-right">Distance (km)</th>
                              <th className="px-4 py-3 text-right">ETA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(historyQuery.data as unknown as PingResult[]).map((ping, idx) => (
                              <tr
                                key={ping._id ?? idx}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                  {formatDate(ping.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {ping.lat.toFixed(5)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {ping.lng.toFixed(5)}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {ping.speedKmh}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {ping.distanceKm.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                  {formatEta(ping.etaMinutes)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-xs text-gray-400 px-4 py-2">
                          Showing {(historyQuery.data as unknown as PingResult[]).length} pings, oldest first.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Small helper component ─────────────────────────────────────────────────────
function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-emerald-700 text-base" : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
