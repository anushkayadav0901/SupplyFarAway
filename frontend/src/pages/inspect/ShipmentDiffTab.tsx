import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import { Image as ImageIcon, Upload, X, AlertTriangle, RefreshCcw } from "lucide-react";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ─── constants ────────────────────────────────────────────────────────────────
const RISK_HIGH = 61;
const RISK_MED = 31;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

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
              className="absolute left-0 right-0 h-[3px] bg-blue-500 shadow-[0_0_18px_4px_rgba(59,130,246,0.55)]"
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

interface ShipmentDiffTabProps {
  draftId: string;
}

export default function ShipmentDiffTab({ draftId }: ShipmentDiffTabProps) {
  const shouldReduceMotion = useReducedMotion();
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string>("");
  const [afterPreview, setAfterPreview] = useState<string>("");

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const beforePreviewRef = useRef(beforePreview);
  const afterPreviewRef = useRef(afterPreview);
  useEffect(() => { beforePreviewRef.current = beforePreview; }, [beforePreview]);
  useEffect(() => { afterPreviewRef.current = afterPreview; }, [afterPreview]);
  useEffect(() => {
    return () => {
      if (beforePreviewRef.current) URL.revokeObjectURL(beforePreviewRef.current);
      if (afterPreviewRef.current) URL.revokeObjectURL(afterPreviewRef.current);
    };
  }, []);

  const utils = trpc.useUtils();
  const compareMutation = trpc.shipmentDiff.compare.useMutation({
    onSuccess: () => {
      utils.shipmentDiff.history.invalidate().catch(() => void 0);
    },
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
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is larger than 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      e.target.value = "";
      return;
    }
    if (slot === "before") {
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      setBeforeFile(file);
      setBeforePreview(URL.createObjectURL(file));
    } else {
      if (afterPreview) URL.revokeObjectURL(afterPreview);
      setAfterFile(file);
      setAfterPreview(URL.createObjectURL(file));
    }
    e.target.value = "";
  };

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

      const inferredMime: AllowedImageMime =
        ALLOWED_IMAGE_MIME.find((m) => m === beforeFile.type) ?? "image/jpeg";

      await compareMutation.mutateAsync({
        draftId: draftId.trim() || undefined,
        beforeImageBase64: beforeBase64,
        afterImageBase64: afterBase64,
        mimeType: inferredMime,
      });
      toast.success("Comparison complete.");
    } catch {
      // handled by onError
    }
  };

  const result = compareMutation.data;
  const isLoading = compareMutation.isPending;
  const missingImages = !beforeFile || !afterFile;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
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
              />
              <input
                ref={afterInputRef}
                id="afterInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "after")}
              />
            </div>

            {beforeFile && afterFile && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  Reset
                </button>
                <motion.button
                  type="submit"
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors text-sm"
                >
                  {isLoading ? "Analyzing…" : "Run Diff Analysis"}
                </motion.button>
              </div>
            )}
          </form>
        </div>

        {compareMutation.error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700">Comparison failed</p>
                <p className="text-sm text-red-600 mt-1 break-words">
                  {compareMutation.error.message || "The diff pipeline returned an error."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => compareMutation.reset()}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Analysis Result</h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${riskBadgeColor(result.riskScore)}`}>
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
                  <p className={`text-3xl font-bold ${riskColor(result.tamperingProbability * 100)}`}>
                    <CountUp value={result.tamperingProbability * 100} suffix="%" />
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
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        {item}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Comparisons</h2>
            <button
              type="button"
              onClick={() => historyQuery.refetch().catch(() => void 0)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
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
                className="text-xs text-red-600 hover:text-red-700 underline mt-1"
              >
                Retry
              </button>
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskBadgeColor(record.riskScore)}`}>
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
        </div>
      </div>

      <aside className="lg:col-span-4">
        <InsightsRail draftId={draftId || undefined} title="Verification Activity" />
      </aside>
    </div>
  );
}

