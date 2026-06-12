import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import { Image, RefreshCcw, Upload, X, AlertTriangle } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ─── constants ────────────────────────────────────────────────────────────────
// Risk score color map (per product spec):
//   emerald  0 – 30
//   amber    31 – 60
//   red      61 – 100
const RISK_HIGH = 61;
const RISK_MED = 31;

// ─── helpers ──────────────────────────────────────────────────────────────────

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function riskColor(score: number): string {
  if (score >= RISK_HIGH) return "text-red-600";
  if (score >= RISK_MED) return "text-amber-600";
  return "text-emerald-600";
}

function riskStrokeColor(score: number): string {
  if (score >= RISK_HIGH) return "#ef4444";
  if (score >= RISK_MED) return "#f59e0b";
  return "#10b981";
}

function riskBadgeColor(score: number): string {
  if (score >= RISK_HIGH) return "bg-red-100 text-red-700 border-red-200";
  if (score >= RISK_MED) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function riskLabel(score: number): string {
  if (score >= RISK_HIGH) return "High Risk";
  if (score >= RISK_MED) return "Medium Risk";
  return "Low Risk";
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── RiskGauge ────────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="relative w-44 h-44" aria-label={`Risk score: ${score}`}>
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="80" cy="80" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          stroke={riskStrokeColor(score)}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={`text-4xl font-extrabold tabular-nums ${riskColor(score)}`}>
          <CountUp value={score} />
        </p>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Risk Score
        </p>
      </div>
    </div>
  );
}

// ─── ScanImage ────────────────────────────────────────────────────────────────

