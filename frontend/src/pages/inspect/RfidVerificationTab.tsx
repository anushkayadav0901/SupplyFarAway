import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import { Radio, Terminal, Tag, RefreshCcw } from "lucide-react";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ─── constants ────────────────────────────────────────────────────────────────
const STREAM_TAG_DELAY_BASE_MS = 220;
const STREAM_TAG_STEP_MS = 300;
const MAX_STREAM_TAGS = 6;
const HISTORY_LIMITS = [10, 20, 50] as const;

interface ScanResult {
  _id: string;
  draftId?: string;
  manifestTags: string[];
  scannedTags: string[];
  matched: string[];
  missing: string[];
  extra: string[];
  matchPct: number;
  createdAt: Date | string;
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const piece of raw.split(/[\n\r,;\t]+/)) {
    const t = piece.trim();
    if (t.length === 0) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
  }
  return result;
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

function TagBadge({
  tag,
  variant,
}: {
  tag: string;
  variant: "matched" | "missing" | "extra";
}) {
  const colors: Record<typeof variant, string> = {
    matched: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    missing: "bg-red-100 text-red-800 border border-red-200",
    extra: "bg-amber-100 text-amber-800 border border-amber-200",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${colors[variant]}`}>
      {tag}
    </span>
  );
}

function AntennaPulse({ scanning }: { scanning: boolean }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="relative w-32 h-32 flex items-center justify-center" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-blue-500/40"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={
            scanning && !shouldReduceMotion
              ? { scale: [0.4, 1.4], opacity: [0.7, 0] }
              : { scale: 0.4, opacity: 0 }
          }
          transition={{ duration: 1.6, ease: "easeOut", repeat: scanning ? Infinity : 0, delay: i * 0.5 }}
        />
      ))}
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md ${
          scanning
            ? "bg-blue-500 shadow-blue-200"
            : "bg-slate-400"
        }`}
      >
        <Radio className="w-7 h-7" />
      </div>
    </div>
  );
}

