import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Copy,
  Link as LinkIcon,
  PackageSearch,
  Radio,
  RefreshCcw,
  Scale,
  ShieldCheck,
} from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";
import { shortHash } from "../../lib/insights";

type AuditEvent = {
  _id: string;
  draftId: string;
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
  createdAt: string | Date;
};

const EVENT_TYPES = [
  "box_count",
  "rfid_scan",
  "weight_check",
  "anomaly_report",
  "manual_inspection",
  "customs_verification",
] as const;

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  box_count: Box,
  rfid_scan: Radio,
  weight_check: Scale,
  anomaly_report: AlertTriangle,
  manual_inspection: PackageSearch,
  customs_verification: ShieldCheck,
};

const EVENT_COLOR: Record<string, string> = {
  box_count: "border-blue-300 bg-blue-50 text-blue-700",
  rfid_scan: "border-purple-300 bg-purple-50 text-purple-700",
  weight_check: "border-amber-300 bg-amber-50 text-amber-700",
  anomaly_report: "border-red-300 bg-red-50 text-red-700",
  manual_inspection: "border-emerald-300 bg-emerald-50 text-emerald-700",
  customs_verification: "border-indigo-300 bg-indigo-50 text-indigo-700",
};

function eventColor(t: string): string {
  return EVENT_COLOR[t] ?? "border-slate-300 bg-slate-50 text-slate-700";
}

function iconFor(t: string) {
  return ICONS[t] ?? CheckCircle2;
}

