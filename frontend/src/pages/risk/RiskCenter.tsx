import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Activity,
  ScrollText,
  RefreshCcw,
  Radar,
} from "lucide-react";
import Header from "../../components/Header";
import DraftPicker from "../../components/DraftPicker";
import TrustGauge from "../../components/TrustGauge";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityColor(s: string): string {
  if (s === "high") return "bg-red-100 text-red-700";
  if (s === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${severityColor(severity)}`}
    >
      {severity}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "red" | "amber" | "blue" | "emerald";
}) {
  const colors: Record<string, string> = {
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent ?? "blue"]}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onPickDraft }: { onPickDraft: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-base font-semibold text-slate-700">No shipment selected</p>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        Pick a draft above to see its trust score, run an anomaly scan, and inspect the audit trail.
      </p>
      <button
        type="button"
        onClick={onPickDraft}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Pick a draft
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RiskCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftId, setDraftId] = useState<string>(searchParams.get("draftId") ?? "");

  // Anomaly scanner form
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [declaredWeight, setDeclaredWeight] = useState("");
  const [measuredWeight, setMeasuredWeight] = useState("");
  const [declaredCount, setDeclaredCount] = useState("");
  const [detectedCount, setDetectedCount] = useState("");
  const [routeDeviation, setRouteDeviation] = useState("0");

  // Audit append form
  const [eventSummary, setEventSummary] = useState("");
  const [eventType, setEventType] = useState("manual-check");

  // Expand/collapse audit rows
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());

  // Ref for DraftPicker focus trigger (CTA button)
  const draftPickerRef = useRef<HTMLButtonElement>(null);

  // Sync URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params);
  }, [draftId, setSearchParams]);

  const utils = trpc.useUtils();

  // ---- queries ----
  const trustQuery = trpc.insights.shipmentTrustScore.useQuery(
    { draftId },
    { enabled: Boolean(draftId), retry: false }
  );

  const auditQuery = trpc.audit.forDraft.useQuery(
    { draftId, order: "newest", limit: 50 },
    { enabled: Boolean(draftId), retry: false }
  );

  const fraudQuery = trpc.fraud.summary.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      if (typeof document !== "undefined" && document.hidden) return false;
      if (q.state.status === "error") return false;
      return 8000;
    },
  });

  const historyQuery = trpc.anomaly.history.useQuery(
    { limit: 10 },
    { retry: false }
  );

  // ---- mutations ----
  const analyzeMut = trpc.anomaly.analyze.useMutation({
    onSuccess: () => {
      toast.success("Anomaly scan complete.");
      utils.anomaly.history.invalidate().catch(() => null);
      if (draftId) {
        utils.insights.shipmentTrustScore.invalidate({ draftId }).catch(() => null);
        utils.audit.forDraft.invalidate({ draftId }).catch(() => null);
      }
    },
    onError: (err) => toast.error(err.message || "Scan failed."),
  });

  const appendMut = trpc.audit.append.useMutation({
    onSuccess: () => {
      toast.success("Event appended.");
      setEventSummary("");
      if (draftId) utils.audit.forDraft.invalidate({ draftId }).catch(() => null);
    },
    onError: (err) => toast.error(err.message || "Failed to append."),
  });

  // ---- derived data ----
  const fraudData = fraudQuery.data;
  const recentEvents = (fraudData?.recentEvents ?? []) as Array<{
    type: string;
    riskScore: number;
    createdAt: Date | string;
    summary: string;
  }>;

  const overallIntegrity = useMemo(() => {
    if (recentEvents.length === 0) return null;
    const avg = recentEvents.reduce((acc, e) => acc + e.riskScore, 0) / recentEvents.length;
    return Math.round((1 - avg) * 100);
  }, [recentEvents]);

  const chartSeries = useMemo(() => {
    const pts = recentEvents.slice(0, 20).reverse();
    if (pts.length === 0) return Array.from({ length: 8 }, (_, i) => ({ i, risk: 0 }));
    return pts.map((e, i) => ({ i, risk: Math.round(e.riskScore * 100) }));
  }, [recentEvents]);

  // ---- handlers ----
  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (analyzeMut.isPending) return;
    if (!originCity.trim() || !destinationCity.trim()) {
      toast.error("Origin and destination are required.");
      return;
    }
    analyzeMut.mutate({
      draftId: draftId || undefined,
      declaredWeightKg: parseFloat(declaredWeight) || 0,
      measuredWeightKg: parseFloat(measuredWeight) || 0,
      declaredCount: parseInt(declaredCount, 10) || 0,
      detectedCount: parseInt(detectedCount, 10) || 0,
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      routeDeviationKm: parseFloat(routeDeviation) || 0,
    });
  }

  function handleAppend(e: React.FormEvent) {
    e.preventDefault();
    if (!eventSummary.trim() || !draftId) return;
    appendMut.mutate({
      draftId,
      eventType,
      summary: eventSummary.trim(),
      payload: { source: "RiskCenter" },
    });
  }

  function toggleAuditRow(id: string) {
    setExpandedAudit((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- trust score breakdown ----
  const trustData = trustQuery.data;
  const breakdown = trustData?.breakdown;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Risk Center" page="risk" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ---- Draft picker ---- */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-base font-bold text-slate-800">Shipment Risk Center</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Select a draft for shipment-specific trust, scan, and audit trail.
              Portfolio overview shows below regardless.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Draft:</span>
            <DraftPicker value={draftId} onSelect={setDraftId} />
            {draftId && (
              <button
                type="button"
                onClick={() => setDraftId("")}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ---- Portfolio stats strip (always visible) ---- */}
        {fraudQuery.data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Box Mismatches"
              value={fraudData?.boxCountMismatches ?? 0}
              accent={(fraudData?.boxCountMismatches ?? 0) > 0 ? "red" : "emerald"}
            />
            <StatCard
              label="RFID Missing"
              value={fraudData?.totalRfidMissing ?? 0}
              accent={(fraudData?.totalRfidMissing ?? 0) > 0 ? "amber" : "emerald"}
            />
            <StatCard
              label="Weight Flagged"
              value={fraudData?.weightFlagged ?? 0}
              accent={(fraudData?.weightFlagged ?? 0) > 0 ? "amber" : "emerald"}
            />
            <StatCard
              label="High Severity"
              value={fraudData?.anomalyHighSeverity ?? 0}
              accent={(fraudData?.anomalyHighSeverity ?? 0) > 0 ? "red" : "emerald"}
            />
            <StatCard
              label="Account Integrity"
              value={overallIntegrity !== null ? `${overallIntegrity}%` : "--"}
              accent={
                overallIntegrity === null
                  ? "blue"
                  : overallIntegrity >= 80
                  ? "emerald"
                  : overallIntegrity >= 50
                  ? "amber"
                  : "red"
              }
            />
          </div>
        )}

        {/* ---- Risk trend chart (always visible) ---- */}
        {recentEvents.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-slate-800">Risk Pulse (recent events)</p>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis
                    width={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                    formatter={(v: number) => [`${v}%`, "risk"]}
                    labelFormatter={() => ""}
                  />
                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#riskGradient)"
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ---- Draft-specific panel ---- */}
        {!draftId ? (
          <EmptyState onPickDraft={() => draftPickerRef.current?.click()} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left: Trust Gauge + breakdown */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center gap-4">
              <p className="text-sm font-bold text-slate-700 self-start">Trust Score</p>
              {trustQuery.isLoading ? (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm animate-pulse w-full">
                  Loading…
                </div>
              ) : trustData ? (
                <>
                  <TrustGauge
                    value={trustData.score}
                    label={trustData.verdict}
                    size={160}
                  />
                  <div className="w-full border-t border-slate-100 pt-3 space-y-2">
                    {breakdown &&
                      (Object.entries(breakdown) as Array<
                        [string, { score: number; note: string; latestAt: Date | null }]
                      >).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 capitalize">{key}</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-1.5 rounded-full bg-slate-200 w-20 overflow-hidden"
                              title={val.note}
                            >
                              <div
                                className={`h-full rounded-full ${
                                  val.score >= 80
                                    ? "bg-emerald-500"
                                    : val.score >= 50
                                    ? "bg-blue-500"
                                    : val.score >= 30
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${val.score}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-700 w-7 text-right">
                              {val.score}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 py-8">No trust data for this draft.</p>
              )}
            </div>

            {/* Right: Scanner + Audit Trail */}
            <div className="lg:col-span-8 space-y-5">

              {/* Anomaly Scanner */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Radar className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-slate-800">Anomaly Scanner</p>
                </div>
                <form onSubmit={handleScan} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Origin City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chicago"
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Destination City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Detroit"
                        value={destinationCity}
                        onChange={(e) => setDestinationCity(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Declared Weight (kg)
                      </label>
                      <input
                        type="number"
                        placeholder="500"
                        value={declaredWeight}
                        onChange={(e) => setDeclaredWeight(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Measured Weight (kg)
                      </label>
                      <input
                        type="number"
                        placeholder="505"
                        value={measuredWeight}
                        onChange={(e) => setMeasuredWeight(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Declared Count
                      </label>
                      <input
                        type="number"
                        placeholder="100"
                        value={declaredCount}
                        onChange={(e) => setDeclaredCount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Detected Count
                      </label>
                      <input
                        type="number"
                        placeholder="98"
                        value={detectedCount}
                        onChange={(e) => setDetectedCount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Route Deviation (km)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={routeDeviation}
                      onChange={(e) => setRouteDeviation(e.target.value)}
                      className="w-full sm:w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={analyzeMut.isPending}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {analyzeMut.isPending ? "Scanning…" : "Run Anomaly Scan"}
                    </button>
                  </div>
                </form>

                {/* Latest scan result */}
                {analyzeMut.data && (
                  <div
                    className={`mt-4 p-4 rounded-xl border text-sm ${
                      analyzeMut.data.severity === "high"
                        ? "bg-red-50 border-red-200 text-red-800"
                        : analyzeMut.data.severity === "medium"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      {analyzeMut.data.severity !== "low" ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Severity: {analyzeMut.data.severity} — Risk score: {analyzeMut.data.riskScore}
                    </div>
                    <p className="text-xs leading-relaxed">{analyzeMut.data.summary}</p>
                    {Array.isArray(analyzeMut.data.flags) && analyzeMut.data.flags.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {(analyzeMut.data.flags as string[]).map((f, i) => (
                          <li key={i} className="text-xs">• {f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Recent scan history */}
              {historyQuery.data && historyQuery.data.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-bold text-slate-800 mb-3">Recent Scans</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {historyQuery.data.map((r) => (
                      <div
                        key={String(r._id)}
                        className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 truncate">{r.summary}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            {r.originCity} → {r.destinationCity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <SeverityBadge severity={r.severity} />
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {fmtDateTime(r.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Trail */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-bold text-slate-800">Audit Trail</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => auditQuery.refetch()}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    <RefreshCcw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {/* Append event form */}
                <form onSubmit={handleAppend} className="flex flex-col sm:flex-row gap-2 mb-4 pb-4 border-b border-slate-100">
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="manual-check">Manual Check</option>
                    <option value="seal-intact">Seal Intact</option>
                    <option value="route-override">Route Override</option>
                    <option value="note">Note</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Describe the event…"
                    value={eventSummary}
                    onChange={(e) => setEventSummary(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={appendMut.isPending}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50"
                  >
                    Append
                  </button>
                </form>

                {/* Audit log rows */}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {auditQuery.isLoading ? (
                    <p className="text-xs text-slate-400 text-center py-6 animate-pulse">Loading audit trail…</p>
                  ) : !auditQuery.data || auditQuery.data.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No audit records for this draft.</p>
                  ) : (
                    (auditQuery.data as Array<{
                      _id: unknown;
                      eventType: string;
                      summary: string;
                      createdAt: Date | string;
                      payload?: Record<string, unknown>;
                    }>).map((log) => {
                      const id = String(log._id);
                      const isOpen = expandedAudit.has(id);
                      return (
                        <div
                          key={id}
                          className="rounded-lg border border-slate-200 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleAuditRow(id)}
                            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                                {log.eventType}
                              </span>
                              <span className="text-xs text-slate-700 truncate">{log.summary}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2 flex-shrink-0">
                              {fmtDateTime(log.createdAt)}
                            </span>
                          </button>
                          {isOpen && log.payload && Object.keys(log.payload).length > 0 && (
                            <div className="px-3 py-2 bg-white border-t border-slate-100">
                              <pre className="text-[10px] text-slate-500 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Recent event feed (always visible at bottom) ---- */}
        {recentEvents.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Recent Verification Events</p>
              <span className="text-xs text-slate-400">{recentEvents.length} events</span>
            </div>
            <div className="divide-y divide-slate-100">
              {recentEvents.slice(0, 15).map((ev, idx) => (
                <div
                  key={idx}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium flex-shrink-0">
                    {ev.type}
                  </span>
                  <p className="text-xs text-slate-700 flex-1 truncate">{ev.summary}</p>
                  <span
                    className={`text-xs font-semibold flex-shrink-0 ${
                      ev.riskScore >= 0.7
                        ? "text-red-600"
                        : ev.riskScore >= 0.4
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {Math.round(ev.riskScore * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                    {fmtDateTime(ev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
