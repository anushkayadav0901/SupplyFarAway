import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { toast } from "react-toastify";
import { AlertTriangle, Brain, RefreshCcw, ShieldAlert, SearchX } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PULSE_DURATION_MS = 1100;
const SPARKLINE_POINTS = 24;
const MAX_HISTORY_DISPLAY = 200;

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
// ---------------------------------------------------------------------------

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtScore(n: number): string {
  return `${n}/100`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  draftId: string;
  declaredWeightKg: string;
  measuredWeightKg: string;
  declaredCount: string;
  detectedCount: string;
  originCity: string;
  destinationCity: string;
  routeDeviationKm: string;
  extraNotes: string;
}

const initialForm: FormState = {
  draftId: "",
  declaredWeightKg: "",
  measuredWeightKg: "",
  declaredCount: "",
  detectedCount: "",
  originCity: "",
  destinationCity: "",
  routeDeviationKm: "0",
  extraNotes: "",
};

// ---------------------------------------------------------------------------
// Style maps (C4)
// ---------------------------------------------------------------------------

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-emerald-50 border-emerald-200 text-emerald-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  high: "bg-red-50 border-red-200 text-red-800",
};

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const VERDICT_LABEL: Record<string, string> = {
  low: "Trusted",
  medium: "Watch",
  high: "High Risk",
};

// ---------------------------------------------------------------------------
// SignalLine — sparkline using rAF for smooth drift; cleaned up on unmount. (V4)
// ---------------------------------------------------------------------------

interface SignalLineProps {
  label: string;
  amplitude: number;
  phase: number;
  pulsing: boolean;
}

