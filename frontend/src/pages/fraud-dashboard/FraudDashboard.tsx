import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Box,
  Boxes,
  Radar as RadarIcon,
  RefreshCcw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long the pulse glow lasts on a metric card after an increase. */
const PULSE_DURATION_MS = 1200;
/** Maximum number of recent events rendered in the list. */
const MAX_EVENTS_DISPLAY = 200;

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// MetricCard (C3: pulse-on-increase via previous-value ref)
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: number;
  display?: string;
  suffix?: string;
  decimals?: number;
  subtext?: string;
  accent?: "red" | "amber" | "blue" | "emerald" | "purple" | "cyan";
  icon: React.ReactNode;
  /** When true, pulse the card (value just increased). */
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
    red: "from-red-500 to-red-600",
    amber: "from-amber-500 to-amber-600",
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    purple: "from-purple-500 to-purple-600",
    cyan: "from-cyan-500 to-cyan-600",
  };
  const gradient = accentMap[accent] ?? accentMap.blue;

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
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md`}
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

// ---------------------------------------------------------------------------
// EventRow — memoized for long list stability (V9)
// ---------------------------------------------------------------------------

interface EventRowItem {
  type: string;
  riskScore: number;
  createdAt: Date | string;
  summary: string;
}

const EventRow = (function () {
  const Row = function ({
    event,
    idx,
    prefersReduced,
  }: {
    event: EventRowItem;
    idx: number;
    prefersReduced: boolean | null;
  }) {
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
  Row.displayName = "EventRow";
  return Row;
})();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function FraudDashboard() {
  const prefersReduced = useReducedMotion();
  const [showAllEvents, setShowAllEvents] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } =
    trpc.fraud.summary.useQuery(undefined, {
      retry: 1,
      // Respect document visibility — react-query's refetchOnWindowFocus handles
      // the tab-focus case; we add refetchInterval gated on document.hidden.
      refetchOnWindowFocus: true,
      refetchInterval: (query) => {
        // 6s interval, but pause when tab is hidden (C3 polling)
        if (typeof document !== "undefined" && document.hidden) return false;
        // Back off after errors
        if (query.state.status === "error") return false;
        return 6000;
      },
    });

  const handleRefresh = () => {
    refetch().catch(() => {
      toast.error("Failed to refresh risk data. Please try again.");
    });
  };

  const summary = data ?? {
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

  // Build a 30-point series from recentEvents (or pad with zeros)
  const series = useMemo(() => {
    const last30 = recentEvents.slice(0, 30).reverse();
    if (last30.length === 0) {
      return Array.from({ length: 12 }).map((_, i) => ({ i, risk: 0 }));
    }
    return last30.map((e, i) => ({ i, risk: e.riskScore * 100 }));
  }, [recentEvents]);

  // ---------------------------------------------------------------------------
  // Pulse logic — previous-value ref to detect delta increases (C3, extra directive)
  // ---------------------------------------------------------------------------
  const prevValuesRef = useRef<Record<string, number>>({});
  const hasBaselineRef = useRef(false);
  const [pulseMap, setPulseMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const current: Record<string, number> = {
      boxCountMismatches: summary.boxCountMismatches,
      totalRfidMissing: summary.totalRfidMissing,
      weightFlagged: summary.weightFlagged,
      anomalyHighSeverity: summary.anomalyHighSeverity,
      recentEvents: recentEvents.length,
    };
    // Skip pulse on the first observation — comparing against an empty prev
    // map caused every card to "pulse" the moment data arrived. We only want
    // to pulse on real deltas between two real observations.
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
    summary.boxCountMismatches,
    summary.totalRfidMissing,
    summary.weightFlagged,
    summary.anomalyHighSeverity,
    recentEvents.length,
  ]);

  // Cap events list (extra directive)
  const displayedEvents = showAllEvents
    ? recentEvents
    : recentEvents.slice(0, MAX_EVENTS_DISPLAY);
  const hasMoreEvents = recentEvents.length > MAX_EVENTS_DISPLAY;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100,#f5f5f5)]">
      <Header title="Fraud & Risk Dashboard" page="fraud-dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Page intro */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Risk Overview
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Aggregated verification events and anomaly signals for your
                  account.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading || isRefetching}
                aria-label="Refresh risk data"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <RefreshCcw
                  className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Refresh
              </button>
            </div>

            {/* Error banner (V3) */}
            {isError && (
              <div
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
                role="alert"
              >
                <AlertTriangle
                  className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Could not load risk data
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {(error as { message?: string })?.message ??
                      "An unexpected error occurred."}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                    aria-label="Retry loading risk data"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Loading skeleton (V1) */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} height={128} />
                ))}
              </div>
            )}

            {!isLoading && (
              <>
                {/* Overall risk banner (C2) */}
                <motion.div
                  initial={{ opacity: 0, y: prefersReduced ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl p-5 flex items-center gap-4 shadow-sm ${
                    overallRiskScore >= 0.7
                      ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                      : overallRiskScore >= 0.4
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                        : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                  }`}
                  role="status"
                  aria-live="polite"
                  aria-label={`Overall account risk score: ${fmtPct(overallRiskScore * 100, 1)}`}
                >
                  <div
                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80">
                      Overall Account Risk Score
                    </p>
                    <p className="text-3xl font-bold">
                      <CountUp
                        value={overallRiskScore * 100}
                        decimals={1}
                        suffix="%"
                      />
                    </p>
                    <p className="text-xs text-white/70 mt-0.5">
                      {recentEvents.length > 0
                        ? `Based on ${recentEvents.length} recent verification event${
                            recentEvents.length !== 1 ? "s" : ""
                          }`
                        : "No events found — account looks clean"}
                    </p>
                  </div>
                </motion.div>

                {/* Risk pulse chart (C2) */}
                <section
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6"
                  aria-label="Risk pulse chart"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      <h2 className="text-base font-semibold text-slate-800">
                        Risk Pulse
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      LAST 30
                    </span>
                  </div>
                  <div className="h-40 -mx-2" aria-hidden="true">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={series}
                        margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="riskGrad"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#3b82f6"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="100%"
                              stopColor="#3b82f6"
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="i" hide />
                        <YAxis
                          width={32}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            fontSize: 12,
                            border: "1px solid #e2e8f0",
                          }}
                          formatter={(v: number) => [fmtPct(v, 1), "risk"]}
                          labelFormatter={() => ""}
                        />
                        <Area
                          type="monotone"
                          dataKey="risk"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#riskGrad)"
                          isAnimationActive={!prefersReduced}
                          animationDuration={500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Metric cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard
                    label="Box Count Mismatches"
                    value={summary.boxCountMismatches}
                    subtext="Expected vs actual box count discrepancies"
                    accent={summary.boxCountMismatches > 0 ? "red" : "emerald"}
                    icon={<Box className="w-5 h-5" />}
                    pulse={pulseMap.boxCountMismatches}
                  />
                  <MetricCard
                    label="Avg Damage Risk"
                    value={summary.avgDamageRiskScore * 100}
                    decimals={1}
                    suffix="%"
                    subtext="Mean damage probability across all shipment diffs"
                    accent={
                      summary.avgDamageRiskScore >= 0.7
                        ? "red"
                        : summary.avgDamageRiskScore >= 0.4
                          ? "amber"
                          : "emerald"
                    }
                    icon={<RadarIcon className="w-5 h-5" />}
                  />
                  <MetricCard
                    label="RFID Tags Missing"
                    value={summary.totalRfidMissing}
                    subtext="Total unaccounted RFID tags across all scans"
                    accent={summary.totalRfidMissing > 0 ? "amber" : "cyan"}
                    icon={<Boxes className="w-5 h-5" />}
                    pulse={pulseMap.totalRfidMissing}
                  />
                  <MetricCard
                    label="Weight Checks Flagged"
                    value={summary.weightFlagged}
                    subtext="Shipments with declared vs actual weight discrepancy"
                    accent={summary.weightFlagged > 0 ? "amber" : "emerald"}
                    icon={<Scale className="w-5 h-5" />}
                    pulse={pulseMap.weightFlagged}
                  />
                  <MetricCard
                    label="High-Severity Anomalies"
                    value={summary.anomalyHighSeverity}
                    subtext="Anomaly reports with high or critical severity"
                    accent={summary.anomalyHighSeverity > 0 ? "red" : "emerald"}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    pulse={pulseMap.anomalyHighSeverity}
                  />
                  <MetricCard
                    label="Total Events"
                    value={recentEvents.length}
                    subtext="Verification events visible in this session"
                    accent="blue"
                    icon={<Activity className="w-5 h-5" />}
                    pulse={pulseMap.recentEvents}
                  />
                </div>

                {/* Recent events list */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">
                      Recent Verification Events
                    </h2>
                    <span className="text-xs text-slate-400">
                      Up to 20 most recent
                    </span>
                  </div>

                  {recentEvents.length === 0 ? (
                    /* Empty state (V2) */
                    <div className="px-6 py-12 text-center">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                        <ShieldCheck
                          className="w-7 h-7 text-emerald-500"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        No events found
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Verification events will appear here as your shipments
                        are processed.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      <AnimatePresence initial>
                        {displayedEvents.map((event, idx) => {
                          const ts = new Date(event.createdAt).getTime();
                          return (
                            <EventRow
                              key={`${event.type}-${ts}-${idx}`}
                              event={event}
                              idx={idx}
                              prefersReduced={prefersReduced}
                            />
                          );
                        })}
                      </AnimatePresence>
                      {/* Show more affordance (extra directive) */}
                      {hasMoreEvents && !showAllEvents && (
                        <div className="px-6 py-4 text-center border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setShowAllEvents(true)}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                          >
                            Show {recentEvents.length - MAX_EVENTS_DISPLAY} more events
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail title="Verification Activity" />
          </aside>
        </div>
      </main>
    </div>
  );
}
