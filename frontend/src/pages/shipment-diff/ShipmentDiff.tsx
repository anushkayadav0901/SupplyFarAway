import { useState, useRef } from "react";
import { toast } from "react-toastify";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix: "data:<mime>;base64,"
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function riskColor(score: number): string {
  if (score >= 70) return "text-red-600";
  if (score >= 40) return "text-amber-600";
  return "text-emerald-600";
}

function riskBadgeColor(score: number): string {
  if (score >= 70) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Medium Risk";
  return "Low Risk";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShipmentDiff() {
  const [draftId, setDraftId] = useState("");
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string>("");
  const [afterPreview, setAfterPreview] = useState<string>("");

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const compareMutation = trpc.shipmentDiff.compare.useMutation({
    onError: (err) => {
      toast.error(err.message ?? "Comparison failed. Please try again.");
    },
  });

  const historyQuery = trpc.shipmentDiff.history.useQuery({ limit: 20 });

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: "before" | "after"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (slot === "before") {
      setBeforeFile(file);
      setBeforePreview(previewUrl);
    } else {
      setAfterFile(file);
      setAfterPreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeFile || !afterFile) {
      toast.error("Please select both a before and after image.");
      return;
    }

    try {
      const [beforeBase64, afterBase64] = await Promise.all([
        readFileAsBase64(beforeFile),
        readFileAsBase64(afterFile),
      ]);

      await compareMutation.mutateAsync({
        draftId: draftId.trim() || undefined,
        beforeImageBase64: beforeBase64,
        afterImageBase64: afterBase64,
        mimeType: beforeFile.type || "image/jpeg",
      });

      historyQuery.refetch();
      toast.success("Comparison complete!");
    } catch {
      // handled by onError above
    }
  };

  const result = compareMutation.data;
  const isLoading = compareMutation.isPending;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Damage & Tampering Diff" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* Upload Form */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Compare Shipment Photos</h2>
          <p className="text-sm text-gray-500 mb-6">
            Upload a photo taken before loading and one taken upon delivery. AI will estimate
            damage, missing items, and tampering probability.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Draft ID (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Draft ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="Link to an existing draft"
                className="w-full sm:w-80 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Image uploads side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Before image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Before Loading
                </label>
                <div
                  onClick={() => beforeInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl overflow-hidden transition-colors"
                  style={{ minHeight: 180 }}
                >
                  {beforePreview ? (
                    <img
                      src={beforePreview}
                      alt="Before loading preview"
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 px-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16v1a2 2 0 002 2h14a2 2 0 002-2v-1M16 10l-4-4m0 0l-4 4m4-4v12" />
                      </svg>
                      <span className="text-sm text-center">Click to upload before-loading photo</span>
                    </div>
                  )}
                </div>
                <input
                  ref={beforeInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "before")}
                />
                {beforeFile && (
                  <p className="mt-1 text-xs text-gray-500 truncate">{beforeFile.name}</p>
                )}
              </div>

              {/* After image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  After Delivery
                </label>
                <div
                  onClick={() => afterInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl overflow-hidden transition-colors"
                  style={{ minHeight: 180 }}
                >
                  {afterPreview ? (
                    <img
                      src={afterPreview}
                      alt="After delivery preview"
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 px-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16v1a2 2 0 002 2h14a2 2 0 002-2v-1M16 10l-4-4m0 0l-4 4m4-4v12" />
                      </svg>
                      <span className="text-sm text-center">Click to upload after-delivery photo</span>
                    </div>
                  )}
                </div>
                <input
                  ref={afterInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "after")}
                />
                {afterFile && (
                  <p className="mt-1 text-xs text-gray-500 truncate">{afterFile.name}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !beforeFile || !afterFile}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Run Diff Analysis"
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Latest Result */}
        {result && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Analysis Result</h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${riskBadgeColor(result.riskScore)}`}>
                {riskLabel(result.riskScore)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Risk Score</p>
                <p className={`text-4xl font-bold ${riskColor(result.riskScore)}`}>{result.riskScore}</p>
                <p className="text-xs text-gray-400 mt-1">out of 100</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Tampering Probability</p>
                <p className={`text-4xl font-bold ${riskColor(result.tamperingProbability * 100)}`}>
                  {Math.round(result.tamperingProbability * 100)}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Missing Items</p>
                <p className="text-4xl font-bold text-gray-800">{result.missingItems.length}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Summary</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{result.summary}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Damage Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{result.damageDescription}</p>
              </div>

              {result.missingItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Missing Items</h3>
                  <ul className="space-y-1">
                    {result.missingItems.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* History */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Comparisons</h2>

          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : historyQuery.error ? (
            <p className="text-sm text-red-500">Failed to load history.</p>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <p className="text-sm text-gray-500">No comparisons yet. Upload two images to get started.</p>
          ) : (
            <div className="space-y-3">
              {historyQuery.data.map((record) => {
                const id = (record._id as unknown as { toString(): string }).toString();
                return (
                  <div
                    key={id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">{record.summary}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(record.createdAt as Date).toLocaleString()}
                        {record.draftId ? ` · Draft: ${record.draftId}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskBadgeColor(record.riskScore)}`}>
                        {riskLabel(record.riskScore)} ({record.riskScore})
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round(record.tamperingProbability * 100)}% tamper
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
