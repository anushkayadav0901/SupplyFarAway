import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of chain entries rendered before showing a "Show more" button. */
const MAX_CHAIN_DISPLAY = 200;

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
// ---------------------------------------------------------------------------

function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditEvent = {
  _id: string;
  draftId: string;
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
  createdAt: string | Date;
};

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

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
// ChainCard — each event with copy-on-click hash + chain glyph (audit-log directive)
// ---------------------------------------------------------------------------

const ChainCard = React.memo(function ChainCard({
  event,
  isLast,
}: {
  event: AuditEvent;
  isLast: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const Icon = iconFor(event.eventType);

  // djb2 hash on (id + ts + eventType) — purely visual, as per directive
  const fullHash = useMemo(
    () =>
      shortHash(
        `${event._id}:${event.eventType}:${new Date(event.createdAt).getTime()}`,
        32
      ),
    [event._id, event.eventType, event.createdAt]
  );
  const shortened = fullHash.slice(0, 8);

  // Clipboard API with document.execCommand fallback (audit-log directive).
  // navigator.clipboard is only available in secure contexts (https/localhost);
  // on plain http it is undefined, so we must guard the property access
  // rather than relying on .catch().
  const handleCopy = () => {
    const fallbackCopy = () => {
      try {
        const el = document.createElement("textarea");
        el.value = fullHash;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (ok) {
          toast.success(`Hash copied · ${shortened}`);
        } else {
          toast.error("Could not copy hash.");
        }
      } catch {
        toast.error("Could not copy hash.");
      }
    };

    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      navigator.clipboard
        .writeText(fullHash)
        .then(() => toast.success(`Hash copied · ${shortened}`))
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  };

  return (
    <div className="relative pl-12">
      {/* Hash node + chain glyph */}
      <div className="absolute left-0 top-2 flex flex-col items-center">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy full audit hash ${shortened}`}
          title={`Copy full hash · ${fullHash}`}
          className="w-9 h-9 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-[10px] font-mono font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors shadow-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Copy
            className="w-3 h-3 opacity-0 group-hover:opacity-100 absolute"
            aria-hidden="true"
          />
          <span className="group-hover:opacity-0 transition-opacity" aria-hidden="true">
            #{shortened.slice(0, 4)}
          </span>
        </button>
        {!isLast && (
          <div className="flex flex-col items-center mt-1.5 flex-1" aria-hidden="true">
            <div className="w-px h-3 bg-slate-300" />
            <LinkIcon className="w-3 h-3 text-slate-400 rotate-90" />
            <div className="w-px flex-1 bg-slate-300 min-h-[1.25rem]" />
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, x: prefersReduced ? 0 : 6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-200 transition-colors mb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${eventColor(event.eventType)}`}
              aria-hidden="true"
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
                  draft: {event.draftId.length > 12
                    ? `${event.draftId.slice(0, 12)}…`
                    : event.draftId}
                </span>
              </div>
              <p className="text-sm text-slate-800 font-medium leading-snug mt-1.5">
                {event.summary}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {fmtDateTime(event.createdAt)}
                </time>
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
          <span
            className="text-[10px] font-mono text-slate-400 hidden sm:block flex-shrink-0"
            aria-hidden="true"
          >
            #{shortened}
          </span>
        </div>
      </motion.div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function AuditLog() {
  const prefersReduced = useReducedMotion();
  const [searchParams] = useSearchParams();
  const urlDraftId = searchParams.get("draftId") ?? "";

  const [draftId, setDraftId] = useState(urlDraftId);
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0]);
  const [summary, setSummary] = useState("");
  const [payloadRaw, setPayloadRaw] = useState("");

  const [queryMode, setQueryMode] = useState<"recent" | "forDraft">(
    urlDraftId ? "forDraft" : "recent"
  );
  const [filterDraftId, setFilterDraftId] = useState(urlDraftId);
  const [recentLimit, setRecentLimit] = useState(30);
  const [activeDraftId, setActiveDraftId] = useState(urlDraftId);
  const [showAll, setShowAll] = useState(false);

  // Sync deep-link param into local state if the URL changes after mount
  // (e.g., user lands here directly from Trust Center → audit chain link).
  const lastUrlDraftIdRef = useRef(urlDraftId);
  useEffect(() => {
    if (urlDraftId !== lastUrlDraftIdRef.current) {
      lastUrlDraftIdRef.current = urlDraftId;
      if (urlDraftId) {
        setDraftId(urlDraftId);
        setFilterDraftId(urlDraftId);
        setActiveDraftId(urlDraftId);
        setQueryMode("forDraft");
      }
    }
  }, [urlDraftId]);

  const utils = trpc.useUtils();

  const appendMutation = trpc.audit.append.useMutation({
    onSuccess: () => {
      setSummary("");
      setPayloadRaw("");
      utils.audit.recent.invalidate().catch(() => null);
      // Invalidate the active "by draft" query too — the user may be filtering
      // on a different draftId than the one they just appended to.
      utils.audit.forDraft.invalidate({ draftId: draftId.trim() }).catch(() => null);
      if (activeDraftId && activeDraftId !== draftId.trim()) {
        utils.audit.forDraft
          .invalidate({ draftId: activeDraftId })
          .catch(() => null);
      }
      utils.insights.recentActivity.invalidate().catch(() => null);
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
        const parsed = JSON.parse(payloadRaw);
        if (
          parsed === null ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          toast.error("Payload must be a JSON object (not an array or scalar).");
          return;
        }
        payload = parsed as Record<string, unknown>;
      } catch {
        toast.error("Payload must be valid JSON (or leave it empty).");
        return;
      }
    }

    if (!draftId.trim()) {
      toast.error("Draft ID is required.");
      return;
    }

    if (!summary.trim()) {
      toast.error("Summary is required.");
      return;
    }

    appendMutation.mutate({
      draftId: draftId.trim(),
      eventType,
      summary: summary.trim(),
      payload,
    });
  };

  // Submit on Enter; Escape clears the filter input so users can quickly bail.
  const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setActiveDraftId(filterDraftId.trim());
    } else if (e.key === "Escape") {
      setFilterDraftId("");
    }
  };

  const allDisplayedEvents: AuditEvent[] =
    queryMode === "recent"
      ? ((recentQuery.data ?? []) as unknown as AuditEvent[])
      : ((forDraftQuery.data ?? []) as unknown as AuditEvent[]);

  // Cap list (extra directive)
  const displayedEvents = showAll
    ? allDisplayedEvents
    : allDisplayedEvents.slice(0, MAX_CHAIN_DISPLAY);
  const hasMore = allDisplayedEvents.length > MAX_CHAIN_DISPLAY;

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
                    <label
                      htmlFor="audit-draftId"
                      className="text-sm font-medium text-slate-700"
                    >
                      Draft ID <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="audit-draftId"
                      type="text"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      placeholder="e.g. 6650a3f2c1234abcd"
                      required
                      aria-required="true"
                      className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="audit-eventType"
                      className="text-sm font-medium text-slate-700"
                    >
                      Event Type
                    </label>
                    <select
                      id="audit-eventType"
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
                  <label
                    htmlFor="audit-summary"
                    className="text-sm font-medium text-slate-700"
                  >
                    Summary <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="audit-summary"
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="e.g. 48 of 50 boxes scanned, 2 missing"
                    required
                    aria-required="true"
                    className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="audit-payload"
                    className="text-sm font-medium text-slate-700"
                  >
                    Payload{" "}
                    <span className="text-slate-400 font-normal">
                      (optional JSON)
                    </span>
                  </label>
                  <textarea
                    id="audit-payload"
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
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    whileHover={
                      prefersReduced
                        ? undefined
                        : { boxShadow: "0 0 0 3px rgba(59,130,246,0.25)" }
                    }
                    disabled={appendMutation.isPending}
                    aria-label={
                      appendMutation.isPending
                        ? "Saving audit event"
                        : "Append event to audit chain"
                    }
                    aria-busy={appendMutation.isPending}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl transition-colors min-w-[140px] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {appendMutation.isPending ? (
                      <>
                        <span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                          aria-hidden="true"
                        />
                        Saving…
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" aria-hidden="true" />
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
                <span className="text-xs text-slate-500" aria-live="polite">
                  <CountUp value={allDisplayedEvents.length} /> entries
                </span>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="flex gap-2" role="group" aria-label="Query mode">
                  <button
                    type="button"
                    onClick={() => setQueryMode("recent")}
                    aria-pressed={queryMode === "recent"}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
                    aria-pressed={queryMode === "forDraft"}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
                    <label
                      htmlFor="recent-limit"
                      className="text-sm font-medium text-slate-700 whitespace-nowrap"
                    >
                      Show last
                    </label>
                    <input
                      id="recent-limit"
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
                      onClick={() => {
                        recentQuery.refetch().catch(() => null);
                      }}
                      disabled={recentQuery.isRefetching}
                      aria-label="Refresh recent events"
                      aria-busy={recentQuery.isRefetching}
                      className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      <RefreshCcw
                        className={`w-3.5 h-3.5 ${recentQuery.isRefetching ? "animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                      Refresh
                    </button>
                  </div>
                )}

                {queryMode === "forDraft" && (
                  <div className="flex gap-2">
                    <label htmlFor="filter-draft-id" className="sr-only">
                      Draft ID to search
                    </label>
                    <input
                      id="filter-draft-id"
                      type="text"
                      value={filterDraftId}
                      onChange={(e) => setFilterDraftId(e.target.value)}
                      onKeyDown={handleFilterKeyDown}
                      placeholder="Enter Draft ID"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setActiveDraftId(filterDraftId.trim())}
                      disabled={!filterDraftId.trim()}
                      aria-label="Search audit log for draft ID"
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                <div className="space-y-4" aria-label="Loading audit chain">
                  <CardSkeleton height={100} />
                  <CardSkeleton height={100} />
                  <CardSkeleton height={100} />
                </div>
              ) : queryError ? (
                /* Error state (V3) */
                <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                  <p className="text-sm text-red-700 font-medium">
                    {queryError.message ?? "Failed to load events."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (queryMode === "recent") {
                        recentQuery.refetch().catch(() => null);
                      } else {
                        forDraftQuery.refetch().catch(() => null);
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                    aria-label="Retry loading audit events"
                  >
                    Retry
                  </button>
                </div>
              ) : displayedEvents.length === 0 ? (
                /* Empty state (V2) */
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <LinkIcon className="w-6 h-6 text-blue-600" aria-hidden="true" />
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
                <>
                  <AnimatePresence initial>
                    {displayedEvents.map((event, i) => {
                      // The last *visible* entry is the chain tip if either:
                      //  - there's no "Show more" affordance below it
                      //    (showAll=true OR hasMore=false)
                      const isLastVisible = i === displayedEvents.length - 1;
                      const showMoreVisible = hasMore && !showAll;
                      return (
                        <ChainCard
                          key={event._id}
                          event={event}
                          isLast={isLastVisible && !showMoreVisible}
                        />
                      );
                    })}
                  </AnimatePresence>
                  {/* Show more affordance (extra directive) */}
                  {hasMore && !showAll && (
                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                      >
                        Show {allDisplayedEvents.length - MAX_CHAIN_DISPLAY} more entries
                      </button>
                    </div>
                  )}
                </>
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
