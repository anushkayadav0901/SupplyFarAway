import { useState } from "react";
import { toast } from "react-toastify";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

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

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const RISK_BAR_COLOR: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

export default function AnomalyDetection() {
  const [form, setForm] = useState<FormState>({
    draftId: "",
    declaredWeightKg: "",
    measuredWeightKg: "",
    declaredCount: "",
    detectedCount: "",
    originCity: "",
    destinationCity: "",
    routeDeviationKm: "0",
    extraNotes: "",
  });

  const analyzeMutation = trpc.anomaly.analyze.useMutation({
    onError: (err) => {
      toast.error(err.message || "Analysis failed. Please try again.");
    },
  });

  const historyQuery = trpc.anomaly.history.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

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
      utils.anomaly.history.invalidate();

      setForm({
        draftId: "",
        declaredWeightKg: "",
        measuredWeightKg: "",
        declaredCount: "",
        detectedCount: "",
        originCity: "",
        destinationCity: "",
        routeDeviationKm: "0",
        extraNotes: "",
      });
    } catch {
      // error handled in onError
    }
  };

  const latestResult = analyzeMutation.data;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="AI Anomaly Detection" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* Input Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Shipment Inspection Data
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter declared vs. measured values to run a Gemini AI anomaly scan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {/* Route */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origin City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="originCity"
                  value={form.originCity}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Shanghai"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="destinationCity"
                  value={form.destinationCity}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Los Angeles"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Declared Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="declaredWeightKg"
                  value={form.declaredWeightKg}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Measured Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="measuredWeightKg"
                  value={form.measuredWeightKg}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Declared Item Count <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="declaredCount"
                  value={form.declaredCount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="1"
                  placeholder="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detected Item Count <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="detectedCount"
                  value={form.detectedCount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="1"
                  placeholder="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Route deviation & Draft ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Route Deviation (km)
                </label>
                <input
                  type="number"
                  name="routeDeviationKm"
                  value={form.routeDeviationKm}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  placeholder="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Draft ID (optional)
                </label>
                <input
                  type="text"
                  name="draftId"
                  value={form.draftId}
                  onChange={handleChange}
                  placeholder="Link to an existing draft"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Extra notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes (optional)
              </label>
              <textarea
                name="extraNotes"
                value={form.extraNotes}
                onChange={handleChange}
                rows={3}
                placeholder="Any other observations, unusual circumstances, or context..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={analyzeMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Run AI Analysis
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Latest Result */}
        {latestResult && (
          <div className={`rounded-2xl border p-6 ${SEVERITY_COLOR[latestResult.severity]}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wide ${SEVERITY_BADGE[latestResult.severity]}`}>
                  {latestResult.severity} risk
                </span>
                <span className="text-sm font-medium">
                  {latestResult.originCity} &rarr; {latestResult.destinationCity}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Risk Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${RISK_BAR_COLOR[latestResult.severity]}`}
                      style={{ width: `${latestResult.riskScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">{latestResult.riskScore}/100</span>
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-4">{latestResult.summary}</p>

            {(latestResult.flags as string[]).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2 opacity-70">
                  Detected Flags
                </p>
                <ul className="space-y-1.5">
                  {(latestResult.flags as string[]).map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Analysis History
            </h2>
            {historyQuery.isLoading && (
              <span className="text-xs text-gray-400">Loading...</span>
            )}
          </div>

          {historyQuery.isError && (
            <div className="px-6 py-4 text-sm text-red-600">
              Failed to load history: {historyQuery.error.message}
            </div>
          )}

          {!historyQuery.isLoading && !historyQuery.isError && (
            <>
              {(historyQuery.data ?? []).length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  No analyses yet. Run your first scan above.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(historyQuery.data ?? []).map((report) => {
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
                    return (
                      <div key={String(r._id)} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${SEVERITY_BADGE[r.severity] ?? "bg-gray-400"}`}>
                              {r.severity}
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              {r.originCity} &rarr; {r.destinationCity}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>Risk: <strong className="text-gray-700">{r.riskScore}/100</strong></span>
                            <span>
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{r.summary}</p>

                        {r.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {r.flags.slice(0, 4).map((flag, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md"
                              >
                                {flag}
                              </span>
                            ))}
                            {r.flags.length > 4 && (
                              <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-md">
                                +{r.flags.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
