import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { MapPin, Truck, RefreshCcw } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

interface LoadOffer {
  _id: string;
  originCity: string;
  destinationCity: string;
  weightKg: number;
  pickupDate: string | Date;
  status: string;
  notes?: string;
  createdAt: string | Date;
}

interface MatchResult extends LoadOffer {
  similarityScore: number;
}

const statusColors: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  matched: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// CorridorArc — animated SVG arc from origin → destination with a scan beam
// that sweeps across while matches are being computed.
// ---------------------------------------------------------------------------

function CorridorArc({
  origin,
  destination,
  scanning,
}: {
  origin: string;
  destination: string;
  scanning: boolean;
}) {
  return (
    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 px-5 py-4 overflow-hidden">
      <svg viewBox="0 0 400 100" className="w-full h-24">
        <defs>
          <linearGradient id="arcGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d="M 30 80 Q 200 0 370 80"
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="2.5"
          strokeDasharray="5,4"
        />
        {/* Scan beam — sweeps a vertical line across the arc */}
        {scanning && (
          <motion.rect
            y="0"
            height="100"
            width="2"
            fill="#3b82f6"
            opacity={0.55}
            initial={{ x: 30 }}
            animate={{ x: [30, 370, 30] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
        {/* Origin pin */}
        <circle cx="30" cy="80" r="6" fill="#3b82f6" />
        <circle cx="30" cy="80" r="3" fill="#fff" />
        {/* Destination pin */}
        <circle cx="370" cy="80" r="6" fill="#10b981" />
        <circle cx="370" cy="80" r="3" fill="#fff" />
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mt-1">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-blue-600" />
          {origin || "—"}
        </span>
        <span className="flex items-center gap-1">
          {destination || "—"}
          <MapPin className="w-3 h-3 text-emerald-600" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SimilarityRing — small circular SVG showing match %
// ---------------------------------------------------------------------------

function SimilarityRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative w-12 h-12">
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke="#e2e8f0"
          strokeWidth="4"
          fill="none"
        />
        <motion.circle
          cx="22"
          cy="22"
          r={r}
          stroke="#3b82f6"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function LoadAggregation() {
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();

  const createOffer = trpc.loadMatch.createOffer.useMutation({
    onSuccess: () => {
      toast.success("Load offer posted.");
      setOriginCity("");
      setDestinationCity("");
      setWeightKg("");
      setPickupDate("");
      setNotes("");
      utils.loadMatch.listMine.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create load offer.");
    },
  });

  const cancelOffer = trpc.loadMatch.cancel.useMutation({
    onSuccess: () => {
      toast.success("Offer cancelled.");
      utils.loadMatch.listMine.invalidate();
      if (selectedOfferId) {
        utils.loadMatch.findMatches.invalidate({ offerId: selectedOfferId });
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel offer.");
    },
  });

  const { data: myOffersData, isLoading: loadingOffers } =
    trpc.loadMatch.listMine.useQuery({});

  const { data: matchData, isLoading: loadingMatches } =
    trpc.loadMatch.findMatches.useQuery(
      { offerId: selectedOfferId! },
      { enabled: !!selectedOfferId }
    );

  const myOffers: LoadOffer[] =
    (myOffersData?.offers as unknown as LoadOffer[]) ?? [];
  const matches: MatchResult[] =
    (matchData?.matches as unknown as MatchResult[]) ?? [];

  // Run the scan beam briefly whenever the user picks an offer to inspect
  // or matches are loading.
  useEffect(() => {
    if (selectedOfferId) {
      setScanning(true);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => setScanning(false), 1600);
    }
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, [selectedOfferId, loadingMatches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originCity.trim()) {
      toast.error("Origin city is required.");
      return;
    }
    if (!destinationCity.trim()) {
      toast.error("Destination city is required.");
      return;
    }
    const weight = parseFloat(weightKg);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Weight must be a positive number.");
      return;
    }
    if (!pickupDate) {
      toast.error("Pickup date is required.");
      return;
    }

    createOffer.mutate({
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      weightKg: weight,
      pickupDate,
      notes: notes.trim() || undefined,
    });
  };

  const handleFindMatches = (offerId: string) => {
    setSelectedOfferId(offerId === selectedOfferId ? null : offerId);
  };

  const handleCancel = (offerId: string) => {
    cancelOffer.mutate({ offerId });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const selectedOffer = myOffers.find((o) => o._id === selectedOfferId);

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Small Truck Load Aggregation" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Post Load Form */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Post a Load Offer
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Share your available truck capacity. The system will find
                compatible loads along the same corridor.
              </p>

              {(originCity || destinationCity) && (
                <div className="mb-6">
                  <CorridorArc
                    origin={originCity}
                    destination={destinationCity}
                    scanning={false}
                  />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Origin City
                    </label>
                    <input
                      type="text"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      placeholder="e.g. Chicago"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Destination City
                    </label>
                    <input
                      type="text"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      placeholder="e.g. Detroit"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="e.g. 800"
                      min="0.1"
                      step="0.1"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Notes{" "}
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requirements, cargo type, etc."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={createOffer.isPending}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2"
                  >
                    {createOffer.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Posting…
                      </>
                    ) : (
                      "Post Load Offer"
                    )}
                  </motion.button>
                </div>
              </form>
            </section>

            {/* My Offers */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  My Load Offers
                </h2>
                {myOffers.length > 0 && (
                  <span className="text-xs font-semibold text-slate-500">
                    <CountUp value={myOffers.length} /> active
                  </span>
                )}
              </div>

              {loadingOffers ? (
                <div className="space-y-3">
                  <CardSkeleton height={120} />
                  <CardSkeleton height={120} />
                </div>
              ) : myOffers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    No load offers yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Post your first offer above to start aggregating loads.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOffers.map((offer) => (
                    <motion.div
                      key={offer._id}
                      whileHover={{ y: -1 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-base font-bold text-slate-900">
                              {offer.originCity}
                              <span className="mx-2 text-blue-400">→</span>
                              {offer.destinationCity}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                statusColors[offer.status] ??
                                "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {offer.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                            <span>
                              <span className="font-semibold text-slate-700">
                                Weight:
                              </span>{" "}
                              {offer.weightKg.toLocaleString()} kg
                            </span>
                            <span>
                              <span className="font-semibold text-slate-700">
                                Pickup:
                              </span>{" "}
                              {formatDate(offer.pickupDate)}
                            </span>
                            <span>
                              <span className="font-semibold text-slate-700">
                                Posted:
                              </span>{" "}
                              {formatDate(offer.createdAt)}
                            </span>
                          </div>

                          {offer.notes && (
                            <p className="text-sm text-slate-500 italic">
                              {offer.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {offer.status === "open" && (
                            <>
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleFindMatches(offer._id)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                  selectedOfferId === offer._id
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                }`}
                              >
                                {selectedOfferId === offer._id
                                  ? "Hide Matches"
                                  : "Find Matches"}
                              </motion.button>

                              <button
                                onClick={() => handleCancel(offer._id)}
                                disabled={cancelOffer.isPending}
                                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Match Results Panel */}
                      {selectedOfferId === offer._id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.2 }}
                          className="mt-5 pt-5 border-t border-slate-100 overflow-hidden"
                        >
                          <h3 className="text-sm font-bold text-slate-700 mb-3">
                            Compatible Load Matches
                          </h3>

                          <div className="mb-4">
                            <CorridorArc
                              origin={offer.originCity}
                              destination={offer.destinationCity}
                              scanning={scanning || loadingMatches}
                            />
                          </div>

                          {loadingMatches ? (
                            <div className="space-y-3">
                              <CardSkeleton height={70} />
                              <CardSkeleton height={70} />
                            </div>
                          ) : matches.length === 0 ? (
                            <p className="text-sm text-slate-400">
                              No compatible loads found for this route and date
                              window. Check back later or adjust your offer
                              details.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              <AnimatePresence initial>
                                {matches.map((match, idx) => (
                                  <motion.div
                                    key={match._id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                      delay: idx * 0.07,
                                      duration: 0.2,
                                    }}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 rounded-xl p-4"
                                  >
                                    <div className="space-y-1 flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-slate-800">
                                        {match.originCity}
                                        <span className="mx-2 text-blue-400">
                                          →
                                        </span>
                                        {match.destinationCity}
                                      </div>
                                      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                        <span>
                                          {match.weightKg.toLocaleString()} kg
                                        </span>
                                        <span>
                                          Pickup:{" "}
                                          {formatDate(match.pickupDate)}
                                        </span>
                                        {match.notes && (
                                          <span className="italic text-slate-500 truncate">
                                            {match.notes}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <SimilarityRing
                                        pct={match.similarityScore}
                                      />
                                      <p className="text-xs text-slate-500 whitespace-nowrap">
                                        Combined:{" "}
                                        <strong className="text-slate-700">
                                          {(
                                            offer.weightKg + match.weightKg
                                          ).toLocaleString()}{" "}
                                          kg
                                        </strong>
                                      </p>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {selectedOffer && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <RefreshCcw className="w-3 h-3" />
                Match candidates refresh whenever you change selection.
              </div>
            )}
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail title="Verification Activity" />
          </aside>
        </div>
      </main>
    </div>
  );
}
