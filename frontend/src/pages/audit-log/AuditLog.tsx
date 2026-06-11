import { useState } from "react";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";
import { toast } from "react-toastify";

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

export default function AuditLog() {
  // Form state for append mutation
  const [draftId, setDraftId] = useState("");
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0]);
  const [summary, setSummary] = useState("");
  const [payloadRaw, setPayloadRaw] = useState("");

  // Query mode toggle
  const [queryMode, setQueryMode] = useState<"recent" | "forDraft">("recent");
  const [filterDraftId, setFilterDraftId] = useState("");
  const [recentLimit, setRecentLimit] = useState(30);

  // Active query draft id (only update when user explicitly searches)
  const [activeDraftId, setActiveDraftId] = useState("");

  const appendMutation = trpc.audit.append.useMutation({
    onSuccess: () => {
      setSummary("");
      setPayloadRaw("");
      utils.audit.recent.invalidate();
      utils.audit.forDraft.invalidate({ draftId: draftId });
      toast.success("Audit event recorded successfully.");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to record audit event.");
    },
  });

  const utils = trpc.useUtils();

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

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const eventTypeColor: Record<string, string> = {
    box_count: "bg-blue-100 text-blue-800",
    rfid_scan: "bg-purple-100 text-purple-800",
    weight_check: "bg-amber-100 text-amber-800",
    anomaly_report: "bg-red-100 text-red-800",
    manual_inspection: "bg-green-100 text-green-800",
    customs_verification: "bg-indigo-100 text-indigo-800",
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Verification Audit Log" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Append Event Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
            <h2 className="text-lg font-semibold text-slate-800">
              Record Verification Event
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Append an audit entry to a shipment draft.
            </p>
          </div>

          <form onSubmit={handleAppend} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Draft ID */}
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

              {/* Event Type */}
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
                      {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Summary */}
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

            {/* Payload (optional JSON) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                Payload{" "}
                <span className="text-slate-400 font-normal">(optional JSON)</span>
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
              <button
                type="submit"
                disabled={appendMutation.isPending}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 min-w-[140px]"
              >
                {appendMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Record Event"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Query Controls Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">View Audit History</h2>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQueryMode("recent")}
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
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                  Show last
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={recentLimit}
                  onChange={(e) =>
                    setRecentLimit(Math.min(100, Math.max(1, Number(e.target.value))))
                  }
                  className="w-20 px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">events</span>
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
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Search
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              {queryMode === "recent"
                ? `Recent Events (last ${recentLimit})`
                : activeDraftId
                ? `Events for Draft: ${activeDraftId}`
                : "Events"}
            </h2>
            {!isQueryLoading && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1">
                {displayedEvents.length} record{displayedEvents.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {isQueryLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading audit events...</p>
            </div>
          ) : queryError ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-red-600">
                {queryError.message ?? "Failed to load events."}
              </p>
            </div>
          ) : displayedEvents.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">No audit events found</p>
              <p className="text-xs text-slate-400 mt-1">
                {queryMode === "forDraft" && !activeDraftId
                  ? "Enter a Draft ID above and click Search."
                  : "Record your first event using the form above."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {displayedEvents.map((event) => {
                const badgeClass =
                  eventTypeColor[event.eventType] ??
                  "bg-slate-100 text-slate-700";
                return (
                  <li key={event._id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
                          >
                            {event.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            draft: {event.draftId}
                          </span>
                        </div>

                        <p className="text-sm text-slate-800 font-medium leading-snug">
                          {event.summary}
                        </p>

                        {event.payload && Object.keys(event.payload).length > 0 && (
                          <details className="group">
                            <summary className="text-xs text-blue-600 cursor-pointer select-none hover:text-blue-800 transition-colors">
                              View payload
                            </summary>
                            <pre className="mt-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>

                      <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 pt-0.5">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