function MatchGauge({ pct }: { pct: number }) {
  const color =
    pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 font-medium">Match Rate</span>
        <span className="text-sm font-bold text-slate-800">
          <CountUp value={pct} decimals={1} suffix="%" />
        </span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function ChipRail({
  title,
  tags,
  variant,
}: {
  title: string;
  tags: string[];
  variant: "matched" | "missing" | "extra";
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial>
          {tags.map((t, i) => (
            <motion.span
              key={`${t}-${i}`}
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.018, duration: 0.16 }}
            >
              <TagBadge tag={t} variant={variant} />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HistoryCard({ item }: { item: ScanResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              item.matchPct >= 90
                ? "bg-emerald-500"
                : item.matchPct >= 60
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-sm font-medium text-slate-800 truncate">
            {fmtDate(item.createdAt)}
          </span>
          {item.draftId && (
            <span className="text-xs text-slate-400 truncate hidden sm:inline">
              Draft: {item.draftId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-bold text-slate-700">{item.matchPct.toFixed(1)}%</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          <MatchGauge pct={item.matchPct} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-lg font-bold text-emerald-700">{item.matched.length}</p>
              <p className="text-xs text-emerald-600">Matched</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-lg font-bold text-red-700">{item.missing.length}</p>
              <p className="text-xs text-red-600">Missing</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-lg font-bold text-amber-700">{item.extra.length}</p>
              <p className="text-xs text-amber-600">Extra</p>
            </div>
          </div>
          {item.missing.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Missing Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.missing.map((t) => (
                  <TagBadge key={t} tag={t} variant="missing" />
                ))}
              </div>
            </div>
          )}
          {item.extra.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Extra Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.extra.map((t) => (
                  <TagBadge key={t} tag={t} variant="extra" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RfidVerificationTabProps {
  draftId: string;
  onResult?: (passed: boolean) => void;
}

export default function RfidVerificationTab({ draftId, onResult }: RfidVerificationTabProps) {
  const shouldReduceMotion = useReducedMotion();
  const [manifestInput, setManifestInput] = useState("");
  const [manifestTouched, setManifestTouched] = useState(false);
  const [scannedInput, setScannedInput] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [historyLimit, setHistoryLimit] = useState<typeof HISTORY_LIMITS[number]>(20);

  const [streaming, setStreaming] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const streamRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  const utils = trpc.useUtils();
  const verifyMutation = trpc.rfid.verify.useMutation({
    onSuccess: () => {
      utils.rfid.history.invalidate().catch(() => void 0);
    },
    onError: (err) => {
      toast.error(err.message || "Verification failed.");
    },
  });

  const historyQuery = trpc.rfid.history.useQuery(
    { limit: historyLimit },
    { refetchOnWindowFocus: false }
  );

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [streamLines]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && streaming) {
        timersRef.current.forEach((t) => clearTimeout(t));
        timersRef.current = [];
        if (mountedRef.current) setStreaming(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [streaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (streaming || verifyMutation.isPending) return;

    const manifestTags = parseTags(manifestInput);
    const scannedTags = parseTags(scannedInput);

    if (manifestTags.length === 0) {
      setManifestTouched(true);
      toast.error("Manifest tag list cannot be empty.");
      return;
    }

    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setStreamLines([]);
    setStreaming(true);

    const sample = scannedTags.length > 0 ? scannedTags : manifestTags.slice(0, MAX_STREAM_TAGS);
    const tagsToStream = sample.slice(0, MAX_STREAM_TAGS);

    tagsToStream.forEach((tag, i) => {
      const t = setTimeout(() => {
        if (!mountedRef.current) return;
        setStreamLines((prev) => [
          ...prev,
          `${new Date().toLocaleTimeString()}  ▸ acquired  ${tag}`,
        ]);
      }, STREAM_TAG_DELAY_BASE_MS + i * STREAM_TAG_STEP_MS);
      timersRef.current.push(t);
    });

    const totalStreamMs =
      STREAM_TAG_DELAY_BASE_MS + tagsToStream.length * STREAM_TAG_STEP_MS + 200;
    const finishTimer = setTimeout(async () => {
      if (!mountedRef.current) return;
      setStreaming(false);
      try {
        const doc = await verifyMutation.mutateAsync({
          manifestTags,
          scannedTags,
          draftId: draftId.trim() || undefined,
        });
        if (!mountedRef.current) return;
        const scanResult = doc as unknown as ScanResult;
        setResult(scanResult);
        onResult?.(scanResult.matchPct >= 90);
      } catch {
        // handled by onError
      }
    }, totalStreamMs);
    timersRef.current.push(finishTimer);
  };

  const submitting = streaming || verifyMutation.isPending;
  const manifestTagCount = useMemo(() => parseTags(manifestInput).length, [manifestInput]);

  return (
    <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <AntennaPulse scanning={streaming} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-800">Antenna Reader</h2>
              <p className="text-sm text-slate-500 mt-1">
                Paste manifest tags and field-scanned tags below. The reader streams
                discovered tags into the terminal.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${streaming ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {streaming ? "Reader active" : "Reader idle"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                  ch: 915 MHz · 1W
                </span>
              </div>
            </div>
          </div>

          <div
            ref={streamRef}
            className="mt-5 h-32 overflow-y-auto bg-slate-950 rounded-xl px-4 py-3 font-mono text-[11px] text-emerald-300 border border-slate-800"
          >
            {streamLines.length === 0 ? (
              <p className="text-slate-500">
                {streaming ? "listening…" : "no carrier"}
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {streamLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={shouldReduceMotion ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {line}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {streaming && (
              <span className="inline-block w-2 h-3 bg-emerald-300 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="manifestInput" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Manifest Tags
                  {manifestTagCount > 0 && (
                    <span className="ml-2 text-xs font-semibold text-blue-600">
                      ({manifestTagCount})
                    </span>
                  )}
                </label>
                <textarea
                  id="manifestInput"
                  value={manifestInput}
                  onChange={(e) => setManifestInput(e.target.value)}
                  onBlur={() => setManifestTouched(true)}
                  rows={6}
                  placeholder="E200001234567890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="scannedInput" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Scanned Tags
                </label>
                <textarea
                  id="scannedInput"
                  value={scannedInput}
                  onChange={(e) => setScannedInput(e.target.value)}
                  rows={6}
                  placeholder="E200001234567890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {streaming && (
                <button
                  type="button"
                  onClick={() => {
                    timersRef.current.forEach((t) => clearTimeout(t));
                    timersRef.current = [];
                    setStreaming(false);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  Cancel
                </button>
              )}
              <motion.button
                type="submit"
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors duration-200 flex items-center gap-2"
              >
                {streaming ? "Scanning…" : "Scan & Verify"}
              </motion.button>
            </div>
          </form>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              key="r"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-5"
            >
              <MatchGauge pct={result.matchPct} />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-emerald-700">{result.matched.length}</p>
                  <p className="text-xs font-medium text-emerald-600">Matched</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-red-700">{result.missing.length}</p>
                  <p className="text-xs font-medium text-red-600">Missing</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-amber-700">{result.extra.length}</p>
                  <p className="text-xs font-medium text-amber-600">Extra</p>
                </div>
              </div>
              {result.matched.length > 0 && (
                <ChipRail title={`Matched Tags (${result.matched.length})`} tags={result.matched} variant="matched" />
              )}
              {result.missing.length > 0 && (
                <ChipRail title={`Missing Tags (${result.missing.length})`} tags={result.missing} variant="missing" />
              )}
              {result.extra.length > 0 && (
                <ChipRail title={`Extra Tags (${result.extra.length})`} tags={result.extra} variant="extra" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Scan History</h2>
              <p className="text-sm text-slate-500 mt-0.5">Recent RFID/NFC verification runs</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="historyLimit" className="text-xs text-slate-500 font-medium">Show</label>
              <select
                id="historyLimit"
                value={historyLimit}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  const next = HISTORY_LIMITS.find((n) => n === parsed) ?? 20;
                  setHistoryLimit(next);
                }}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {HISTORY_LIMITS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => historyQuery.refetch().catch(() => void 0)}
                aria-label="Refresh scan history"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
              >
                <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {historyQuery.isLoading ? (
            <div className="space-y-3">
              <CardSkeleton height={56} />
              <CardSkeleton height={56} />
              <CardSkeleton height={56} />
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
            <div className="text-center py-12 text-slate-400">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-500">No scans yet</p>
              <p className="text-xs mt-1">Enter manifest tags above and run a verification.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(historyQuery.data as unknown as ScanResult[]).map((item) => (
                <HistoryCard key={item._id} item={item} />
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
