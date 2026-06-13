import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ShieldAlert,
  RefreshCcw,
  Radar,
  ScrollText,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Box,
  Boxes,
  Scale,
  Radar as RadarIcon,
} from "lucide-react";
import Header from "../../components/Header";
import DraftPicker from "../../components/DraftPicker";
import TrustGauge from "../../components/TrustGauge";
import InsightsRail from "../../components/InsightsRail";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import CountUp from "../../components/CountUp";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
const PULSE_DURATION_MS = 1200;
const MAX_EVENTS_DISPLAY = 200;

const getRiskColor = (score: number) => {
  if (score >= 60) return "text-red-600";
  if (score >= 30) return "text-amber-600";
  return "text-emerald-600";
};

const getRiskBg = (score: number) => {
  if (score >= 60) return "bg-red-50 border-red-200 text-red-700";
  if (score >= 30) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-emerald-50 border-emerald-200 text-emerald-700";
};

function fmtDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPct(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function RiskBadge({ score }: { score: number }) {
  let color = "bg-emerald-100 text-emerald-700";
  let label = "Low";
  if (score >= 0.7) {
    color = "bg-red-100 text-red-700";
    label = "High";
  } else if (score >= 0.4) {
    color = "bg-amber-100 text-amber-700";
    label = "Medium";
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}
      aria-label={`Risk level: ${label} (${fmtPct(score * 100, 0)})`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          score >= 0.7
            ? "bg-red-500"
            : score >= 0.4
              ? "bg-amber-500"
              : "bg-emerald-500"
        }`}
        aria-hidden="true"
      />
      {label} ({fmtPct(score * 100, 0)})
    </span>
  );
}

const EVENT_COLORS: Record<string, string> = {
  BoxCount: "bg-blue-50 text-blue-700 border border-blue-200",
  ShipmentDiff: "bg-purple-50 text-purple-700 border border-purple-200",
  RfidScan: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  WeightCheck: "bg-orange-50 text-orange-700 border border-orange-200",
  Anomaly: "bg-red-50 text-red-700 border border-red-200",
};

function EventTypePill({ type }: { type: string }) {
  const cls =
    EVENT_COLORS[type] ??
    "bg-slate-50 text-slate-700 border border-slate-200";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type}
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  display?: string;
  suffix?: string;
  decimals?: number;
  subtext?: string;
  accent?: "red" | "amber" | "blue" | "emerald" | "purple" | "cyan";
  icon: React.ReactNode;
  pulse?: boolean;
}

function MetricCard({
  label,
  value,
  display,
  suffix,
  decimals,
  subtext,
  accent = "blue",
  icon,
  pulse,
}: MetricCardProps) {
  const prefersReduced = useReducedMotion();
  const accentMap: Record<string, string> = {
    red: "bg-red-500 text-white shadow-red-200",
    amber: "bg-amber-500 text-white shadow-amber-200",
    blue: "bg-blue-500 text-white shadow-blue-200",
    emerald: "bg-emerald-500 text-white shadow-emerald-200",
    purple: "bg-purple-500 text-white shadow-purple-200",
    cyan: "bg-cyan-500 text-white shadow-cyan-200",
  };
  const bgClass = accentMap[accent] ?? accentMap.blue;

  return (
    <motion.div
      whileHover={prefersReduced ? undefined : { y: -2 }}
      animate={
        pulse && !prefersReduced
          ? {
              boxShadow: [
                "0 0 0 0 rgba(59,130,246,0)",
                "0 0 0 6px rgba(59,130,246,0.18)",
                "0 0 0 0 rgba(59,130,246,0)",
              ],
            }
          : { boxShadow: "0 0 0 0 rgba(59,130,246,0)" }
      }
      transition={{ duration: 0.8 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div
          className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900" aria-label={`${label}: ${display ?? value}`}>
          {display ?? (
            <CountUp value={value} decimals={decimals} suffix={suffix} />
          )}
        </p>
        {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
      </div>
    </motion.div>
  );
}

interface EventRowItem {
  type: string;
  riskScore: number;
  createdAt: Date | string;
  summary: string;
}

const EventRow = ({
  event,
  idx,
  prefersReduced,
}: {
  event: EventRowItem;
  idx: number;
  prefersReduced: boolean;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: prefersReduced ? 0 : -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: prefersReduced ? 0 : Math.min(idx * 0.02, 0.2) }}
      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <EventTypePill type={event.type} />
        <p className="text-sm text-slate-700 truncate flex-1">{event.summary}</p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <RiskBadge score={event.riskScore} />
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {fmtDateTime(event.createdAt)}
        </span>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function RiskCenter() {
  const prefersReduced = useReducedMotion() ?? false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftId, setDraftId] = useState<string>(searchParams.get("draftId") ?? "");
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Anomaly Scanner form state
  const [declaredWeight, setDeclaredWeight] = useState("");
  const [measuredWeight, setMeasuredWeight] = useState("");
  const [declaredCount, setDeclaredCount] = useState("");
  const [detectedCount, setDetectedCount] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [routeDeviation, setRouteDeviation] = useState("0");
  const [scannerNotes, setScannerNotes] = useState("");

  // Audit append state
  const [eventSummary, setEventSummary] = useState("");
  const [eventType, setEventType] = useState("manual-check");

  // URL query sync
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params);
  }, [draftId, setSearchParams]);

  const utils = trpc.useUtils();

  // Queries
  const trustScoreQuery = trpc.insights.shipmentTrustScore.useQuery(
    { draftId },
    { enabled: Boolean(draftId), retry: false }
  );

  const auditLogsQuery = trpc.audit.forDraft.useQuery(
    { draftId },
    { enabled: Boolean(draftId), retry: false }
  );

  const recentAuditsQuery = trpc.audit.recent.useQuery(
    { limit: 20 },
    { enabled: !draftId, retry: false }
  );

  const fraudQuery = trpc.fraud.summary.useQuery(undefined, {
    enabled: !draftId,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.hidden) return false;
      if (query.state.status === "error") return false;
      return 6000;
    },
  });

  // Mutations
  const analyzeMutation = trpc.anomaly.analyze.useMutation({
    onSuccess: () => {
      toast.success("Anomaly scan complete.");
      utils.anomaly.history.invalidate().catch(() => null);
      utils.audit.recent.invalidate().catch(() => null);
      if (draftId) {
        utils.audit.forDraft.invalidate({ draftId }).catch(() => null);
        utils.insights.shipmentTrustScore.invalidate({ draftId }).catch(() => null);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Analysis failed.");
    },
  });

  const appendAuditMutation = trpc.audit.append.useMutation({
    onSuccess: () => {
      toast.success("Event appended to audit log.");
      setEventSummary("");
      utils.audit.recent.invalidate().catch(() => null);
      if (draftId) {
        utils.audit.forDraft.invalidate({ draftId }).catch(() => null);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to append audit event.");
    },
  });

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (analyzeMutation.isPending) return;

    if (!originCity.trim() || !destinationCity.trim()) {
      toast.error("Origin and destination cities are required.");
      return;
    }

    await analyzeMutation.mutateAsync({
      draftId: draftId.trim() || undefined,
      declaredWeightKg: parseFloat(declaredWeight) || 0,
      measuredWeightKg: parseFloat(measuredWeight) || 0,
      declaredCount: parseInt(declaredCount, 10) || 0,
      detectedCount: parseInt(detectedCount, 10) || 0,
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      routeDeviationKm: parseFloat(routeDeviation) || 0,
      extraNotes: scannerNotes.trim() || undefined,
    });
  };

  const handleAppendAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventSummary.trim()) {
      toast.error("Event summary is required.");
      return;
    }
    await appendAuditMutation.mutateAsync({
      draftId: draftId.trim() || "global",
      eventType,
      summary: eventSummary.trim(),
      payload: { clientType: "RiskCenterUnified" },
    });
  };

  // Pulse & Macro calculations
  const summary = fraudQuery.data ?? {
    boxCountMismatches: 0,
    avgDamageRiskScore: 0,
    totalRfidMissing: 0,
    weightFlagged: 0,
    anomalyHighSeverity: 0,
    recentEvents: [] as EventRowItem[],
  };
  const recentEvents = summary.recentEvents as EventRowItem[];

  const overallRiskScore = useMemo(
    () =>
      recentEvents.length > 0
        ? recentEvents.reduce((acc, e) => acc + e.riskScore, 0) / recentEvents.length
        : 0,
    [recentEvents]
  );

  const series = useMemo(() => {
    const last30 = recentEvents.slice(0, 30).reverse();
    if (last30.length === 0) {
      return Array.from({ length: 12 }).map((_, i) => ({ i, risk: 0 }));
    }
    return last30.map((e, i) => ({ i, risk: e.riskScore * 100 }));
  }, [recentEvents]);

  const prevValuesRef = useRef<Record<string, number>>({});
  const hasBaselineRef = useRef(false);
  const [pulseMap, setPulseMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (draftId) return;
    const current: Record<string, number> = {
      boxCountMismatches: summary.boxCountMismatches,
      totalRfidMissing: summary.totalRfidMissing,
      weightFlagged: summary.weightFlagged,
      anomalyHighSeverity: summary.anomalyHighSeverity,
      recentEvents: recentEvents.length,
    };
    if (!hasBaselineRef.current) {
      prevValuesRef.current = current;
      hasBaselineRef.current = true;
      return;
    }
    const prev = prevValuesRef.current;
    const nextPulse: Record<string, boolean> = {};
    let dirty = false;
    for (const k of Object.keys(current)) {
      if (prev[k] !== undefined && current[k] > prev[k]) {
        nextPulse[k] = true;
        dirty = true;
      }
    }
    prevValuesRef.current = current;
    if (dirty) {
      setPulseMap(nextPulse);
      const t = setTimeout(() => setPulseMap({}), PULSE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [
    draftId,
    summary.boxCountMismatches,
    summary.totalRfidMissing,
    summary.weightFlagged,
    summary.anomalyHighSeverity,
    recentEvents.length,
  ]);

  const displayedEvents = showAllEvents
    ? recentEvents
    : recentEvents.slice(0, MAX_EVENTS_DISPLAY);
  const hasMoreEvents = recentEvents.length > MAX_EVENTS_DISPLAY;

  // Resolve audit list to display
  const displayLogs = draftId ? auditLogsQuery.data ?? [] : recentAuditsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Risk &amp; Trust Center" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        
        {/* Context Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Shipment Intelligence</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select a draft to view aggregated risk, run anomaly scans, and inspect the audit trail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Active Draft:</span>
            <DraftPicker value={draftId} onSelect={setDraftId} />
          </div>
        </div>

        {draftId ? (
          /* =========================================================================
             DRAFT DRILL-DOWN VIEW (Shipment Specific)
             ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Trust Gauge */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                <h3 className="text-base font-semibold text-slate-800 mb-6">Aggregated Trust Rating</h3>
                {trustScoreQuery.isLoading ? (
                  <div className="h-44 flex items-center justify-center animate-pulse text-slate-400">Loading trust rating...</div>
                ) : trustScoreQuery.data ? (
                  <div className="space-y-4 w-full flex flex-col items-center">
                    <TrustGauge value={trustScoreQuery.data.score} label="Trust Score" />
                    <p className={`text-sm font-bold mt-2 ${getRiskColor(100 - trustScoreQuery.data.score)}`}>
                      {trustScoreQuery.data.score >= 80 ? "Certified Safe" : trustScoreQuery.data.score >= 50 ? "Moderate Integrity Risk" : "High Tampering Risk"}
                    </p>
                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 space-y-1 w-full text-left">
                      <p>Compliance Status: <span className="font-semibold text-slate-700">{trustScoreQuery.data.details.compliance ? "Passed" : "Failed / Missing"}</span></p>
                      <p>Verification Checks: <span className="font-semibold text-slate-700">{trustScoreQuery.data.details.verification ? "Verified" : "Unverified"}</span></p>
                      <p>Route Integrity: <span className="font-semibold text-slate-700">{trustScoreQuery.data.details.routeIntegrity ? "No Deviation" : "Deviations Found"}</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-slate-400">No trust score data found.</div>
                )}
              </div>
            </div>

            {/* Right Side: Scanner & Audit Trail */}
            <div className="lg:col-span-8 space-y-6">
              {/* Anomaly Scanner */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Radar className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-800">Multivariate Anomaly Scanner</h3>
                </div>
                <form onSubmit={handleScanSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Declared Weight (kg)</label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={declaredWeight}
                        onChange={(e) => setDeclaredWeight(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Measured Weight (kg)</label>
                      <input
                        type="number"
                        placeholder="e.g. 505"
                        value={measuredWeight}
                        onChange={(e) => setMeasuredWeight(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Route Deviation (km)</label>
                      <input
                        type="number"
                        placeholder="e.g. 15"
                        value={routeDeviation}
                        onChange={(e) => setRouteDeviation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Origin City</label>
                      <input
                        type="text"
                        placeholder="e.g. Chicago"
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Destination City</label>
                      <input
                        type="text"
                        placeholder="e.g. Detroit"
                        value={destinationCity}
                        onChange={(e) => setDestinationCity(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={analyzeMutation.isPending}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                    >
                      {analyzeMutation.isPending ? "Analyzing Heuristics..." : "Run Anomaly Scan"}
                    </button>
                  </div>
                </form>

                {analyzeMutation.data && (
                  <div className={`mt-4 p-4 rounded-xl border ${analyzeMutation.data.flagged ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {analyzeMutation.data.flagged ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-emerald-600" />}
                      {analyzeMutation.data.flagged ? "Anomalies Flagged" : "No Anomalies Found"}
                    </div>
                    <p className="text-xs mt-1 leading-relaxed">{analyzeMutation.data.reason}</p>
                  </div>
                )}
              </div>

              {/* Audit Log */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-800">Audit Trail: {draftId}</h3>
                  </div>
                  <button
                    onClick={() => auditLogsQuery.refetch()}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                <form onSubmit={handleAppendAudit} className="flex flex-col sm:flex-row gap-2 border-b border-slate-100 pb-4">
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="manual-check">Manual Check</option>
                    <option value="seal-intact">Seal Intact</option>
                    <option value="route-override">Route Override</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Describe event (e.g. Checked physical seal security)"
                    value={eventSummary}
                    onChange={(e) => setEventSummary(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={appendAuditMutation.isPending}
                    className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
                  >
                    Append Event
                  </button>
                </form>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {displayLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No audit records found.</p>
                  ) : (
                    displayLogs.map((log: any) => (
                      <div key={log._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{log.eventType}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">{log.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             OVERALL PORTFOLIO VIEW (Fraud Dashboard & Risk Overview)
             ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              
              {fraudQuery.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CardSkeleton key={i} height={128} />
                  ))}
                </div>
              ) : fraudQuery.error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                  <p className="text-sm font-medium text-red-800">Could not load risk data</p>
                  <button onClick={() => fraudQuery.refetch()} className="text-xs text-red-600 underline mt-1">Retry</button>
                </div>
              ) : (
                <>
                  {/* Overall Integrity Shield Card */}
                  <motion.div
                    initial={{ opacity: 0, y: prefersReduced ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl p-5 flex items-center gap-4 shadow-sm border ${
                      overallRiskScore >= 0.7
                        ? "bg-red-50 border-red-200 text-red-800"
                        : overallRiskScore >= 0.4
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}
                  >
                    <div className="w-16 h-16 flex-shrink-0">
                      <TrustGauge value={(1 - overallRiskScore) * 100} size={64} label="" pulse={false} compact />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Overall Account Integrity</p>
                      <p className="text-2xl font-black text-slate-800 mt-0.5">
                        <CountUp value={(1 - overallRiskScore) * 100} decimals={1} suffix="%" />
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Based on {recentEvents.length} recent verification events in this active session.
                      </p>
                    </div>
                  </motion.div>

                  {/* Risk Pulse area chart */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        <h2 className="text-base font-semibold text-slate-800">Account Risk Pulse</h2>
                      </div>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        RECENT RUNS
                      </span>
                    </div>
                    <div className="h-40 -mx-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="riskGrad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="i" hide />
                          <YAxis width={32} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                            formatter={(v: number) => [fmtPct(v, 1), "risk"]}
                            labelFormatter={() => ""}
                          />
                          <Area type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={2} fill="url(#riskGrad)" isAnimationActive={!prefersReduced} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 6 Grid Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <MetricCard
                      label="Box Count Mismatches"
                      value={summary.boxCountMismatches}
                      subtext="Discrepancies flagged by cameras"
                      accent={summary.boxCountMismatches > 0 ? "red" : "emerald"}
                      icon={<Box className="w-5 h-5" />}
                      pulse={pulseMap.boxCountMismatches}
                    />
                    <MetricCard
                      label="Avg Damage Risk"
                      value={summary.avgDamageRiskScore * 100}
                      decimals={1}
                      suffix="%"
                      subtext="Average visual damage probability"
                      accent={summary.avgDamageRiskScore >= 0.6 ? "red" : summary.avgDamageRiskScore >= 0.3 ? "amber" : "emerald"}
                      icon={<RadarIcon className="w-5 h-5" />}
                    />
                    <MetricCard
                      label="RFID Tags Missing"
                      value={summary.totalRfidMissing}
                      subtext="Unreconciled hardware tags"
                      accent={summary.totalRfidMissing > 0 ? "amber" : "cyan"}
                      icon={<Boxes className="w-5 h-5" />}
                      pulse={pulseMap.totalRfidMissing}
                    />
                    <MetricCard
                      label="Weight Checks Flagged"
                      value={summary.weightFlagged}
                      subtext="Gross weight discrepancies"
                      accent={summary.weightFlagged > 0 ? "amber" : "emerald"}
                      icon={<Scale className="w-5 h-5" />}
                      pulse={pulseMap.weightFlagged}
                    />
                    <MetricCard
                      label="High-Severity Anomalies"
                      value={summary.anomalyHighSeverity}
                      subtext="System critical severity flags"
                      accent={summary.anomalyHighSeverity > 0 ? "red" : "emerald"}
                      icon={<AlertTriangle className="w-5 h-5" />}
                      pulse={pulseMap.anomalyHighSeverity}
                    />
                    <MetricCard
                      label="Total Verification Runs"
                      value={recentEvents.length}
                      subtext="Total logs parsed"
                      accent="blue"
                      icon={<Activity className="w-5 h-5" />}
                      pulse={pulseMap.recentEvents}
                    />
                  </div>

                  {/* Recent events list */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900">Recent Verification Events</h2>
                      <span className="text-xs text-slate-400">Chronological feed</span>
                    </div>

                    {recentEvents.length === 0 ? (
                      <div className="px-6 py-12 text-center text-slate-400">
                        <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No events logged yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        <AnimatePresence initial>
                          {displayedEvents.map((event, idx) => (
                            <EventRow
                              key={`${event.type}-${new Date(event.createdAt).getTime()}-${idx}`}
                              event={event}
                              idx={idx}
                              prefersReduced={prefersReduced}
                            />
                          ))}
                        </AnimatePresence>
                        {hasMoreEvents && !showAllEvents && (
                          <div className="px-6 py-4 text-center border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setShowAllEvents(true)}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                            >
                              Show all {recentEvents.length} events
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-4">
              <InsightsRail title="Verification Activity" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
