import { useState } from "react";
import { toast } from "react-toastify";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

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
  thresholdPct: "5",
};

export default function WeightCheck() {
  const [form, setForm] = useState<FormState>(initialForm);

  const utils = trpc.useUtils();

  const submitMutation = trpc.weightCheck.submit.useMutation({
    onSuccess: () => {
      toast.success("Weight check submitted successfully.");
      setForm(initialForm);
      utils.weightCheck.history.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit weight check.");
    },
  });

  const historyQuery = trpc.weightCheck.history.useQuery({ limit: 20 });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const declared = parseFloat(form.declaredWeightKg);
    const measured = parseFloat(form.measuredWeightKg);
    const threshold = parseFloat(form.thresholdPct);

    if (isNaN(declared) || declared <= 0) {
      toast.error("Declared weight must be a positive number.");
      return;
    }
    if (isNaN(measured) || measured < 0) {
      toast.error("Measured weight must be a non-negative number.");
      return;
    }
    if (isNaN(threshold) || threshold < 0) {
      toast.error("Threshold must be a non-negative number.");
      return;
    }

    submitMutation.mutate({
      ...(form.draftId.trim() ? { draftId: form.draftId.trim() } : {}),
      declaredWeightKg: declared,
      measuredWeightKg: measured,
      thresholdPct: threshold,
    });
  };

  const latestResult = submitMutation.data;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Load Sensor Weight Check" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* Input Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Submit Weight Check</h2>
          <p className="text-sm text-slate-500 mb-6">
            Enter the declared and sensor-measured weights to detect deviations.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Declared Weight */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-600" htmlFor="declaredWeightKg">
                  Declared Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  id="declaredWeightKg"
                  name="declaredWeightKg"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  placeholder="e.g. 100.00"
                  value={form.declaredWeightKg}
                  onChange={handleChange}
                  className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Measured Weight */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-600" htmlFor="measuredWeightKg">
                  Measured Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  id="measuredWeightKg"
                  name="measuredWeightKg"
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  placeholder="e.g. 103.50"
                  value={form.measuredWeightKg}
                  onChange={handleChange}
                  className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Threshold */}
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
                  placeholder="Default: 5"
                  value={form.thresholdPct}
                  onChange={handleChange}
                  className="px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Draft ID (optional) */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-600" htmlFor="draftId">
                  Draft ID <span className="text-slate-400 font-normal">(optional)</span>
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

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex items-center gap-2"
              >
                {submitMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Run Weight Check"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Latest Result Banner */}
        {latestResult && (
          <div
            className={`rounded-2xl border-2 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm ${
              latestResult.flagged
                ? "bg-red-50 border-red-300"
                : "bg-emerald-50 border-emerald-300"
            }`}
          >
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                latestResult.flagged ? "bg-red-100" : "bg-emerald-100"
              }`}
            >
              {latestResult.flagged ? "⚠" : "✓"}
            </div>
            <div className="flex-1">
              <p
                className={`text-lg font-bold ${
                  latestResult.flagged ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {latestResult.flagged
                  ? "Weight Deviation Flagged"
                  : "Weight Within Tolerance"}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                Declared: <strong>{latestResult.declaredWeightKg.toFixed(3)} kg</strong>
                {" · "}
                Measured: <strong>{latestResult.measuredWeightKg.toFixed(3)} kg</strong>
                {" · "}
                Deviation: <strong>{latestResult.deviationKg >= 0 ? "+" : ""}{latestResult.deviationKg.toFixed(3)} kg</strong>
                {" ("}
                {latestResult.deviationPct.toFixed(2)}%
                {" vs threshold "}
                {latestResult.thresholdPct}%
                {")"}
              </p>
            </div>
          </div>
        )}

        {/* History Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Check History</h2>
          <p className="text-sm text-slate-500 mb-6">Last 20 weight checks for your account.</p>

          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : historyQuery.isError ? (
            <div className="py-8 text-center text-red-500 font-medium">
              Failed to load history. {historyQuery.error.message}
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No weight checks yet. Submit your first check above.
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
                        {new Date(record.createdAt as Date).toLocaleDateString()}{" "}
                        <span className="text-xs text-slate-400">
                          {new Date(record.createdAt as Date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
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
                        {record.deviationPct.toFixed(2)}%
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
      </main>
    </div>
  );
}
