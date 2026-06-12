import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Image, RefreshCcw, Upload, X } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function riskColor(score: number): string {
  if (score >= 70) return "text-red-600";
  if (score >= 40) return "text-amber-600";
  return "text-emerald-600";
}

function riskStrokeColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#10b981";
}

function riskBadgeColor(score: number): string {
  if (score >= 70) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Medium Risk";
  return "Low Risk";
}

// ---------------------------------------------------------------------------
// Risk Gauge — animated circular SVG
// ---------------------------------------------------------------------------

function RiskGauge({ score }: { score: number }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="relative w-44 h-44">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="10"
          fill="none"
        />
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
        <p
          className={`text-4xl font-extrabold tabular-nums ${riskColor(score)}`}
        >
          <CountUp value={score} />
        </p>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Risk Score
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scanning image card with scan-line overlay during analysis
// ---------------------------------------------------------------------------

function ScanImage({
  label,
  preview,
  scanning,
  onPick,
}: {
  label: string;
  preview: string;
  scanning: boolean;
  onPick: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        {label}
      </label>
      <div
        onClick={onPick}
        className="relative cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden transition-colors bg-slate-50"
        style={{ minHeight: 200 }}
      >
        {preview ? (
          <img
            src={preview}
            alt={`${label} preview`}
            className="w-full h-56 object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2 px-4">
            <Upload className="w-7 h-7" />
            <span className="text-sm text-center">
              Click to upload {label.toLowerCase()}
            </span>
          </div>
        )}
        {scanning && preview && (
          <>
            <motion.div
              className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_18px_4px_rgba(59,130,246,0.55)]"
              initial={{ top: 0 }}
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{
                duration: 2.2,
                ease: "easeInOut",
                repeat: Infinity,
              }}
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShipmentDiff() {
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

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: "before" | "after"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (slot === "before") {
      setBeforeFile(file);
      setBeforePreview(previewUrl);
    } else {
      setAfterFile(file);
      setAfterPreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeFile || !afterFile) {
      toast.error("Please select both a before and after image.");
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
        mimeType: beforeFile.type || "image/jpeg",
      });

      historyQuery.refetch();
      toast.success("Comparison complete.");
    } catch {
      // handled by onError above
    }
  };

  const result = compareMutation.data;
  const isLoading = compareMutation.isPending;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Damage & Tampering Diff" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Upload Form */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
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

              <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Draft ID{" "}
                    <span className="text-slate-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
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
                  />
                  <ScanImage
                    label="After Delivery"
                    preview={afterPreview}
                    scanning={isLoading}
                    onPick={() => afterInputRef.current?.click()}
                  />
                  <input
                    ref={beforeInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "before")}
                  />
                  <input
                    ref={afterInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "after")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {beforeFile && afterFile
                      ? "Both frames ready for analysis."
                      : "Drop a before and after frame to begin."}
                  </div>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={isLoading || !beforeFile || !afterFile}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors text-sm"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4" />
                        Run Diff Analysis
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </section>

            {/* Loading skeleton */}
            {isLoading && !result && (
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.22 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Analysis Result
                    </h2>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${riskBadgeColor(
                        result.riskScore
                      )}`}
                    >
                      {riskLabel(result.riskScore)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <RiskGauge score={result.riskScore} />
                    <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Tampering Probability
                        </p>
                        <p
                          className={`text-3xl font-bold ${riskColor(
                            result.tamperingProbability * 100
                          )}`}
                        >
                          <CountUp
                            value={result.tamperingProbability * 100}
                            suffix="%"
                          />
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4">
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
                      <h3 className="text-sm font-semibold text-slate-700 mb-1">
                        Summary
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {result.summary}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        Damage Description
                      </h3>
                      <blockquote className="text-sm text-slate-700 leading-relaxed bg-slate-50 border-l-4 border-blue-400 pl-4 pr-3 py-3 rounded-r-xl">
                        {result.damageDescription || "No visible damage."}
                      </blockquote>
                    </div>

                    {result.missingItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">
                          Missing Items
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.missingItems.map((item, i) => (
                            <motion.span
                              key={`${item}-${i}`}
                              initial={{ opacity: 0, scale: 0.94 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                delay: i * 0.04,
                                duration: 0.18,
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium"
                            >
                              <X className="w-3 h-3" />
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
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent Comparisons
                </h2>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
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
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-medium">
                    Failed to load history.
                  </p>
                  <button
                    type="button"
                    onClick={() => historyQuery.refetch()}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No comparisons yet. Upload two images to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {historyQuery.data.map((record) => {
                    const id = (
                      record._id as unknown as { toString(): string }
                    ).toString();
                    return (
                      <motion.div
                        key={id}
                        whileHover={{ y: -1 }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">
                            {record.summary}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(record.createdAt as Date).toLocaleString()}
                            {record.draftId ? ` · Draft: ${record.draftId}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskBadgeColor(
                              record.riskScore
                            )}`}
                          >
                            {riskLabel(record.riskScore)} ({record.riskScore})
                          </span>
                          <span className="text-xs text-slate-500">
                            {Math.round(record.tamperingProbability * 100)}%
                            tamper
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