function SignalLine({ label, amplitude, phase, pulsing }: SignalLineProps) {
  const prefersReduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastStepRef = useRef<number>(0);
  // Interval between rAF steps — skip animation if reduced motion preferred
  const stepIntervalMs = prefersReduced ? Infinity : 200;

  useEffect(() => {
    if (prefersReduced) return;

    let running = true;
    const step = (timestamp: number) => {
      if (!running) return;
      if (timestamp - lastStepRef.current >= stepIntervalMs) {
        lastStepRef.current = timestamp;
        setTick((t) => t + 1);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      running = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [prefersReduced, stepIntervalMs]);

  const data = useMemo(() => {
    const out: { t: number; v: number }[] = [];
    const amp = pulsing ? amplitude * 2.6 : amplitude;
    for (let i = 0; i < SPARKLINE_POINTS; i++) {
      const v = Math.sin(i * 0.55 + phase + tick * 0.18) * amp;
      out.push({ t: i, v });
    }
    return out;
  }, [tick, amplitude, phase, pulsing]);

  return (
    <div
      className={`rounded-xl border p-2 transition-colors ${
        pulsing
          ? "border-blue-300 bg-blue-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide truncate">
        {label}
      </p>
      <div className="h-7 -mx-1" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={pulsing ? "#3b82f6" : "#94a3b8"}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verdict chip (C4)
// ---------------------------------------------------------------------------

function VerdictChip({ severity }: { severity: string }) {
  const tone =
    severity === "high"
      ? "bg-red-100 text-red-700 border-red-200"
      : severity === "medium"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";
  const Icon =
    severity === "high" ? ShieldAlert : severity === "medium" ? AlertTriangle : Brain;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase border ${tone}`}
      role="status"
      aria-label={`Severity: ${VERDICT_LABEL[severity] ?? severity}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {VERDICT_LABEL[severity] ?? severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// History row (memoized for stable-props list, V9)
// ---------------------------------------------------------------------------

interface HistoryRowProps {
  r: {
    _id: unknown;
    severity: string;
    riskScore: number;
    originCity: string;
    destinationCity: string;
    flags: string[];
    summary: string;
    createdAt: Date | string;
  };
}

const HistoryRow = React.memo(function HistoryRow({ r }: HistoryRowProps) {
  return (
    <div className="px-6 py-4 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${
              SEVERITY_BADGE[r.severity] ?? "bg-slate-400"
            }`}
          >
            {r.severity}
          </span>
          <span className="text-sm font-medium text-slate-800">
            {r.originCity} → {r.destinationCity}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Risk:{" "}
            <strong className="text-slate-700">{fmtScore(r.riskScore)}</strong>
          </span>
          <span>{fmtDate(r.createdAt)}</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{r.summary}</p>
      {r.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {r.flags.slice(0, 4).map((flag, i) => (
            <span
              key={i}
              className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md"
            >
              {flag}
            </span>
          ))}
          {r.flags.length > 4 && (
            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-400 text-xs rounded-md">
              +{r.flags.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function AnomalyDetection() {
  const prefersReduced = useReducedMotion();
  const [searchParams] = useSearchParams();
  const initialDraftId = searchParams.get("draftId") ?? "";
  const [form, setForm] = useState<FormState>({
    ...initialForm,
    draftId: initialDraftId,
  });
  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const analyzeMutation = trpc.anomaly.analyze.useMutation({
    onError: (err) => {
      toast.error(err.message || "Analysis failed. Please try again.");
    },
  });

  const historyQuery = trpc.anomaly.history.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const declaredWeightKg = parseFloat(form.declaredWeightKg);
    const measuredWeightKg = parseFloat(form.measuredWeightKg);
    const declaredCount = parseInt(form.declaredCount, 10);
    const detectedCount = parseInt(form.detectedCount, 10);
    const routeDeviationKm = parseFloat(form.routeDeviationKm || "0");

    if (
      isNaN(declaredWeightKg) ||
      isNaN(measuredWeightKg) ||
      isNaN(declaredCount) ||
      isNaN(detectedCount) ||
      isNaN(routeDeviationKm)
    ) {
      toast.error("Please fill in all required numeric fields correctly.");
      return;
    }

    if (!form.originCity.trim() || !form.destinationCity.trim()) {
      toast.error("Origin and destination cities are required.");
      return;
    }

    setPulsing(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulsing(false), PULSE_DURATION_MS);

    try {
      await analyzeMutation.mutateAsync({
        draftId: form.draftId.trim() || undefined,
        declaredWeightKg,
        measuredWeightKg,
        declaredCount,
        detectedCount,
        originCity: form.originCity.trim(),
        destinationCity: form.destinationCity.trim(),
        routeDeviationKm,
        extraNotes: form.extraNotes.trim() || undefined,
      });

      toast.success("Analysis complete.");
      utils.anomaly.history.invalidate().catch(() => null);
    } catch {
      // handled by onError
    }
  };

  const latestResult = analyzeMutation.data;

  // Derived radar data — represent each input as a contribution to risk (V12: all values guarded)
  const weightDelta = useMemo(() => {
    const dec = parseFloat(form.declaredWeightKg);
    const meas = parseFloat(form.measuredWeightKg);
    if (!Number.isFinite(dec) || dec <= 0 || !Number.isFinite(meas)) return 0;
    return Math.min(100, (Math.abs(meas - dec) / dec) * 100);
  }, [form.declaredWeightKg, form.measuredWeightKg]);

  const countDelta = useMemo(() => {
    const dec = parseInt(form.declaredCount, 10);
    const det = parseInt(form.detectedCount, 10);
    if (!Number.isFinite(dec) || dec <= 0 || !Number.isFinite(det)) return 0;
    return Math.min(100, (Math.abs(det - dec) / dec) * 100);
  }, [form.declaredCount, form.detectedCount]);

  const routeDelta = useMemo(() => {
    const v = parseFloat(form.routeDeviationKm || "0");
    return Number.isFinite(v) ? Math.min(100, (v / 50) * 100) : 0;
  }, [form.routeDeviationKm]);

  const radarData = useMemo(() => {
    const score = latestResult?.riskScore ?? 0;
    return [
      { axis: "Weight", value: Number.isFinite(weightDelta) ? weightDelta : 0 },
      { axis: "Count", value: Number.isFinite(countDelta) ? countDelta : 0 },
      { axis: "Route", value: Number.isFinite(routeDelta) ? routeDelta : 0 },
      { axis: "Severity", value: Number.isFinite(score) ? score : 0 },
      {
        axis: "Flags",
        value: Math.min(100, (latestResult?.flags?.length ?? 0) * 25),
      },
      {
        axis: "Confidence",
        value: latestResult ? Math.max(20, 100 - (Number.isFinite(score) ? score : 0)) : 0,
      },
    ];
  }, [latestResult, weightDelta, countDelta, routeDelta]);

  // Cap history list at MAX_HISTORY_DISPLAY (extra directive)
  const rawHistory = (historyQuery.data ?? []) as (typeof historyQuery.data extends (infer T)[] | undefined ? T : never)[];
  const displayedHistory = showAllHistory
    ? rawHistory
    : rawHistory.slice(0, MAX_HISTORY_DISPLAY);
  const hasMoreHistory = rawHistory.length > MAX_HISTORY_DISPLAY;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="AI Anomaly Detection" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Signal panel */}
            <section
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6"
              aria-label="Signal monitoring panel"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-800">
                  Signal Panel
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pulsing
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                  aria-live="polite"
                  role="status"
                >
                  {pulsing ? "ANALYSING" : "MONITORING"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SignalLine label="Declared Weight" amplitude={0.6} phase={0.4} pulsing={pulsing} />
                <SignalLine label="Measured Weight" amplitude={0.7} phase={1.1} pulsing={pulsing} />
                <SignalLine label="Declared Count" amplitude={0.55} phase={1.9} pulsing={pulsing} />
                <SignalLine label="Detected Count" amplitude={0.5} phase={2.5} pulsing={pulsing} />
                <SignalLine label="Route Drift" amplitude={0.45} phase={3.2} pulsing={pulsing} />
                <SignalLine label="Operator Notes" amplitude={0.35} phase={4.0} pulsing={pulsing} />
              </div>
            </section>

            {/* Form */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Shipment Inspection Data
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Enter declared vs. measured values to trigger an anomaly scan.
                  </p>
                </div>
                <DraftPicker
                  value={form.draftId}
                  onSelect={(id) => setForm((prev) => ({ ...prev, draftId: id }))}
                />
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="originCity" className="block text-sm font-medium text-slate-700 mb-1">
                      Origin City <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="originCity"
                      type="text"
                      name="originCity"
                      value={form.originCity}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      placeholder="e.g. Shanghai"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="destinationCity" className="block text-sm font-medium text-slate-700 mb-1">
                      Destination City{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="destinationCity"
                      type="text"
                      name="destinationCity"
                      value={form.destinationCity}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      placeholder="e.g. Los Angeles"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="declaredWeightKg" className="block text-sm font-medium text-slate-700 mb-1">
                      Declared Weight (kg){" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="declaredWeightKg"
                      type="number"
                      name="declaredWeightKg"
                      value={form.declaredWeightKg}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="measuredWeightKg" className="block text-sm font-medium text-slate-700 mb-1">
                      Measured Weight (kg){" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="measuredWeightKg"
                      type="number"
                      name="measuredWeightKg"
                      value={form.measuredWeightKg}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="declaredCount" className="block text-sm font-medium text-slate-700 mb-1">
                      Declared Item Count{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="declaredCount"
                      type="number"
                      name="declaredCount"
                      value={form.declaredCount}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="detectedCount" className="block text-sm font-medium text-slate-700 mb-1">
                      Detected Item Count{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="detectedCount"
                      type="number"
                      name="detectedCount"
                      value={form.detectedCount}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="routeDeviationKm" className="block text-sm font-medium text-slate-700 mb-1">
                      Route Deviation (km)
                    </label>
                    <input
                      id="routeDeviationKm"
                      type="number"
                      name="routeDeviationKm"
                      value={form.routeDeviationKm}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="draftId" className="block text-sm font-medium text-slate-700 mb-1">
                      Draft ID (optional)
                    </label>
                    <input
                      id="draftId"
                      type="text"
                      name="draftId"
                      value={form.draftId}
                      onChange={handleChange}
                      placeholder="Link to an existing draft"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="extraNotes" className="block text-sm font-medium text-slate-700 mb-1">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    id="extraNotes"
                    name="extraNotes"
                    value={form.extraNotes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any other observations, unusual circumstances, or context…"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <motion.button
                    type="submit"
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    whileHover={prefersReduced ? undefined : { boxShadow: "0 0 0 3px rgba(59,130,246,0.3)" }}
                    disabled={analyzeMutation.isPending}
                    aria-label="Run AI anomaly analysis"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors duration-150 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                          aria-hidden="true"
                        />
                        Analysing…
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4" aria-hidden="true" />
                        Run AI Analysis
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </section>

            {/* Result skeleton while pending */}
            {analyzeMutation.isPending && <CardSkeleton height={220} />}

            {/* Result card (C1, C2) */}
            <AnimatePresence>
              {latestResult && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: prefersReduced ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: prefersReduced ? 0 : 6 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border p-6 shadow-sm ${
                    SEVERITY_TONE[latestResult.severity] ?? "bg-slate-50 border-slate-200"
                  }`}
                  role="region"
                  aria-label="Analysis result"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <VerdictChip severity={latestResult.severity} />
                      <span className="text-sm font-medium text-slate-700">
                        {latestResult.originCity} → {latestResult.destinationCity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Risk Score
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={latestResult.riskScore}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <motion.div
                            className={`h-full ${
                              SEVERITY_BADGE[latestResult.severity] ?? "bg-slate-400"
                            } rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${latestResult.riskScore}%` }}
                            transition={{ duration: prefersReduced ? 0 : 0.5 }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-800">
                          <CountUp value={latestResult.riskScore} />
                          /100
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="sm:col-span-2">
                      <p className="text-sm leading-relaxed text-slate-700">
                        {latestResult.summary}
                      </p>
                      {(latestResult.flags as string[]).length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-500">
                            Detected Flags
                          </p>
                          <ul className="space-y-1.5" aria-label="Detected flags">
                            {(latestResult.flags as string[]).map((flag, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm text-slate-700"
                              >
                                <AlertTriangle
                                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500"
                                  aria-hidden="true"
                                />
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {/* Radar chart — values already guarded against undefined above */}
                    <div className="h-44 bg-white/60 rounded-xl border border-slate-200" aria-hidden="true">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} outerRadius="75%">
                          <PolarGrid stroke="#cbd5e1" />
                          <PolarAngleAxis
                            dataKey="axis"
                            tick={{ fontSize: 9, fill: "#475569" }}
                          />
                          <Radar
                            dataKey="value"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.35}
                            isAnimationActive={!prefersReduced}
                            animationDuration={500}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Analysis History
                </h2>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch()}
                  aria-label="Refresh analysis history"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Refresh
                </button>
              </div>

              {/* Error state (V3) */}
              {historyQuery.isError && (
                <div className="px-6 py-4 flex items-start gap-3 bg-red-50 border-b border-red-100">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-red-700 font-medium">
                      Failed to load history: {historyQuery.error.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => historyQuery.refetch()}
                      className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {historyQuery.isLoading ? (
                <div className="p-6 space-y-3">
                  <CardSkeleton height={64} />
                  <CardSkeleton height={64} />
                  <CardSkeleton height={64} />
                </div>
              ) : (historyQuery.data ?? []).length === 0 ? (
                /* Empty state (V2) */
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                    <SearchX className="w-6 h-6 text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">No analyses yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Run your first scan using the form above.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {displayedHistory.map((report) => {
                    const r = report as typeof report & {
                      _id: unknown;
                      severity: string;
                      riskScore: number;
                      originCity: string;
                      destinationCity: string;
                      flags: string[];
                      summary: string;
                      createdAt: Date | string;
                    };
                    return <HistoryRow key={String(r._id)} r={r} />;
                  })}
                  {/* Show more affordance */}
                  {hasMoreHistory && !showAllHistory && (
                    <div className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setShowAllHistory(true)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                      >
                        Show {rawHistory.length - MAX_HISTORY_DISPLAY} more entries
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail
              draftId={form.draftId.trim() || undefined}
              title="Verification Activity"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
