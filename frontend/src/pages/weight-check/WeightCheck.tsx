import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "react-toastify";
import { Scale, RefreshCcw, Activity } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ─── constants ────────────────────────────────────────────────────────────────
const IDLE_TICK_MS = 500;
const STREAM_TICK_MS = 180;
const STREAM_STEPS = 20;
const IDLE_BASELINE_KG = 50;
const SERIES_WINDOW = 29;
const DEFAULT_THRESHOLD_PCT = "5";
const HISTORY_LIMIT = 20;

// ─── types ────────────────────────────────────────────────────────────────────

interface FormState {
  draftId: string;
  declaredWeightKg: string;
  measuredWeightKg: string;
  thresholdPct: string;
}

const initialForm: FormState = {
  draftId: "",
  declaredWeightKg: "",
  measuredWeightKg: "",
  thresholdPct: DEFAULT_THRESHOLD_PCT,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeIdleSeries(): { t: number; kg: number }[] {
  const out: { t: number; kg: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const drift = Math.sin(i * 0.35) * 0.4 + Math.cos(i * 0.7) * 0.15;
    out.push({ t: i, kg: IDLE_BASELINE_KG + drift });
  }
  return out;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPct(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeightCheck() {
  const shouldReduceMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    draftId: searchParams.get("draftId") ?? "",
  }));
  const [series, setSeries] = useState<{ t: number; kg: number }[]>(() =>
    makeIdleSeries()
  );
  const [streaming, setStreaming] = useState(false);

  // Use refs for timer IDs — no requestAnimationFrame here since we use setInterval
  // (recharts LineChart with isAnimationActive=false redraws fine on state updates)
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const utils = trpc.useUtils();

  const submitMutation = trpc.weightCheck.submit.useMutation({
    onSuccess: () => {
      toast.success("Weight check submitted.");
      utils.weightCheck.history.invalidate().catch(() => void 0);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit weight check.");
    },
  });

  const historyQuery = trpc.weightCheck.history.useQuery({ limit: HISTORY_LIMIT });

  // unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      idleTimerRef.current = null;
      streamTimerRef.current = null;
    };
  }, []);

  // Latest form values held in a ref so the idle drift loop can read them
  // without re-creating its interval on every keystroke.
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  // Idle drift loop — paused while streaming. Note: deliberately does NOT depend
  // on form values; we read latest via formRef to avoid timer churn on every keystroke.
  useEffect(() => {
    if (streaming) return;
    idleTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setSeries((prev) => {
        const last = prev.length > 0 ? prev[prev.length - 1].kg : IDLE_BASELINE_KG;
        const f = formRef.current;
        const target =
          parseFloat(f.measuredWeightKg) ||
          parseFloat(f.declaredWeightKg) ||
          IDLE_BASELINE_KG;
        const drift = (Math.random() - 0.5) * 0.3 + (target - last) * 0.005;
        const nextKg = last + drift;
        const nextT = (prev[prev.length - 1]?.t ?? 0) + 1;
        return [...prev.slice(-SERIES_WINDOW), { t: nextT, kg: nextKg }];
      });
    }, IDLE_TICK_MS);
    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    };
  }, [streaming]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Hold the active resolver so the Cancel button can resolve runStream() with
  // a "cancelled" outcome, freeing the awaiting handleSubmit() instead of
  // leaving it hanging on a promise that's never settled.
  const streamResolverRef = useRef<((cancelled: boolean) => void) | null>(null);

  const runStream = (declared: number, measured: number): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (!mountedRef.current) { resolve(true); return; }
      setStreaming(true);
      streamResolverRef.current = resolve;
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      let step = 0;
      streamTimerRef.current = setInterval(() => {
        if (!mountedRef.current) {
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          streamResolverRef.current = null;
          resolve(true);
          return;
        }
        step++;
        const progress = step / STREAM_STEPS;
        const eased = 1 - Math.pow(1 - progress, 2);
        const target = declared + (measured - declared) * eased;
        const noise = (Math.random() - 0.5) * 0.25;
        const value = target + noise;
        setSeries((prev) => {
          const nextT = (prev[prev.length - 1]?.t ?? 0) + 1;
          return [...prev.slice(-SERIES_WINDOW), { t: nextT, kg: value }];
        });
        if (step >= STREAM_STEPS) {
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          // Final settle to measured
          setSeries((prev) => {
            const nextT = (prev[prev.length - 1]?.t ?? 0) + 1;
            return [...prev.slice(-SERIES_WINDOW), { t: nextT, kg: measured }];
          });
          if (mountedRef.current) setStreaming(false);
          streamResolverRef.current = null;
          resolve(false);
        }
      }, STREAM_TICK_MS);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Re-entrancy guard — Enter spam during streaming or pending mutation should not stack runs.
    if (streaming || submitMutation.isPending) return;

    const declared = parseFloat(form.declaredWeightKg);
    const measured = parseFloat(form.measuredWeightKg);
    const threshold = parseFloat(form.thresholdPct);

    // UI-layer validation (negative weight rejected here too, not just Zod)
    if (isNaN(declared) || declared <= 0) {
      toast.error("Declared weight must be a positive number.");
      return;
    }
    if (isNaN(measured) || measured < 0) {
      toast.error("Measured weight cannot be negative.");
      return;
    }
    if (isNaN(threshold) || threshold < 0) {
      toast.error("Threshold must be a non-negative number.");
      return;
    }

    const cancelled = await runStream(declared, measured);
    if (!mountedRef.current || cancelled) return;

    submitMutation.mutate({
      ...(form.draftId.trim() ? { draftId: form.draftId.trim() } : {}),
      declaredWeightKg: declared,
      measuredWeightKg: measured,
      thresholdPct: threshold,
    });
  };

  // keyboard: Escape cancels streaming
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && streaming) {
        if (streamTimerRef.current) clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        if (mountedRef.current) setStreaming(false);
        // Resolve the pending runStream() promise as cancelled so the awaiting
        // handleSubmit() unwinds instead of leaking.
        const resolver = streamResolverRef.current;
        streamResolverRef.current = null;
        if (resolver) resolver(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [streaming]);

  const latestResult = submitMutation.data;
  const declaredFloat = parseFloat(form.declaredWeightKg);
  const measuredFloat = parseFloat(form.measuredWeightKg);
  const livePct =
    !isNaN(declaredFloat) && !isNaN(measuredFloat) && declaredFloat > 0
      ? ((measuredFloat - declaredFloat) / declaredFloat) * 100
      : 0;
  const needleAngle = Math.max(-90, Math.min(90, (livePct / 25) * 90));
  // Resolve threshold with a default — empty/NaN should fall back to the documented default.
  const parsedThreshold = parseFloat(form.thresholdPct);
  const effectiveThreshold = Number.isFinite(parsedThreshold) && parsedThreshold >= 0
    ? parsedThreshold
    : parseFloat(DEFAULT_THRESHOLD_PCT);

  // Defensive: when the series happens to be empty Math.min/...[] is Infinity;
  // fall back to the idle baseline so the YAxis domain stays finite.
  const chartMin =
    series.length > 0 ? Math.min(...series.map((p) => p.kg)) - 1 : IDLE_BASELINE_KG - 1;
  const chartMax =
    series.length > 0 ? Math.max(...series.map((p) => p.kg)) + 1 : IDLE_BASELINE_KG + 1;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Load Sensor Weight Check" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Sensor Stream chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity
                    className={`w-4 h-4 ${streaming ? "text-blue-600" : "text-slate-500"}`}
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-semibold text-slate-800">Load Sensor Stream</h2>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    streaming
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                  aria-live="polite"
                >
                  {streaming ? "STREAMING" : "STABLE"}
                </span>
              </div>
              <div className="h-44 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 6, right: 12, left: 12, bottom: 4 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis
                      domain={[chartMin, chartMax]}
                      width={42}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={(v) => `${(v as number).toFixed(1)}`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [`${v.toFixed(2)} kg`, "reading"]}
                      labelFormatter={() => ""}
                    />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>ch: load-cell-1</span>
                <span>{series.length} samples</span>
              </div>
            </div>

            {/* Form */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
              aria-labelledby="submit-heading"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="submit-heading" className="text-xl font-bold text-slate-800">
                    Submit Weight Check
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Enter the declared and sensor-measured weights to detect deviations.
                  </p>
                </div>
                <DraftPicker
                  value={form.draftId}
                  onSelect={(id) => setForm((prev) => ({ ...prev, draftId: id }))}
                />
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 mt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-600" htmlFor="declaredWeightKg">
                      Declared Weight (kg) <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="declaredWeightKg"
                      name="declaredWeightKg"
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      aria-required="true"
                      placeholder="e.g. 100.00"
                      value={form.declaredWeightKg}
                      onChange={handleChange}
                      className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-600" htmlFor="measuredWeightKg">
                      Measured Weight (kg) <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="measuredWeightKg"
                      name="measuredWeightKg"
                      type="number"
                      min="0"
                      step="0.001"
                      required
                      aria-required="true"
                      placeholder="e.g. 103.50"
                      value={form.measuredWeightKg}
                      onChange={handleChange}
                      className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-600" htmlFor="thresholdPct">
                      Deviation Threshold (%)
                    </label>
                    <input
                      id="thresholdPct"
                      name="thresholdPct"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={`Default: ${DEFAULT_THRESHOLD_PCT}`}
                      value={form.thresholdPct}
                      onChange={handleChange}
                      className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-600" htmlFor="draftId">
                      Draft ID{" "}
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="draftId"
                      name="draftId"
                      type="text"
                      placeholder="Link to an existing draft"
                      value={form.draftId}
                      onChange={handleChange}
                      className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end items-center gap-3 pt-2">
                  {streaming && (
                    <button
                      type="button"
                      onClick={() => {
                        if (streamTimerRef.current) clearInterval(streamTimerRef.current);
                        streamTimerRef.current = null;
                        setStreaming(false);
                        // Resolve the pending runStream() promise as cancelled.
                        const resolver = streamResolverRef.current;
                        streamResolverRef.current = null;
                        if (resolver) resolver(true);
                      }}
                      aria-label="Cancel streaming"
                      className="px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      Cancel
                    </button>
                  )}
                  <motion.button
                    type="submit"
                    whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                    disabled={submitMutation.isPending || streaming}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm shadow-blue-200 transition-colors duration-150 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {streaming ? (
                      <>
                        <Activity className="w-4 h-4 animate-pulse" aria-hidden="true" />
                        Streaming…
                      </>
                    ) : submitMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Scale className="w-4 h-4" aria-hidden="true" />
                        Stream & Verify
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Scale needle / Result banner */}
            <AnimatePresence>
              {latestResult && (
                <motion.div
                  key="r"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className={`rounded-2xl border-2 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-sm ${
                    latestResult.flagged
                      ? "bg-red-50 border-red-300"
                      : "bg-emerald-50 border-emerald-300"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <ScaleNeedle pct={latestResult.deviationPct} flagged={latestResult.flagged} />
                  <div className="flex-1">
                    <p className={`text-lg font-bold ${latestResult.flagged ? "text-red-700" : "text-emerald-700"}`}>
                      {latestResult.flagged ? "Weight Deviation Flagged" : "Weight Within Tolerance"}
                    </p>
                    <p className="text-sm text-slate-700 mt-1">
                      Declared:{" "}
                      <strong>{latestResult.declaredWeightKg.toFixed(3)} kg</strong>
                      {" · "}
                      Measured:{" "}
                      <strong>{latestResult.measuredWeightKg.toFixed(3)} kg</strong>
                      {" · "}
                      Deviation:{" "}
                      <strong>
                        {latestResult.deviationKg >= 0 ? "+" : ""}
                        {latestResult.deviationKg.toFixed(3)} kg
                      </strong>{" "}
                      ({fmtPct(latestResult.deviationPct)} vs threshold{" "}
                      {latestResult.thresholdPct}%)
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live deviation preview */}
            {!latestResult && !isNaN(declaredFloat) && !isNaN(measuredFloat) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-6 shadow-sm">
                <ScaleNeedle
                  pct={livePct}
                  angle={needleAngle}
                  flagged={Math.abs(livePct) > effectiveThreshold}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">Predicted deviation</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    <CountUp value={livePct} decimals={2} suffix="%" />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Threshold: {effectiveThreshold.toFixed(1)}% — Click
                    "Stream &amp; Verify" to record the reading.
                  </p>
                </div>
              </div>
            )}

            {/* History */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
              aria-labelledby="history-heading"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 id="history-heading" className="text-xl font-bold text-slate-800">
                    Check History
                  </h2>
                  <p className="text-sm text-slate-500">Last {HISTORY_LIMIT} weight checks for your account.</p>
                </div>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch().catch(() => void 0)}
                  aria-label="Refresh check history"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                >
                  <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Refresh
                </button>
              </div>

              {historyQuery.isLoading ? (
                <div className="space-y-3">
                  <CardSkeleton height={56} />
                  <CardSkeleton height={56} />
                  <CardSkeleton height={56} />
                </div>
              ) : historyQuery.isError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                  <p className="text-sm text-red-700 font-medium">
                    Failed to load history: {historyQuery.error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => historyQuery.refetch().catch(() => void 0)}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                  >
                    Retry
                  </button>
                </div>
              ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-500">No weight checks yet</p>
                  <p className="text-xs mt-1">Submit your first check above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                        <th className="text-left py-2 pr-4">Date</th>
                        <th className="text-right py-2 pr-4">Declared (kg)</th>
                        <th className="text-right py-2 pr-4">Measured (kg)</th>
                        <th className="text-right py-2 pr-4">Deviation (kg)</th>
                        <th className="text-right py-2 pr-4">Dev %</th>
                        <th className="text-right py-2 pr-4">Threshold %</th>
                        <th className="text-center py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyQuery.data.map((record) => (
                        <tr
                          key={String(record._id)}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                            {fmtDate(record.createdAt as Date)}
                          </td>
                          <td className="py-3 pr-4 text-right font-medium">
                            {record.declaredWeightKg.toFixed(3)}
                          </td>
                          <td className="py-3 pr-4 text-right font-medium">
                            {record.measuredWeightKg.toFixed(3)}
                          </td>
                          <td
                            className={`py-3 pr-4 text-right font-medium ${
                              record.deviationKg > 0
                                ? "text-amber-600"
                                : record.deviationKg < 0
                                  ? "text-blue-600"
                                  : "text-slate-600"
                            }`}
                          >
                            {record.deviationKg >= 0 ? "+" : ""}
                            {record.deviationKg.toFixed(3)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {fmtPct(record.deviationPct)}
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-400">
                            {record.thresholdPct}%
                          </td>
                          <td className="py-3 text-center">
                            {record.flagged ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail draftId={form.draftId.trim() || undefined} title="Verification Activity" />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── ScaleNeedle ──────────────────────────────────────────────────────────────

function ScaleNeedle({
  pct,
  angle,
  flagged,
}: {
  pct: number;
  angle?: number;
  flagged: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const a = angle ?? Math.max(-90, Math.min(90, (pct / 25) * 90));
  const color = flagged ? "#ef4444" : "#10b981";
  return (
    <div
      className="relative w-36 h-24 flex-shrink-0"
      aria-label={`Deviation: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
    >
      <svg viewBox="0 0 200 120" className="w-full h-full" aria-hidden="true">
        {/* Arc */}
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Tick marks */}
        {[-90, -45, 0, 45, 90].map((tick) => {
          const rad = ((tick - 90) * Math.PI) / 180;
          const x1 = 100 + Math.cos(rad) * 70;
          const y1 = 110 + Math.sin(rad) * 70;
          const x2 = 100 + Math.cos(rad) * 82;
          const y2 = 110 + Math.sin(rad) * 82;
          return (
            <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" />
          );
        })}
        {/* Needle */}
        <motion.line
          x1={100}
          y1={110}
          x2={100}
          y2={30}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          initial={false}
          animate={{ rotate: a }}
          style={{ originX: "100px", originY: "110px" }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 110, damping: 14 }
          }
        />
        <circle cx="100" cy="110" r="6" fill={color} />
      </svg>
      <p
        className="absolute inset-0 flex items-end justify-center text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {pct >= 0 ? "+" : ""}
        {pct.toFixed(1)}%
      </p>
    </div>
  );
}
