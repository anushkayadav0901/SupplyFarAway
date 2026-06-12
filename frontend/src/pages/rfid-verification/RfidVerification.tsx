import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Radio, Terminal, RefreshCcw } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tag badge
// ---------------------------------------------------------------------------

function TagBadge({
  tag,
  variant,
}: {
  tag: string;
  variant: "matched" | "missing" | "extra";
}) {
  const colors: Record<typeof variant, string> = {
    matched:
      "bg-emerald-100 text-emerald-800 border border-emerald-200",
    missing: "bg-red-100 text-red-800 border border-red-200",
    extra: "bg-amber-100 text-amber-800 border border-amber-200",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${colors[variant]}`}
    >
      {tag}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Antenna pulse animation
// ---------------------------------------------------------------------------

function AntennaPulse({ scanning }: { scanning: boolean }) {
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-blue-500/40"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={
            scanning
              ? { scale: [0.4, 1.4], opacity: [0.7, 0] }
              : { scale: 0.4, opacity: 0 }
          }
          transition={{
            duration: 1.6,
            ease: "easeOut",
            repeat: scanning ? Infinity : 0,
            delay: i * 0.5,
          }}
        />
      ))}
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md ${
          scanning
            ? "bg-gradient-to-br from-blue-500 to-blue-700"
            : "bg-gradient-to-br from-slate-400 to-slate-600"
        }`}
      >
        <Radio className="w-7 h-7" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match gauge
// ---------------------------------------------------------------------------

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
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
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

// ---------------------------------------------------------------------------
// History card
// ---------------------------------------------------------------------------

function HistoryCard({ item }: { item: ScanResult }) {
  const [open, setOpen] = useState(false);
  const date = new Date(item.createdAt).toLocaleString();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
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
            {date}
          </span>
          {item.draftId && (
            <span className="text-xs text-slate-400 truncate hidden sm:inline">
              Draft: {item.draftId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-bold text-slate-700">
            {item.matchPct.toFixed(1)}%
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          <MatchGauge pct={item.matchPct} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-lg font-bold text-emerald-700">
                {item.matched.length}
              </p>
              <p className="text-xs text-emerald-600">Matched</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-lg font-bold text-red-700">
                {item.missing.length}
              </p>
              <p className="text-xs text-red-600">Missing</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-lg font-bold text-amber-700">
                {item.extra.length}
              </p>
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function RfidVerification() {
  const [manifestInput, setManifestInput] = useState("");
  const [scannedInput, setScannedInput] = useState("");
  const [draftId, setDraftId] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [historyLimit, setHistoryLimit] = useState(20);

  // Simulated tag stream state
  const [streaming, setStreaming] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const streamRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const verifyMutation = trpc.rfid.verify.useMutation({
    onError: (err) => {
      toast.error(err.message || "Verification failed.");
    },
  });

  const historyQuery = trpc.rfid.history.useQuery(
    { limit: historyLimit },
    { refetchOnWindowFocus: false }
  );

  const parseTags = (raw: string): string[] =>
    raw
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

  useEffect(() => {
    streamRef.current?.scrollTo({
      top: streamRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [streamLines]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const manifestTags = parseTags(manifestInput);
    const scannedTags = parseTags(scannedInput);

    if (manifestTags.length === 0) {
      toast.error("Manifest tag list cannot be empty.");
      return;
    }

    // Simulated tag stream — show the antenna picking up tags before
    // the real mutation fires. The simulated stream pulls a few tags
    // from the scanned list so the visual matches what the API will see.
    setStreamLines([]);
    setStreaming(true);
    const sample =
      scannedTags.length > 0 ? scannedTags : manifestTags.slice(0, 6);
    const tagsToStream = sample.slice(0, Math.min(6, sample.length));
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    tagsToStream.forEach((tag, i) => {
      const t = setTimeout(() => {
        setStreamLines((prev) => [
          ...prev,
          `${new Date().toLocaleTimeString()}  ▸ acquired  ${tag}`,
        ]);
      }, 220 + i * 300);
      timersRef.current.push(t);
    });

    const totalStreamMs = 220 + tagsToStream.length * 300 + 200;
    const finishTimer = setTimeout(async () => {
      setStreaming(false);
      try {
        const doc = await verifyMutation.mutateAsync({
          manifestTags,
          scannedTags,
          draftId: draftId.trim() || undefined,
        });
        setResult(doc as unknown as ScanResult);
        historyQuery.refetch();
      } catch {
        // handled by onError above
      }
    }, totalStreamMs);
    timersRef.current.push(finishTimer);
  };

  const submitting = streaming || verifyMutation.isPending;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="RFID/NFC Verification" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Antenna visualization */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <AntennaPulse scanning={streaming} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-slate-800">
                    Antenna Reader
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Paste manifest tags and field-scanned tags below. The
                    reader streams discovered tags into the terminal, then the
                    server resolves matched / missing / extra entries.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        streaming
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {streaming ? "Reader active" : "Reader idle"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                      ch: 915 MHz · 1W
                    </span>
                  </div>
                </div>
              </div>

              {/* Terminal-style tag stream */}
              <div
                ref={streamRef}
                className="mt-5 h-32 overflow-y-auto bg-slate-950 rounded-xl px-4 py-3 font-mono text-[11px] text-emerald-300 border border-slate-800"
              >
                {streamLines.length === 0 ? (
                  <p className="text-slate-500">
                    <Terminal className="inline w-3 h-3 mr-1" />
                    {streaming ? "listening…" : "no carrier"}
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {streamLines.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
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

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Scan Verification
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Tags are matched line-by-line. Empty lines are ignored.
                  </p>
                </div>
                <DraftPicker value={draftId} onSelect={setDraftId} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 mt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Manifest Tags
                      <span className="ml-1 text-xs text-slate-400 font-normal">
                        (one per line)
                      </span>
                    </label>
                    <textarea
                      value={manifestInput}
                      onChange={(e) => setManifestInput(e.target.value)}
                      rows={8}
                      placeholder={
                        "E200001234567890\nE200001234567891\nE200001234567892"
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Scanned Tags
                      <span className="ml-1 text-xs text-slate-400 font-normal">
                        (one per line)
                      </span>
                    </label>
                    <textarea
                      value={scannedInput}
                      onChange={(e) => setScannedInput(e.target.value)}
                      rows={8}
                      placeholder={
                        "E200001234567890\nE200001234567891\nE200001234567899"
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                  <div className="flex-1 max-w-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Draft ID
                      <span className="ml-1 text-xs text-slate-400 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      placeholder="Link to a draft (optional)"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl shadow transition-colors duration-200 flex items-center gap-2"
                  >
                    {streaming ? (
                      <>
                        <Radio className="w-4 h-4 animate-pulse" />
                        Scanning…
                      </>
                    ) : verifyMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Resolving…
                      </>
                    ) : (
                      "Scan & Verify"
                    )}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  key="r"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">
                      Verification Result
                    </h2>
                    <button
                      onClick={() => setResult(null)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Dismiss result"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <MatchGauge pct={result.matchPct} />

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-emerald-700">
                        <CountUp value={result.matched.length} />
                      </p>
                      <p className="text-xs font-medium text-emerald-600 mt-0.5">
                        Matched
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-red-700">
                        <CountUp value={result.missing.length} />
                      </p>
                      <p className="text-xs font-medium text-red-600 mt-0.5">
                        Missing
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-amber-700">
                        <CountUp value={result.extra.length} />
                      </p>
                      <p className="text-xs font-medium text-amber-600 mt-0.5">
                        Extra
                      </p>
                    </div>
                  </div>

                  {result.matched.length > 0 && (
                    <ChipRail
                      title={`Matched Tags (${result.matched.length})`}
                      tags={result.matched}
                      variant="matched"
                    />
                  )}
                  {result.missing.length > 0 && (
                    <ChipRail
                      title={`Missing Tags (${result.missing.length})`}
                      tags={result.missing}
                      variant="missing"
                    />
                  )}
                  {result.extra.length > 0 && (
                    <ChipRail
                      title={`Extra Tags (${result.extra.length})`}
                      tags={result.extra}
                      variant="extra"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Scan History
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Recent RFID/NFC verification runs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 font-medium">
                    Show
                  </label>
                  <select
                    value={historyLimit}
                    onChange={(e) => setHistoryLimit(Number(e.target.value))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => historyQuery.refetch()}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
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
                <div className="text-center py-10 text-slate-400">
                  <Radio className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    No scans yet. Run a verification above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(historyQuery.data as unknown as ScanResult[]).map(
                    (item) => (
                      <HistoryCard key={item._id} item={item} />
                    )
                  )}
                </div>
              )}
            </div>
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

function ChipRail({
  title,
  tags,
  variant,
}: {
  title: string;
  tags: string[];
  variant: "matched" | "missing" | "extra";
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial>
          {tags.map((t, i) => (
            <motion.span
              key={`${t}-${i}`}
              initial={{ opacity: 0, scale: 0.94 }}
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
