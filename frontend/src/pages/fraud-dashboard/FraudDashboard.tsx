import { useState } from "react";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";
import { toast } from "react-toastify";

// ---------------------------------------------------------------------------
// Helper — format a date nicely
// ---------------------------------------------------------------------------
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Risk score badge
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
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          score >= 0.7
            ? "bg-red-500"
            : score >= 0.4
            ? "bg-amber-500"
            : "bg-emerald-500"
        }`}
      />
      {label} ({(score * 100).toFixed(0)}%)
    </span>
  );
}

// ---------------------------------------------------------------------------
// Event type pill
// ---------------------------------------------------------------------------
const EVENT_COLORS: Record<string, string> = {
  BoxCount: "bg-blue-50 text-blue-700 border border-blue-200",
  ShipmentDiff: "bg-purple-50 text-purple-700 border border-purple-200",
  RfidScan: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  WeightCheck: "bg-orange-50 text-orange-700 border border-orange-200",
  Anomaly: "bg-red-50 text-red-700 border border-red-200",
};

function EventTypePill({ type }: { type: string }) {
  const cls =
    EVENT_COLORS[type] ?? "bg-neutral-50 text-neutral-700 border border-neutral-200";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------
interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: "red" | "amber" | "blue" | "emerald" | "purple" | "cyan";
  icon: React.ReactNode;
}

function MetricCard({ label, value, subtext, accent = "blue", icon }: MetricCardProps) {
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
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md`}
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-neutral-900">{value}</p>
        {subtext && (
          <p className="text-xs text-neutral-400 mt-0.5">{subtext}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FraudDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.fraud.summary.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
    // re-fetch when refreshKey changes via the key trick below
  });

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    refetch().catch(() => {
      toast.error("Failed to refresh risk data. Please try again.");
    });
  };

  const handleError = () => {
    if (isError) {
      toast.error(
        (error as { message?: string })?.message ??
          "Failed to load fraud & risk data."
      );
    }
  };

  // Show toast once on error
  const [errorShown, setErrorShown] = useState(false);
  if (isError && !errorShown) {
    setErrorShown(true);
    setTimeout(handleError, 0);
  }

  const summary = data ?? {
    boxCountMismatches: 0,
    avgDamageRiskScore: 0,
    totalRfidMissing: 0,
    weightFlagged: 0,
    anomalyHighSeverity: 0,
    recentEvents: [],
  };

  const overallRiskScore =
    summary.recentEvents.length > 0
      ? summary.recentEvents.reduce(
          (acc: number, e: { riskScore: number }) => acc + e.riskScore,
          0
        ) / summary.recentEvents.length
      : 0;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100,#f5f5f5)]">
      <Header title="Fraud & Risk Dashboard" page="fraud-dashboard" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Page intro */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              Risk Overview
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Aggregated verification events and anomaly signals for your
              account
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin text-blue-600"
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
                Refreshing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>

        {/* Error banner */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">
                Could not load risk data
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                {(error as { message?: string })?.message ??
                  "An unexpected error occurred."}
              </p>
            </div>
          </div>
        )}

        {/* Skeleton loader */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse h-32"
              />
            ))}
          </div>
        )}

        {/* Metric cards */}
        {!isLoading && (
          <>
            {/* Overall risk banner */}
            <div
              className={`rounded-2xl p-5 flex items-center gap-4 shadow-sm ${
                overallRiskScore >= 0.7
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                  : overallRiskScore >= 0.4
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">
                  Overall Account Risk Score
                </p>
                <p className="text-3xl font-bold">
                  {(overallRiskScore * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-white/70 mt-0.5">
                  {summary.recentEvents.length > 0
                    ? `Based on ${summary.recentEvents.length} recent verification event${
                        summary.recentEvents.length !== 1 ? "s" : ""
                      }`
                    : "No events found — account looks clean"}
                </p>
              </div>
            </div>

            {/* Individual metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label="Box Count Mismatches"
                value={summary.boxCountMismatches}
                subtext="Expected vs actual box count discrepancies"
                accent={summary.boxCountMismatches > 0 ? "red" : "emerald"}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                }
              />

              <MetricCard
                label="Avg Damage Risk Score"
                value={`${(summary.avgDamageRiskScore * 100).toFixed(1)}%`}
                subtext="Mean damage probability across all shipment diffs"
                accent={
                  summary.avgDamageRiskScore >= 0.7
                    ? "red"
                    : summary.avgDamageRiskScore >= 0.4
                    ? "amber"
                    : "emerald"
                }
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                }
              />

              <MetricCard
                label="RFID Tags Missing"
                value={summary.totalRfidMissing}
                subtext="Total unaccounted RFID tags across all scans"
                accent={summary.totalRfidMissing > 0 ? "amber" : "cyan"}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                  </svg>
                }
              />

              <MetricCard
                label="Weight Checks Flagged"
                value={summary.weightFlagged}
                subtext="Shipments with declared vs actual weight discrepancy"
                accent={summary.weightFlagged > 0 ? "amber" : "emerald"}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                }
              />

              <MetricCard
                label="High-Severity Anomalies"
                value={summary.anomalyHighSeverity}
                subtext="Anomaly reports with high or critical severity"
                accent={summary.anomalyHighSeverity > 0 ? "red" : "emerald"}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                }
              />

              <MetricCard
                label="Total Events"
                value={summary.recentEvents.length}
                subtext="Verification events visible in this session"
                accent="blue"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                }
              />
            </div>

            {/* Recent events list */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-neutral-900">
                  Recent Verification Events
                </h2>
                <span className="text-xs text-neutral-400">
                  Up to 20 most recent
                </span>
              </div>

              {summary.recentEvents.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                    <svg
                      className="w-7 h-7 text-emerald-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-700">
                    No events found
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Verification events will appear here as your shipments are
                    processed.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {summary.recentEvents.map((event: { type: string; riskScore: number; createdAt: Date | string; summary: string }, idx: number) => (
                    <div
                      key={idx}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <EventTypePill type={event.type} />
                        <p className="text-sm text-neutral-700 truncate flex-1">
                          {event.summary}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <RiskBadge score={event.riskScore} />
                        <span className="text-xs text-neutral-400 whitespace-nowrap">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
