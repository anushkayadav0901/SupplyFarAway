import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import { MapPin, Package, RefreshCcw, Truck } from "lucide-react";

import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCAN_DURATION_MS = 1600;
const MATCH_STAGGER_DELAY = 0.07;
const MATCH_TRANSITION_DURATION = 0.2;
const ARC_SWEEP_DURATION = 2.2;
const RING_TRANSITION_DURATION = 0.6;

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
// ---------------------------------------------------------------------------

function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtWeight(kg: number): string {
  return kg.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " kg";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Status badge colors (C4)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  matched: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// CorridorArc — animated SVG arc from origin → destination with scan beam.
// Handles origin === destination gracefully (shows a dot, no arc).
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
  const shouldReduceMotion = useReducedMotion();
  const sameCity = origin.trim() !== "" && origin.trim() === destination.trim();

  if (sameCity) {
    return (
      <div
        className="relative bg-slate-50 rounded-xl border border-slate-200 px-5 py-4 overflow-hidden"
        aria-label={`Same origin and destination: ${origin}`}
      >
        <svg viewBox="0 0 400 100" className="w-full h-24">
          <circle cx="200" cy="50" r="18" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="6,4" />
          <circle cx="200" cy="50" r="6" fill="#3b82f6" />
          <circle cx="200" cy="50" r="3" fill="#fff" />
        </svg>
        <div className="flex justify-center text-xs text-slate-600 font-semibold mt-1">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-blue-600" aria-hidden="true" />
            {origin} (same city)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-slate-50 rounded-xl border border-slate-200 px-5 py-4 overflow-hidden"
      aria-label={`Corridor from ${origin || "origin"} to ${destination || "destination"}`}
    >
      <svg viewBox="0 0 400 100" className="w-full h-24" aria-hidden="true">
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
        {/* Scan beam — sweeps across while computing matches (V10: respects reduced-motion) */}
        {scanning && !shouldReduceMotion && (
          <motion.rect
            y="0"
            height="100"
            width="2"
            fill="#3b82f6"
            opacity={0.55}
            initial={{ x: 30 }}
            animate={{ x: [30, 370, 30] }}
            transition={{
              duration: ARC_SWEEP_DURATION,
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
          <MapPin className="w-3 h-3 text-blue-600" aria-hidden="true" />
          {origin || "—"}
        </span>
        <span className="flex items-center gap-1">
          {destination || "—"}
          <MapPin className="w-3 h-3 text-emerald-600" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SimilarityRing — small circular SVG showing match %
// ---------------------------------------------------------------------------

const SimilarityRing = ({ pct }: { pct: number }) => {
  const r = 18;
  const c = 2 * Math.PI * r;
  const safePct = Math.min(100, Math.max(0, pct));
  const offset = c * (1 - safePct / 100);
  return (
    <div className="relative w-12 h-12" aria-label={`${Math.round(safePct)}% match`}>
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} stroke="#e2e8f0" strokeWidth="4" fill="none" />
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
          transition={{ duration: RING_TRANSITION_DURATION, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700">
        {Math.round(safePct)}%
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function LoadAggregation({ asTab = false }: { asTab?: boolean }) {
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [notes, setNotes] = useState("");

  // Track which offer's matches are currently shown
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();

  const createOffer = trpc.loadMatch.createOffer.useMutation({
    onSuccess: () => {
      toast.success("Load offer posted.");
      // Reset form cleanly (V-form-reset)
      setOriginCity("");
      setDestinationCity("");
      setWeightKg("");
      setPickupDate("");
      setNotes("");
      utils.loadMatch.listMine.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create load offer.");
    },
  });

  const cancelOffer = trpc.loadMatch.cancel.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Offer cancelled.");
      utils.loadMatch.listMine.invalidate().catch(() => null);
      // If the cancelled offer was the one whose matches panel is open,
      // close it — matches are no longer relevant for a cancelled offer.
      setSelectedOfferId((current) =>
        current === variables.offerId ? null : current,
      );
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel offer.");
    },
  });

  const offersQuery = trpc.loadMatch.listMine.useQuery({});
  const myOffers: LoadOffer[] =
    (offersQuery.data?.offers as unknown as LoadOffer[]) ?? [];

  const matchQuery = trpc.loadMatch.findMatches.useQuery(
    { offerId: selectedOfferId! },
    { enabled: !!selectedOfferId }
  );
  const matches: MatchResult[] =
    (matchQuery.data?.matches as unknown as MatchResult[]) ?? [];

  // Trigger the scan beam whenever the user picks an offer to inspect
  // or matches are reloading. Clean up timer on unmount (V4).
  useEffect(() => {
    if (selectedOfferId) {
      setScanning(true);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => setScanning(false), SCAN_DURATION_MS);
    }
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, [selectedOfferId, matchQuery.isLoading]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Defence-in-depth: the button is also disabled, but guard against a
      // duplicate submit racing past the disabled state.
      if (createOffer.isPending) return;
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
    },
    [originCity, destinationCity, weightKg, pickupDate, notes, createOffer]
  );

  const handleFindMatches = useCallback(
    (offerId: string) => {
      setSelectedOfferId((current) => (current === offerId ? null : offerId));
    },
    []
  );

  const handleCancel = useCallback(
    (offerId: string) => {
      if (cancelOffer.isPending) return;
      cancelOffer.mutate({ offerId });
    },
    [cancelOffer]
  );

  const selectedOffer = myOffers.find((o) => o._id === selectedOfferId);

  const inner = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ----------------------------------------------------------------
          Left column: form + offers
      ---------------------------------------------------------------- */}
      <div className="lg:col-span-8 space-y-6">

            {/* Post Load Form (C2: gradient card top, C8: rounded-2xl) */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Post a Load Offer
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Share your available truck capacity. The system will find
                compatible loads along the same corridor.
              </p>

              {/* Live corridor preview (only when both cities are non-empty) */}
              {(originCity.trim() || destinationCity.trim()) && (
                <div className="mb-6">
                  <CorridorArc
                    origin={originCity}
                    destination={destinationCity}
                    scanning={false}
                  />
                </div>
              )}

              {/* Form (V6: submits on Enter naturally via type=submit) */}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="la-origin"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Origin City
                    </label>
                    <input
                      id="la-origin"
                      type="text"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      placeholder="e.g. Chicago"
                      maxLength={120}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="la-destination"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Destination City
                    </label>
                    <input
                      id="la-destination"
                      type="text"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      placeholder="e.g. Detroit"
                      maxLength={120}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="la-weight"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Weight (kg)
                    </label>
                    <input
                      id="la-weight"
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
                    <label
                      htmlFor="la-date"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Pickup Date
                    </label>
                    <input
                      id="la-date"
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="la-notes"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Notes{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="la-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requirements, cargo type, etc."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition-colors resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  {/* C1: glow on primary button */}
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={createOffer.isPending}
                    aria-label="Post load offer"
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm hover:shadow-blue-200 hover:shadow-md transition-all flex items-center gap-2"
                  >
                    {createOffer.isPending ? (
                      <>
                        <span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                          aria-hidden="true"
                        />
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
            <section aria-label="My load offers">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">My Load Offers</h2>
                {myOffers.length > 0 && (
                  <span
                    className="text-xs font-semibold text-slate-500"
                    aria-live="polite"
                  >
                    <CountUp value={myOffers.length} /> active
                  </span>
                )}
              </div>

              {offersQuery.isLoading ? (
                <div className="space-y-3" aria-busy="true">
                  <CardSkeleton height={120} />
                  <CardSkeleton height={120} />
                </div>
              ) : offersQuery.error ? (
                /* V3: inline error + retry */
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <p className="text-sm text-red-700 font-medium mb-2">
                    {offersQuery.error.message || "Failed to load your offers."}
                  </p>
                  <button
                    type="button"
                    onClick={() => offersQuery.refetch()}
                    className="text-xs text-red-600 hover:text-red-700 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : myOffers.length === 0 ? (
                /* V2: warm empty state */
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <Truck className="w-6 h-6 text-blue-600" aria-hidden="true" />
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
                    <OfferCard
                      key={offer._id}
                      offer={offer}
                      isSelected={selectedOfferId === offer._id}
                      scanning={scanning}
                      matches={matches}
                      matchLoading={matchQuery.isLoading}
                      matchError={matchQuery.error?.message ?? null}
                      onFindMatches={handleFindMatches}
                      onCancel={handleCancel}
                      cancelPending={cancelOffer.isPending}
                      onRefetchMatches={() => matchQuery.refetch()}
                    />
                  ))}
                </div>
              )}
            </section>

            {selectedOffer && (
              <div
                className="text-xs text-slate-500 flex items-center gap-2"
                aria-live="polite"
              >
                <RefreshCcw className="w-3 h-3" aria-hidden="true" />
                Match candidates refresh whenever you change selection.
              </div>
            )}
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail title="Verification Activity" />
          </aside>
    </div>
  );

  if (asTab) return inner;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {inner}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OfferCard — extracted for performance (V9: memoized)
// ---------------------------------------------------------------------------

interface OfferCardProps {
  offer: LoadOffer;
  isSelected: boolean;
  scanning: boolean;
  matches: MatchResult[];
  matchLoading: boolean;
  matchError: string | null;
  onFindMatches: (id: string) => void;
  onCancel: (id: string) => void;
  cancelPending: boolean;
  onRefetchMatches: () => void;
}

const OfferCard = ({
  offer,
  isSelected,
  scanning,
  matches,
  matchLoading,
  matchError,
  onFindMatches,
  onCancel,
  cancelPending,
  onRefetchMatches,
}: OfferCardProps) => {
  return (
    <motion.div
      layout
      whileHover={{ y: -1 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base font-bold text-slate-900">
              {offer.originCity}
              <span className="mx-2 text-blue-400" aria-hidden="true">→</span>
              {offer.destinationCity}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                STATUS_COLORS[offer.status] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {offer.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <span>
              <span className="font-semibold text-slate-700">Weight:</span>{" "}
              {fmtWeight(offer.weightKg)}
            </span>
            <span>
              <span className="font-semibold text-slate-700">Pickup:</span>{" "}
              {fmtDate(offer.pickupDate)}
            </span>
            <span>
              <span className="font-semibold text-slate-700">Posted:</span>{" "}
              {fmtDate(offer.createdAt)}
            </span>
          </div>

          {offer.notes && (
            <p className="text-sm text-slate-500 italic">{offer.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {offer.status === "open" && (
            <>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onFindMatches(offer._id)}
                aria-label={
                  isSelected
                    ? `Hide matches for ${offer.originCity} to ${offer.destinationCity}`
                    : `Find matches for ${offer.originCity} to ${offer.destinationCity}`
                }
                aria-expanded={isSelected}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {isSelected ? "Hide Matches" : "Find Matches"}
              </motion.button>

              <button
                type="button"
                onClick={() => onCancel(offer._id)}
                disabled={cancelPending}
                aria-label={`Cancel offer from ${offer.originCity} to ${offer.destinationCity}`}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Match results panel with AnimatePresence for fade out/in (V1) */}
      <AnimatePresence mode="wait">
        {isSelected && (
          <motion.div
            key={`matches-${offer._id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: MATCH_TRANSITION_DURATION }}
            className="mt-5 pt-5 border-t border-slate-100 overflow-hidden"
          >
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Compatible Load Matches
            </h3>

            <div className="mb-4">
              <CorridorArc
                origin={offer.originCity}
                destination={offer.destinationCity}
                scanning={scanning || matchLoading}
              />
            </div>

            {matchLoading ? (
              <div className="space-y-3" aria-busy="true">
                <CardSkeleton height={70} />
                <CardSkeleton height={70} />
              </div>
            ) : matchError ? (
              /* V3: query error + retry */
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">{matchError}</p>
                <button
                  type="button"
                  onClick={onRefetchMatches}
                  className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                >
                  Retry
                </button>
              </div>
            ) : matches.length === 0 ? (
              /* V2: empty matches state */
              <div className="flex flex-col items-center py-6 text-center">
                <Package
                  className="w-8 h-8 text-slate-300 mb-2"
                  aria-hidden="true"
                />
                <p className="text-sm text-slate-500 font-medium">
                  No compatible loads found
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Check back later or adjust your offer details.
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Match results">
                <AnimatePresence initial={false} mode="sync">
                  {matches.map((match, idx) => (
                    <motion.div
                      key={match._id}
                      role="listitem"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{
                        delay: idx * MATCH_STAGGER_DELAY,
                        duration: MATCH_TRANSITION_DURATION,
                      }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 rounded-xl p-4"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">
                          {match.originCity}
                          <span className="mx-2 text-blue-400" aria-hidden="true">→</span>
                          {match.destinationCity}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                          <span>{fmtWeight(match.weightKg)}</span>
                          <span>Pickup: {fmtDate(match.pickupDate)}</span>
                          {match.notes && (
                            <span className="italic text-slate-500 truncate">
                              {match.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <SimilarityRing pct={match.similarityScore} />
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                          Combined:{" "}
                          <strong className="text-slate-700">
                            {fmtWeight(offer.weightKg + match.weightKg)}
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
      </AnimatePresence>
    </motion.div>
  );
};
