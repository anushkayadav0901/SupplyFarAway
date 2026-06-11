import { useState, useRef } from "react";
import { toast } from "react-toastify";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

interface VerifyResult {
  _id: string;
  declaredCount: number;
  detectedCount: number;
  mismatch: boolean;
  mismatchPct: number;
  confidence: number;
  notes: string;
  draftId?: string;
  createdAt: string | Date;
}

export default function BoxCount() {
  const [declaredCount, setDeclaredCount] = useState<string>("");
  const [draftId, setDraftId] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifyMutation = trpc.boxCount.verify.useMutation({
    onSuccess: (data) => {
      setVerifyResult(data as unknown as VerifyResult);
      toast.success("Box count verification complete!");
      historyQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Verification failed. Please try again.");
    },
  });

  const historyQuery = trpc.boxCount.history.useQuery({ limit: 20 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      // Strip "data:<mime>;base64," prefix
      const base64 = dataUrl.split(",")[1] ?? "";
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const count = parseInt(declaredCount, 10);
    if (!count || count <= 0) {
      toast.error("Please enter a valid declared count (positive integer).");
      return;
    }
    if (!imageBase64) {
      toast.error("Please select a shipment image to upload.");
      return;
    }

    verifyMutation.mutate({
      declaredCount: count,
      imageBase64,
      mimeType,
      draftId: draftId.trim() || undefined,
    });
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Box Count Verification" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* Upload & Verify Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">
              Verify Shipment Box Count
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Upload a photo of the shipment. AI will count the visible boxes and
              compare against your declared manifest count.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {/* Declared Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="declaredCount"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Declared Box Count
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  id="declaredCount"
                  type="number"
                  min={1}
                  step={1}
                  value={declaredCount}
                  onChange={(e) => setDeclaredCount(e.target.value)}
                  placeholder="e.g. 24"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-800 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="draftId"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Draft ID{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="draftId"
                  type="text"
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  placeholder="Link to a draft (optional)"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-800 transition-colors"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Shipment Photo
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  imagePreview
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
                } min-h-[180px]`}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 max-w-full rounded-lg object-contain p-2"
                  />
                ) : (
                  <div className="text-center px-4 py-8">
                    <svg
                      className="mx-auto mb-3 w-10 h-10 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-slate-600 font-medium">
                      Click to upload shipment photo
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      JPG, PNG, WEBP supported
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview("");
                    setImageBase64("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-2 text-sm text-red-500 hover:text-red-600 font-medium"
                >
                  Remove image
                </button>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={verifyMutation.isPending}
                className="relative px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 active:scale-[0.98] min-w-[180px] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <span className="flex items-center justify-center gap-3">
                  {verifyMutation.isPending ? (
                    <>
                      Analyzing...
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </>
                  ) : (
                    "Verify Count"
                  )}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Result Card */}
        {verifyResult && (
          <div
            className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
              verifyResult.mismatch
                ? "border-red-200"
                : "border-emerald-200"
            }`}
          >
            <div
              className={`px-6 py-4 flex items-center gap-3 ${
                verifyResult.mismatch
                  ? "bg-red-50 border-b border-red-100"
                  : "bg-emerald-50 border-b border-emerald-100"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  verifyResult.mismatch
                    ? "bg-red-100 text-red-600"
                    : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {verifyResult.mismatch ? "!" : "✓"}
              </div>
              <div>
                <h3
                  className={`font-bold text-base ${
                    verifyResult.mismatch ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {verifyResult.mismatch ? "Count Mismatch Detected" : "Count Verified — No Mismatch"}
                </h3>
                <p className="text-sm text-slate-500">
                  Completed just now
                </p>
              </div>
            </div>

            <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Declared
                </p>
                <p className="text-3xl font-bold text-slate-800">
                  {verifyResult.declaredCount}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Detected
                </p>
                <p
                  className={`text-3xl font-bold ${
                    verifyResult.mismatch ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {verifyResult.detectedCount}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Mismatch %
                </p>
                <p
                  className={`text-3xl font-bold ${
                    verifyResult.mismatch ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {verifyResult.mismatchPct.toFixed(1)}%
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Confidence
                </p>
                <p className="text-3xl font-bold text-blue-600">
                  {(verifyResult.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {verifyResult.notes && (
              <div className="px-6 pb-5">
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    AI Notes
                  </p>
                  <p className="text-sm text-slate-700">{verifyResult.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Verification History
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Last 20 verifications for your account
              </p>
            </div>
            {historyQuery.isRefetching && (
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : historyQuery.error ? (
              <div className="px-6 py-8 text-center">
                <p className="text-red-500 text-sm">
                  Failed to load history.{" "}
                  <button
                    onClick={() => historyQuery.refetch()}
                    className="underline hover:text-red-600"
                  >
                    Retry
                  </button>
                </p>
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="mx-auto mb-3 w-10 h-10 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-slate-500 font-medium">No verifications yet</p>
                <p className="text-slate-400 text-sm mt-1">
                  Upload a shipment photo above to get started.
                </p>
              </div>
            ) : (
              (historyQuery.data as unknown as VerifyResult[]).map((item) => (
                <div
                  key={item._id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                      item.mismatch
                        ? "bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {item.mismatch ? "!" : "✓"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-slate-800 text-sm">
                        Declared: {item.declaredCount}
                      </span>
                      <span
                        className={`font-semibold text-sm ${
                          item.mismatch ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        Detected: {item.detectedCount}
                      </span>
                      {item.mismatch && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
                          {item.mismatchPct.toFixed(1)}% off
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {(item.confidence * 100).toFixed(0)}% confidence
                      </span>
                      {item.draftId && (
                        <span className="text-xs text-slate-400">
                          Draft: {item.draftId}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-1 truncate max-w-md">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 flex-shrink-0">
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
