import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { ShieldCheck, Upload, FileText, Camera, AlertTriangle, RefreshCcw } from "lucide-react";
import Header from "../../components/Header";
import DraftPicker from "../../components/DraftPicker";
import { trpc } from "../../lib/trpc";

type ComplianceMethod = "form" | "csv" | "image";

export default function Compliance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftId, setDraftId] = useState<string>(searchParams.get("draftId") ?? "");
  const [activeTab, setActiveTab] = useState<ComplianceMethod>("form");

  // Form Fields (simplified)
  const [originCountry, setOriginCountry] = useState("US");
  const [destinationCountry, setDestinationCountry] = useState("CA");
  const [hsCode, setHsCode] = useState("");
  const [isPerishable, setIsPerishable] = useState(false);

  // File states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [analyzingImage, setAnalyzingImage] = useState(false);

  // URL Query Sync
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params);
  }, [draftId, setSearchParams]);

  const utils = trpc.useUtils();

  // Queries
  const draftQuery = trpc.inventory.getDraftById.useQuery(
    { id: draftId },
    {
      enabled: Boolean(draftId),
      retry: false,
    }
  );

  // Pre-fill form when draft changes
  useEffect(() => {
    if (draftQuery.data) {
      setOriginCountry(draftQuery.data.originCountry || "US");
      setDestinationCountry(draftQuery.data.destinationCountry || "CA");
      setHsCode(draftQuery.data.hsCode || "");
      setIsPerishable(draftQuery.data.isPerishable || false);
    }
  }, [draftQuery.data]);

  // Mutations
  const checkMutation = trpc.compliance.check.useMutation({
    onSuccess: (data) => {
      if (data.status === "approved") {
        toast.success("Compliance approved!");
      } else {
        toast.warning(`Compliance restricted: ${data.flaggedReason || "Flagged in review"}`);
      }
      if (draftId) {
        utils.inventory.getDraftById.invalidate({ id: draftId }).catch(() => null);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Compliance check failed.");
    },
  });

  const uploadCsvMutation = trpc.compliance.createDraftFromCsv.useMutation({
    onSuccess: (data: any) => {
      toast.success("CSV draft created.");
      if (data.draft?._id) {
        setDraftId(String(data.draft._id));
        setActiveTab("form");
      }
    },
    onError: (err) => {
      toast.error(err.message || "CSV upload failed.");
    },
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftId) {
      toast.error("Please select or upload a shipment draft.");
      return;
    }
    await checkMutation.mutateAsync({
      draftId,
      originCountry,
      destinationCountry,
      hsCode: hsCode.trim() || undefined,
    });
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    try {
      const text = await csvFile.text();
      await uploadCsvMutation.mutateAsync({ csvContent: text });
    } catch (err) {
      toast.error("Failed to read CSV file.");
    }
  };

  const handleImageAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
    setAnalyzingImage(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await axios.post("/api/analyze-product", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      if (data.hsCode) {
        setHsCode(data.hsCode);
        setIsPerishable(Boolean(data.isPerishable));
        toast.success(`AI Inferred HS Code: ${data.hsCode}`);
      }
    } catch (err) {
      toast.error("AI Analysis failed. Please manually fill the form.");
    } finally {
      setAnalyzingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Regulatory Compliance" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        
        {/* context card */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Compliance Context</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Choose an active draft shipment to verify compliance or submit details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Active Draft:</span>
            <DraftPicker value={draftId} onSelect={setDraftId} />
          </div>
        </div>

        {/* tab selector */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("form")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "form"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Compliance Form
          </button>
          <button
            onClick={() => setActiveTab("csv")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "csv"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <FileText className="w-4 h-4" /> CSV Intake
          </button>
          <button
            onClick={() => setActiveTab("image")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "image"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <Camera className="w-4 h-4" /> Image Inference
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            
            {activeTab === "form" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800">Verify Shipment Details</h3>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Origin Country</label>
                      <input
                        type="text"
                        value={originCountry}
                        onChange={(e) => setOriginCountry(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Destination Country</label>
                      <input
                        type="text"
                        value={destinationCountry}
                        onChange={(e) => setDestinationCountry(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">HS Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 8517.12"
                      value={hsCode}
                      onChange={(e) => setHsCode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isPerishable"
                      checked={isPerishable}
                      onChange={(e) => setIsPerishable(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isPerishable" className="text-xs font-semibold text-slate-600">Perishable Cargo</label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={checkMutation.isPending}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                    >
                      {checkMutation.isPending ? "Submitting Check..." : "Run Compliance Check"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "csv" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800">CSV Bulk Upload</h3>
                <form onSubmit={handleCsvSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50">
                    <Upload className="w-8 h-8" />
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-500"
                    />
                  </div>
                  {csvFile && (
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={uploadCsvMutation.isPending}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl transition-all"
                      >
                        {uploadCsvMutation.isPending ? "Processing..." : "Submit CSV"}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {activeTab === "image" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 font-sans">Product Image Analysis</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50 min-h-48 cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageAnalysis}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Camera className="w-8 h-8" />
                    <span className="text-xs text-center">Click or Drag Product Image</span>
                  </div>
                  <div className="flex items-center justify-center border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="max-h-40 object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">No Image Uploaded</span>
                    )}
                  </div>
                </div>
                {analyzingImage && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 animate-pulse">
                    AI is scanning product characteristics &amp; retrieving HS code...
                  </div>
                )}
              </div>
            )}

          </div>

          <aside className="lg:col-span-4">
            <InsightsRail draftId={draftId || undefined} title="Regulatory Logs" />
          </aside>
        </div>
      </main>
    </div>
  );
}