function ScanImage({
  label,
  preview,
  scanning,
  onPick,
  inputId,
}: {
  label: string;
  preview: string;
  scanning: boolean;
  onPick: () => void;
  inputId: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700 mb-2">
        {label}
      </label>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={onPick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(); }}
        className="relative cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden transition-colors bg-slate-50"
        style={{ minHeight: 200 }}
      >
        {preview ? (
          <img src={preview} alt={`${label} preview`} className="w-full h-56 object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2 px-4">
            <Upload className="w-7 h-7" aria-hidden="true" />
            <span className="text-sm text-center">Click to upload {label.toLowerCase()}</span>
          </div>
        )}
        {scanning && preview && (
          <>
            <motion.div
              className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_18px_4px_rgba(59,130,246,0.55)]"
              initial={{ top: 0 }}
              animate={shouldReduceMotion ? {} : { top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
            />
            <div className="absolute inset-0 ring-2 ring-blue-400/40 pointer-events-none" />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold tracking-wider">
              SCANNING
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ShipmentDiff() {
  const shouldReduceMotion = useReducedMotion();
  const [draftId, setDraftId] = useState("");
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string>("");
  const [afterPreview, setAfterPreview] = useState<string>("");

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const compareMutation = trpc.shipmentDiff.compare.useMutation({
    onError: (err) => {
      toast.error(err.message ?? "Comparison failed. Please try again.");
    },
  });

  const historyQuery = trpc.shipmentDiff.history.useQuery({ limit: 20 });

  // revoke object URLs when new files are picked to avoid memory leaks
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: "before" | "after"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (slot === "before") {
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      setBeforeFile(file);
      setBeforePreview(URL.createObjectURL(file));
    } else {
      if (afterPreview) URL.revokeObjectURL(afterPreview);
      setAfterFile(file);
      setAfterPreview(URL.createObjectURL(file));
    }
    // reset the input value so the same file can be re-selected after a reset
    e.target.value = "";
  };

  // Reset between runs — clears images and mutation state
  const handleReset = () => {
    if (beforePreview) URL.revokeObjectURL(beforePreview);
    if (afterPreview) URL.revokeObjectURL(afterPreview);
    setBeforeFile(null);
    setAfterFile(null);
    setBeforePreview("");
    setAfterPreview("");
    compareMutation.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!beforeFile && !afterFile) {
      toast.error("Please select both a before and after image.");
      return;
    }
    if (!beforeFile) {
      toast.error("Please select the Before Loading image.");
      return;
    }
    if (!afterFile) {
      toast.error("Please select the After Delivery image.");
      return;
    }

    try {
      const [beforeBase64, afterBase64] = await Promise.all([
        readFileAsBase64(beforeFile),
        readFileAsBase64(afterFile),
      ]);

      await compareMutation.mutateAsync({
        draftId: draftId.trim() || undefined,
        beforeImageBase64: beforeBase64,
        afterImageBase64: afterBase64,
        mimeType: (beforeFile.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg",
      });

      historyQuery.refetch().catch(() => void 0);
      toast.success("Comparison complete.");
    } catch {
      // handled by onError above
    }
  };

  const result = compareMutation.data;
  const isLoading = compareMutation.isPending;
  const missingImages = !beforeFile || !afterFile;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Damage & Tampering Diff" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Upload Form */}
            <section
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
              aria-labelledby="compare-heading"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h2 id="compare-heading" className="text-lg font-semibold text-slate-900">
                    Compare Shipment Photos
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Upload a photo taken before loading and one upon delivery.
                    The vision pipeline estimates damage, missing items, and
                    tampering probability.
                  </p>
                </div>
                <DraftPicker value={draftId} onSelect={setDraftId} />
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 mt-6">
                <div>
                  <label htmlFor="draftIdInput" className="block text-sm font-medium text-slate-700 mb-1">
                    Draft ID{" "}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="draftIdInput"
                    type="text"
                    value={draftId}
                    onChange={(e) => setDraftId(e.target.value)}
                    placeholder="Link to an existing draft"
                    className="w-full sm:w-80 px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ScanImage
                    label="Before Loading"
                    preview={beforePreview}
                    scanning={isLoading}
                    onPick={() => beforeInputRef.current?.click()}
                    inputId="beforeInput"
                  />
                  <ScanImage
                    label="After Delivery"
                    preview={afterPreview}
                    scanning={isLoading}
                    onPick={() => afterInputRef.current?.click()}
                    inputId="afterInput"
                  />
                  <input
                    ref={beforeInputRef}
                    id="beforeInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "before")}
                    aria-label="Upload before loading image"
                  />
                  <input
                    ref={afterInputRef}
                    id="afterInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "after")}
                    aria-label="Upload after delivery image"
                  />
                </div>

                {/* Missing image warning */}
                {(beforeFile || afterFile) && missingImages && (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm" role="alert">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>
                      {!beforeFile ? "Before Loading image is missing." : "After Delivery image is missing."}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {beforeFile && afterFile
                      ? "Both frames ready for analysis."
                      : "Select a before and after frame to begin."}
                  </div>
                  <div className="flex items-center gap-2">
                    {(beforeFile || afterFile || result) && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-3 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                        aria-label="Reset and clear all images"
                      >
                        Reset
                      </button>
                    )}
                    <motion.button
                      type="submit"
                      whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                      disabled={isLoading || missingImages}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm shadow-blue-200 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {isLoading ? (
                        <>
                          <span
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                            aria-hidden="true"
                          />
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <Image className="w-4 h-4" aria-hidden="true" />
                          Run Diff Analysis
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </form>
            </section>

            {/* Compare error — descriptive, persistent, form is re-enabled below
                because mutation.isPending is back to false once mutateAsync rejects. */}
            {compareMutation.error && !isLoading && (
              <section
                className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm"
                role="alert"
                aria-labelledby="compare-error-heading"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p id="compare-error-heading" className="text-sm font-semibold text-red-700">
                      Comparison failed
                    </p>
                    <p className="text-sm text-red-600 mt-1 break-words">
                      {compareMutation.error.message ||
                        "The diff pipeline returned an unparseable response. Please retry."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => compareMutation.reset()}
                    aria-label="Dismiss error"
                    className="text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {/* Loading skeleton */}
            {isLoading && !result && (
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8" aria-label="Analyzing images">
                <div className="flex items-center gap-6">
                  <div className="w-44 h-44 rounded-full bg-slate-100 animate-pulse" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-4/6 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              </section>
            )}

            {/* Latest Result */}
            <AnimatePresence>
              {result && (
                <motion.section
                  key="result"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.22 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
                  aria-labelledby="result-heading"
                >
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <h2 id="result-heading" className="text-lg font-semibold text-slate-900">
                      Analysis Result
                    </h2>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${riskBadgeColor(result.riskScore)}`}
                    >
                      {riskLabel(result.riskScore)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <RiskGauge score={result.riskScore} />
                    <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Tampering Probability
                        </p>
                        <p className={`text-3xl font-bold ${riskColor(result.tamperingProbability * 100)}`}>
                          <CountUp value={result.tamperingProbability * 100} suffix="%" />
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Missing Items
                        </p>
                        <p className="text-3xl font-bold text-slate-800">
                          <CountUp value={result.missingItems.length} />
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mt-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-1">Summary</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Damage Description</h3>
                      <blockquote className="text-sm text-slate-700 leading-relaxed bg-slate-50 border-l-4 border-blue-400 pl-4 pr-3 py-3 rounded-r-xl">
                        {result.damageDescription || "No visible damage."}
                      </blockquote>
                    </div>

                    {result.missingItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Missing Items</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.missingItems.map((item, i) => (
                            <motion.span
                              key={`${item}-${i}`}
                              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.94 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.04, duration: 0.18 }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium"
                            >
                              <X className="w-3 h-3" aria-hidden="true" />
                              {item}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* History */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8" aria-labelledby="history-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="history-heading" className="text-lg font-semibold text-slate-900">
                  Recent Comparisons
                </h2>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch().catch(() => void 0)}
                  aria-label="Refresh recent comparisons"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                >
                  <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Refresh
                </button>
              </div>

              {historyQuery.isLoading ? (
                <div className="space-y-3">
                  <CardSkeleton height={64} />
                  <CardSkeleton height={64} />
                  <CardSkeleton height={64} />
                </div>
              ) : historyQuery.error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                  <p className="text-sm text-red-700 font-medium">Failed to load history.</p>
                  <button
                    type="button"
                    onClick={() => historyQuery.refetch().catch(() => void 0)}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                  >
                    Retry
                  </button>
                </div>
              ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Image className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-500">No comparisons yet</p>
                  <p className="text-xs mt-1">Upload two images to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyQuery.data.map((record) => {
                    const id = (record._id as unknown as { toString(): string }).toString();
                    return (
                      <motion.div
                        key={id}
                        whileHover={shouldReduceMotion ? {} : { y: -1 }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{record.summary}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {fmtDate(record.createdAt as Date)}
                            {record.draftId ? ` · Draft: ${record.draftId}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskBadgeColor(record.riskScore)}`}
                          >
                            {riskLabel(record.riskScore)} ({record.riskScore})
                          </span>
                          <span className="text-xs text-slate-500">
                            {Math.round(record.tamperingProbability * 100)}% tamper
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right rail */}
          <aside className="lg:col-span-4">
            <InsightsRail draftId={draftId.trim() || undefined} title="Verification Activity" />
          </aside>
        </div>
      </main>
    </div>
  );
}
