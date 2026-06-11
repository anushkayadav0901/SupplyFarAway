import { useState } from "react";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";
import { toast } from "react-toastify";

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
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${colors[variant]}`}
    >
      {tag}
    </span>
  );
}

function MatchGauge({ pct }: { pct: number }) {
  const color =
    pct >= 90
      ? "bg-emerald-500"
      : pct >= 60
      ? "bg-amber-500"
      : "bg-red-500";
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">Match Rate</span>
        <span className="text-sm font-bold text-gray-800">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function HistoryCard({ item }: { item: ScanResult }) {
  const [open, setOpen] = useState(false);
  const date = new Date(item.createdAt).toLocaleString();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
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
          <span className="text-sm font-medium text-gray-800 truncate">
            {date}
          </span>
          {item.draftId && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">
              Draft: {item.draftId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-bold text-gray-700">
            {item.matchPct.toFixed(1)}%
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
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
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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

export default function RfidVerification() {
  const [manifestInput, setManifestInput] = useState("");
  const [scannedInput, setScannedInput] = useState("");
  const [draftId, setDraftId] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [historyLimit, setHistoryLimit] = useState(20);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const manifestTags = parseTags(manifestInput);
    const scannedTags = parseTags(scannedInput);

    if (manifestTags.length === 0) {
      toast.error("Manifest tag list cannot be empty.");
      return;
    }

    try {
      const doc = await verifyMutation.mutateAsync({
        manifestTags,
        scannedTags,
        draftId: draftId.trim() || undefined,
      });
      setResult(doc as unknown as ScanResult);
      historyQuery.refetch();
    } catch {
      // error handled by onError above
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="RFID/NFC Verification" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Verification Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Scan Verification
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Paste your manifest tags and scanned tags below — one tag per line.
            The system will compute matched, missing, and extra entries.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Manifest Tags
                  <span className="ml-1 text-xs text-gray-400 font-normal">
                    (one per line)
                  </span>
                </label>
                <textarea
                  value={manifestInput}
                  onChange={(e) => setManifestInput(e.target.value)}
                  rows={8}
                  placeholder={"E200001234567890\nE200001234567891\nE200001234567892"}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Scanned Tags
                  <span className="ml-1 text-xs text-gray-400 font-normal">
                    (one per line)
                  </span>
                </label>
                <textarea
                  value={scannedInput}
                  onChange={(e) => setScannedInput(e.target.value)}
                  rows={8}
                  placeholder={"E200001234567890\nE200001234567891\nE200001234567899"}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 max-w-sm">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Draft ID
                  <span className="ml-1 text-xs text-gray-400 font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  placeholder="Link to a draft (optional)"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={verifyMutation.isPending}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl shadow transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
              >
                {verifyMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  "Run Verification"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Result Panel */}
        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                Verification Result
              </h2>
              <button
                onClick={() => setResult(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss result"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <MatchGauge pct={result.matchPct} />

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-emerald-700">
                  {result.matched.length}
                </p>
                <p className="text-xs font-medium text-emerald-600 mt-0.5">
                  Matched
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-red-700">
                  {result.missing.length}
                </p>
                <p className="text-xs font-medium text-red-600 mt-0.5">
                  Missing
                </p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-amber-700">
                  {result.extra.length}
                </p>
                <p className="text-xs font-medium text-amber-600 mt-0.5">
                  Extra
                </p>
              </div>
            </div>

            {result.matched.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Matched Tags ({result.matched.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.matched.map((t) => (
                    <TagBadge key={t} tag={t} variant="matched" />
                  ))}
                </div>
              </div>
            )}

            {result.missing.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Missing Tags ({result.missing.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.missing.map((t) => (
                    <TagBadge key={t} tag={t} variant="missing" />
                  ))}
                </div>
              </div>
            )}

            {result.extra.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Extra Tags ({result.extra.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.extra.map((t) => (
                    <TagBadge key={t} tag={t} variant="extra" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Scan History
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Recent RFID/NFC verification runs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">Show</label>
              <select
                value={historyLimit}
                onChange={(e) => setHistoryLimit(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {historyQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : historyQuery.error ? (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-4 border border-red-100">
              Failed to load history: {historyQuery.error.message}
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <svg
                className="w-10 h-10 mx-auto mb-3 opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">No scans yet. Run a verification above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(historyQuery.data as unknown as ScanResult[]).map((item) => (
                <HistoryCard key={item._id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