function prettyEvent(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// ChainCard — each event card with copy-on-click hash + connecting glyph
// ---------------------------------------------------------------------------

function ChainCard({
  event,
  isLast,
}: {
  event: AuditEvent;
  isLast: boolean;
}) {
  const Icon = iconFor(event.eventType);
  const fullHash = useMemo(
    () =>
      shortHash(
        `${event._id}:${event.eventType}:${new Date(event.createdAt).getTime()}`,
        32
      ),
    [event]
  );
  const shortened = fullHash.slice(0, 8);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(fullHash)
      .then(() => toast.success(`Hash copied · ${shortened}`))
      .catch(() => toast.error("Could not copy hash."));
  };

  return (
    <div className="relative pl-12">
      {/* Hash node + chain glyph */}
      <div className="absolute left-0 top-2 flex flex-col items-center">
        <button
          type="button"
          onClick={handleCopy}
          className="w-9 h-9 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-[10px] font-mono font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors shadow-sm group"
          title={`Copy full hash · ${fullHash}`}
        >
          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 absolute" />
          <span className="group-hover:opacity-0 transition-opacity">
            #{shortened.slice(0, 4)}
          </span>
        </button>
        {!isLast && (
          <div className="flex flex-col items-center mt-1.5 flex-1">
            <div className="w-px h-3 bg-slate-300" />
            <LinkIcon className="w-3 h-3 text-slate-400 rotate-90" />
            <div className="w-px flex-1 bg-slate-300 min-h-[1.25rem]" />
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-200 transition-colors mb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${eventColor(event.eventType)}`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${eventColor(event.eventType)}`}
                >
                  {prettyEvent(event.eventType)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  draft: {event.draftId.slice(0, 12)}…
                </span>
              </div>
              <p className="text-sm text-slate-800 font-medium leading-snug mt-1.5">
                {event.summary}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {new Date(event.createdAt).toLocaleString()}
              </p>
              {event.payload && Object.keys(event.payload).length > 0 && (
                <details className="group mt-2">
                  <summary className="text-[11px] text-blue-600 cursor-pointer select-none hover:text-blue-800 transition-colors">
                    View payload
                  </summary>
                  <pre className="mt-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:block flex-shrink-0">
            #{shortened}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function AuditLog() {
  const [draftId, setDraftId] = useState("");
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0]);
  const [summary, setSummary] = useState("");
  const [payloadRaw, setPayloadRaw] = useState("");

  const [queryMode, setQueryMode] = useState<"recent" | "forDraft">("recent");
  const [filterDraftId, setFilterDraftId] = useState("");
  const [recentLimit, setRecentLimit] = useState(30);
  const [activeDraftId, setActiveDraftId] = useState("");

  const utils = trpc.useUtils();

  const appendMutation = trpc.audit.append.useMutation({
    onSuccess: () => {
      setSummary("");
      setPayloadRaw("");
      utils.audit.recent.invalidate();
      utils.audit.forDraft.invalidate({ draftId });
      toast.success("Audit event recorded.");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to record audit event.");
    },
  });

  const recentQuery = trpc.audit.recent.useQuery(
    { limit: recentLimit },
    { enabled: queryMode === "recent" }
  );

  const forDraftQuery = trpc.audit.forDraft.useQuery(
    { draftId: activeDraftId },
    { enabled: queryMode === "forDraft" && activeDraftId.length > 0 }
  );

  const handleAppend = (e: React.FormEvent) => {
    e.preventDefault();

    let payload: Record<string, unknown> | undefined;
    if (payloadRaw.trim()) {
      try {
        payload = JSON.parse(payloadRaw) as Record<string, unknown>;
      } catch {
        toast.error("Payload must be valid JSON (or leave it empty).");
        return;
      }
    }

    if (!draftId.trim()) {
      toast.error("Draft ID is required.");
      return;
    }

    appendMutation.mutate({
      draftId: draftId.trim(),
      eventType,
      summary: summary.trim(),
      payload,
    });
  };

  const displayedEvents: AuditEvent[] =
    queryMode === "recent"
      ? ((recentQuery.data ?? []) as unknown as AuditEvent[])
      : ((forDraftQuery.data ?? []) as unknown as AuditEvent[]);

  const isQueryLoading =
    queryMode === "recent" ? recentQuery.isLoading : forDraftQuery.isLoading;
  const queryError =
    queryMode === "recent" ? recentQuery.error : forDraftQuery.error;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Verification Audit Log" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Append Event Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Record Verification Event
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Each entry is hashed and chained to the previous one.
                  </p>
                </div>
                <DraftPicker value={draftId} onSelect={setDraftId} />
              </div>

              <form onSubmit={handleAppend} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">
                      Draft ID
                    </label>
                    <input
                      type="text"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      placeholder="e.g. 6650a3f2c1234abcd"
                      required
                      className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">
                      Event Type
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white appearance-none"
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {prettyEvent(t)}
                        </option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Summary
                  </label>
                  <input
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="e.g. 48 of 50 boxes scanned, 2 missing"
                    required
                    className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Payload{" "}
                    <span className="text-slate-400 font-normal">
                      (optional JSON)
                    </span>
                  </label>
                  <textarea
                    value={payloadRaw}
                    onChange={(e) => setPayloadRaw(e.target.value)}
                    placeholder={'{ "scanned": 48, "total": 50 }'}
                    rows={3}
                    className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={appendMutation.isPending}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl transition-colors min-w-[140px] flex items-center justify-center gap-2"
                  >
                    {appendMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        Append to chain
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Query Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  View Chain
                </h2>
                <span className="text-xs text-slate-500">
                  <CountUp value={displayedEvents.length} /> entries
                </span>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQueryMode("recent")}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                      queryMode === "recent"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Recent Events
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueryMode("forDraft")}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                      queryMode === "forDraft"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    By Draft ID
                  </button>
                </div>

                {queryMode === "recent" && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      Show last
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={recentLimit}
                      onChange={(e) =>
                        setRecentLimit(
                          Math.min(100, Math.max(1, Number(e.target.value)))
                        )
                      }
                      className="w-20 px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">events</span>
                    <button
                      type="button"
                      onClick={() => recentQuery.refetch()}
                      className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Refresh
                    </button>
                  </div>
                )}

                {queryMode === "forDraft" && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={filterDraftId}
                      onChange={(e) => setFilterDraftId(e.target.value)}
                      placeholder="Enter Draft ID"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setActiveDraftId(filterDraftId.trim())}
                      disabled={!filterDraftId.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Search
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Chain */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              {isQueryLoading ? (
                <div className="space-y-4">
                  <CardSkeleton height={100} />
                  <CardSkeleton height={100} />
                  <CardSkeleton height={100} />
                </div>
              ) : queryError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-medium">
                    {queryError.message ?? "Failed to load events."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (queryMode === "recent") recentQuery.refetch();
                      else forDraftQuery.refetch();
                    }}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : displayedEvents.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <LinkIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    The chain is empty
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {queryMode === "forDraft" && !activeDraftId
                      ? "Enter a Draft ID above and click Search."
                      : "Record your first event using the form above."}
                  </p>
                </div>
              ) : (
                <AnimatePresence initial>
                  {displayedEvents.map((event, i) => (
                    <ChainCard
                      key={event._id}
                      event={event}
                      isLast={i === displayedEvents.length - 1}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail
              draftId={
                queryMode === "forDraft" && activeDraftId
                  ? activeDraftId
                  : draftId.trim() || undefined
              }
              title="Verification Activity"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
