import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import Papa from "papaparse";
import { ShieldCheck, Upload, FileText, Camera, Send } from "lucide-react";
import PageLead from "../../components/PageLead";
import DraftPicker from "../../components/DraftPicker";
import InsightsRail from "../../components/InsightsRail";
import ComplianceResponse from "./ComplianceResponse";
import { trpc } from "../../lib/trpc";

// Fall back to local dev when VITE_BACKEND_URL is unset
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  "http://localhost:5000";

type ComplianceMode = "form" | "csv" | "image";

// Structured parsed CSV form data shape matching backend expectation
interface ParsedCsvFormData {
  ShipmentDetails: Record<string, string>;
  TradeAndRegulatoryDetails: Record<string, unknown>;
  PartiesAndIdentifiers: Record<string, string>;
  LogisticsAndHandling: Record<string, string>;
  DocumentVerification: Record<string, unknown>;
  IntendedUseDetails: Record<string, string>;
}

interface ImageAnalysisData {
  "HS Code": string;
  "Product Description": string;
  Perishable: boolean;
  Hazardous: boolean;
  "Required Export Document List": string[];
  Recommendations: { message: string; additionalTip: string };
}

interface ImageAnalysisResult {
  data?: ImageAnalysisData;
  draftId?: string;
  error?: string;
}

export default function Compliance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [draftId, setDraftId] = useState<string>(
    searchParams.get("draftId") ?? ""
  );
  const [activeMode, setActiveMode] = useState<ComplianceMode>("form");

  // --- Form tab state ---
  const [originCountry, setOriginCountry] = useState("US");
  const [destinationCountry, setDestinationCountry] = useState("CA");
  const [hsCode, setHsCode] = useState("");

  // --- CSV tab state ---
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsed, setCsvParsed] = useState<ParsedCsvFormData | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // --- Image tab state ---
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageResult, setImageResult] = useState<ImageAnalysisResult | null>(
    null
  );
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Results ---
  const [complianceResult, setComplianceResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Sync draftId to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params);
  }, [draftId, setSearchParams]);

  // Cleanup image preview URL on unmount/change
  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  const utils = trpc.useUtils();

  // Fetch draft and pre-fill form fields
  const draftQuery = trpc.inventory.getDraftById.useQuery(
    { id: draftId },
    { enabled: Boolean(draftId), retry: false }
  );

  useEffect(() => {
    if (draftQuery.data?.draft) {
      const shipment = (
        draftQuery.data.draft as unknown as {
          formData?: { ShipmentDetails?: Record<string, string> };
        }
      ).formData?.ShipmentDetails;
      if (shipment) {
        setOriginCountry(shipment["Origin Country"] || "US");
        setDestinationCountry(shipment["Destination Country"] || "CA");
        setHsCode(shipment["HS Code"] || "");
      }
    }
  }, [draftQuery.data]);

  // Compliance check mutation
  const checkMutation = trpc.compliance.check.useMutation({
    onSuccess: (data) => {
      const status = String(
        (data.complianceResponse as Record<string, unknown>)
          ?.complianceStatus ?? ""
      ).toLowerCase();
      setComplianceResult({
        complianceResponse: data.complianceResponse,
      });
      if (status === "ready for shipment") {
        toast.success("Compliance approved!");
      } else {
        toast.warning("Compliance check flagged — review the results below.");
      }
      if (draftId) {
        utils.inventory.getDraftById.invalidate({ id: draftId }).catch(() => null);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Compliance check failed.");
    },
  });

  // CSV draft mutation
  const csvDraftMutation = trpc.compliance.createDraftFromCsv.useMutation({
    onSuccess: (data) => {
      toast.success("CSV imported — draft created.");
      const newId = String(data.recordId ?? "");
      if (newId) {
        setDraftId(newId);
        setActiveMode("form");
      }
    },
    onError: (err) => {
      toast.error(err.message || "CSV import failed.");
    },
  });

  // --- Form tab handlers ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftId) {
      toast.error("Select a draft before running a check.");
      return;
    }
    checkMutation.mutate({
      draftId,
      ShipmentDetails: {
        "Origin Country": originCountry,
        "Destination Country": destinationCountry,
        "HS Code": hsCode,
      },
      TradeAndRegulatoryDetails: {},
      PartiesAndIdentifiers: {},
      LogisticsAndHandling: {},
      DocumentVerification: {},
      IntendedUseDetails: {},
    });
  };

  // --- CSV tab handlers ---
  const parseCsvFile = (file: File) => {
    setCsvError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: { data: Record<string, string>[] }) => {
        if (!result.data || result.data.length === 0) {
          setCsvError("CSV file is empty. Add at least one data row.");
          return;
        }
        if (result.data.length > 1) {
          toast.warning(`${result.data.length} rows found — using first row only.`);
        }
        const d = result.data[0];
        const parsed: ParsedCsvFormData = {
          ShipmentDetails: {
            "Origin Country": d["Origin Country"] || "",
            "Destination Country": d["Destination Country"] || "",
            "HS Code": d["HS Code"] || "",
            "Product Description": d["Product Description"] || "",
            Quantity: d["Quantity"] || "",
            "Gross Weight": d["Gross Weight"] || "",
          },
          TradeAndRegulatoryDetails: {
            "Incoterms 2020": d["Incoterms 2020"] || "",
            "Declared Value": {
              currency: d["Currency"] || "",
              amount: d["Declared Value"] || "",
            },
            "Currency of Transaction": d["Currency of Transaction"] || "",
            "Trade Agreement Claimed": d["Trade Agreement Claimed"] || "",
            "Dual-Use Goods": d["Dual-Use Goods"] || "No",
            "Hazardous Material": d["Hazardous Material"] || "No",
            Perishable: d["Perishable"] || "No",
          },
          PartiesAndIdentifiers: {
            "Shipper/Exporter": d["Shipper/Exporter"] || "",
            "Consignee/Importer": d["Consignee/Importer"] || "",
            "Manufacturer Information": d["Manufacturer Information"] || "",
            "EORI/Tax ID": d["EORI/Tax ID"] || "",
          },
          LogisticsAndHandling: {
            "Means of Transport": d["Means of Transport"] || "",
            "Port of Loading": d["Port of Loading"] || "",
            "Port of Discharge": d["Port of Discharge"] || "",
            "Special Handling": d["Special Handling"] || "",
            "Temperature Requirements": d["Temperature Requirements"] || "",
          },
          DocumentVerification: {
            "Commercial Invoice": {
              checked: d["Commercial Invoice"] === "true",
              subItems: {
                "Invoice number present":
                  d["Invoice number present"] === "true",
                "Details match shipment": d["Details match shipment"] === "true",
                "Customs compliant": d["Customs compliant"] === "true",
              },
            },
            "Packing List": {
              checked: d["Packing List"] === "true",
              subItems: {
                "Contents accurate": d["Contents accurate"] === "true",
                "Quantities match": d["Quantities match"] === "true",
                "Matches invoice": d["Matches invoice"] === "true",
              },
            },
            "Certificate of Origin": {
              checked: d["Certificate of Origin"] === "true",
              subItems: {
                "Origin verified": d["Origin verified"] === "true",
                "Trade agreement compliant":
                  d["Trade agreement compliant"] === "true",
              },
            },
            "Licenses/Permits": {
              checked: d["Licenses/Permits"] === "true",
              subItems: {
                "Valid number": d["Valid number"] === "true",
                "Not expired": d["Not expired"] === "true",
                "Authority verified": d["Authority verified"] === "true",
              },
            },
            "Bill of Lading": {
              checked: d["Bill of Lading"] === "true",
              subItems: {
                "Accurate details": d["Accurate details"] === "true",
                "Shipping regulations compliant":
                  d["Shipping regulations compliant"] === "true",
              },
            },
          },
          IntendedUseDetails: {
            "Intended Use": d["Intended Use"] || "",
          },
        };
        setCsvFile(file);
        setCsvParsed(parsed);
        toast.success(`"${file.name}" parsed successfully.`);
      },
      error: () => {
        setCsvError("Failed to parse CSV. Check format and try again.");
      },
    });
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseCsvFile(file);
  };

  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ok =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "" ||
      /\.csv$/i.test(file.name);
    if (ok) parseCsvFile(file);
    else toast.warning("Please drop a CSV file.");
  };

  const handleCsvSubmit = () => {
    if (!csvParsed) return;
    csvDraftMutation.mutate({
      formData: csvParsed as unknown as Record<string, unknown>,
    });
  };

  const handleCsvReset = () => {
    setCsvFile(null);
    setCsvParsed(null);
    setCsvError(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Origin Country",
      "Destination Country",
      "HS Code",
      "Product Description",
      "Quantity",
      "Gross Weight",
      "Incoterms 2020",
      "Currency",
      "Declared Value",
      "Currency of Transaction",
      "Trade Agreement Claimed",
      "Dual-Use Goods",
      "Hazardous Material",
      "Perishable",
      "Shipper/Exporter",
      "Consignee/Importer",
      "Manufacturer Information",
      "EORI/Tax ID",
      "Means of Transport",
      "Port of Loading",
      "Port of Discharge",
      "Special Handling",
      "Temperature Requirements",
      "Commercial Invoice",
      "Invoice number present",
      "Details match shipment",
      "Customs compliant",
      "Packing List",
      "Contents accurate",
      "Quantities match",
      "Matches invoice",
      "Certificate of Origin",
      "Origin verified",
      "Trade agreement compliant",
      "Licenses/Permits",
      "Valid number",
      "Not expired",
      "Authority verified",
      "Bill of Lading",
      "Accurate details",
      "Shipping regulations compliant",
      "Intended Use",
    ];
    const csvContent = Papa.unparse({ fields: headers, data: [{}] });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "shipment_template.csv";
    link.click();
    toast.info("Template downloaded.");
  };

  // --- Image tab handlers ---
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large. Max 10 MB.");
      return;
    }
    setSelectedImage(file);
    setImageResult(null);
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setImageResult(null);
    const formData = new FormData();
    formData.append("image", selectedImage);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No auth token found");
      const res = await axios.post(
        `${BACKEND_URL}/api/analyze-product`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setImageResult(res.data as ImageAnalysisResult);
    } catch (err: unknown) {
      let msg = "Image analysis failed.";
      if (axios.isAxiosError(err)) {
        msg =
          (err.response?.data as { error?: string } | undefined)?.error ||
          err.message ||
          msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setImageResult({ error: msg });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendImageToDraft = () => {
    if (!imageResult?.draftId) {
      toast.error("No draft available from this analysis.");
      return;
    }
    setDraftId(imageResult.draftId);
    setActiveMode("form");
    navigate(`/compliance?draftId=${imageResult.draftId}`);
  };

  // Tab config
  const TABS: { id: ComplianceMode; label: string; icon: React.ReactNode }[] =
    [
      {
        id: "form",
        label: "Compliance Form",
        icon: <ShieldCheck className="w-4 h-4" />,
      },
      {
        id: "csv",
        label: "CSV Intake",
        icon: <FileText className="w-4 h-4" />,
      },
      {
        id: "image",
        label: "Image Inference",
        icon: <Camera className="w-4 h-4" />,
      },
    ];

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        <PageLead
          title="Screen for export compliance"
          sub="Pick a draft — Gemini extracts the HS code, regulatory flags, and dual-use warnings. Or drop a CSV / product photo to skip the form."
          right={<DraftPicker value={draftId} onSelect={setDraftId} />}
        />

        {/* Mode tabs */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
                activeMode === tab.id
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">

            {/* ---- FORM TAB ---- */}
            {activeMode === "form" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Verify Shipment Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    3 fields required — AI infers compliance from the full draft
                    context.
                  </p>
                </div>

                {!draftId && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    No draft selected. Fill fields manually or pick a draft
                    above to auto-populate.
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Origin Country
                      </label>
                      <input
                        type="text"
                        value={originCountry}
                        onChange={(e) => setOriginCountry(e.target.value)}
                        placeholder="e.g. US"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Destination Country
                      </label>
                      <input
                        type="text"
                        value={destinationCountry}
                        onChange={(e) => setDestinationCountry(e.target.value)}
                        placeholder="e.g. CA"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      HS Code
                      <span className="ml-1 text-slate-400 font-normal">
                        (optional — AI will infer if blank)
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 8517.12"
                      value={hsCode}
                      onChange={(e) => setHsCode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {checkMutation.isPending && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 animate-pulse">
                      AI is running compliance check against WCO standards...
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={checkMutation.isPending}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                    >
                      {checkMutation.isPending
                        ? "Checking..."
                        : "Run Compliance Check"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ---- CSV TAB ---- */}
            {activeMode === "csv" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    CSV Bulk Import
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload a CSV to create a compliance draft instantly.
                  </p>
                </div>

                {!csvFile ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-colors duration-150 ${
                      isDragging
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleCsvDrop}
                  >
                    <Upload className="w-8 h-8 text-slate-400" />
                    <p className="text-sm text-slate-600 font-medium">
                      {isDragging ? "Drop your file here" : "Drag & drop CSV"}
                    </p>
                    <p className="text-xs text-slate-400">
                      or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      ref={csvInputRef}
                      onChange={handleCsvFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all"
                    >
                      Select CSV File
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {csvFile.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Parsed successfully — ready to import.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCsvReset}
                        className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium transition-all"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={handleCsvSubmit}
                        disabled={csvDraftMutation.isPending}
                        className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-all"
                      >
                        {csvDraftMutation.isPending
                          ? "Importing..."
                          : "Import Draft"}
                      </button>
                    </div>
                  </div>
                )}

                {csvError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {csvError}
                  </div>
                )}

                {csvDraftMutation.isPending && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 animate-pulse">
                    Creating draft from CSV...
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Need a template?
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Download with all required column headers pre-filled.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold transition-all"
                  >
                    Download Template
                  </button>
                </div>
              </div>
            )}

            {/* ---- IMAGE TAB ---- */}
            {activeMode === "image" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Product Image Inference
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload a product photo — AI extracts HS code, perishability,
                    and required docs.
                  </p>
                </div>

                {!selectedImage ? (
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-3 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleImageDrop}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Camera className="w-8 h-8 text-slate-400" />
                    <p className="text-sm text-slate-600 font-medium">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-slate-400">
                      JPG, PNG, WebP — max 10 MB
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      ref={imageInputRef}
                      onChange={handleImageInputChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 min-h-48">
                        {previewUrl && (
                          <img
                            src={previewUrl}
                            alt="Product preview"
                            className="max-h-48 object-contain p-2"
                          />
                        )}
                      </div>
                      <div className="flex flex-col justify-center gap-3">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {selectedImage.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(selectedImage.size / 1024).toFixed(1)} KB
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImage(null);
                              setImageResult(null);
                              if (imageInputRef.current)
                                imageInputRef.current.value = "";
                            }}
                            className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium transition-all"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAnalyzeImage()}
                            disabled={isAnalyzing}
                            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-all"
                          >
                            {isAnalyzing ? "Analyzing..." : "Analyze Product"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isAnalyzing && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 animate-pulse">
                        AI is scanning product characteristics and retrieving HS
                        code...
                      </div>
                    )}

                    {imageResult?.error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        {imageResult.error}
                      </div>
                    )}

                    {imageResult?.data && (
                      <div className="space-y-3">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">
                              HS Code
                            </span>
                            <span className="text-sm font-bold text-slate-800">
                              {imageResult.data["HS Code"]}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">
                              Description
                            </span>
                            <span className="text-xs text-slate-700 text-right max-w-[60%]">
                              {imageResult.data["Product Description"]}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">
                              Perishable
                            </span>
                            <span
                              className={`text-xs font-semibold ${imageResult.data.Perishable ? "text-orange-600" : "text-emerald-600"}`}
                            >
                              {imageResult.data.Perishable ? "Yes" : "No"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">
                              Hazardous
                            </span>
                            <span
                              className={`text-xs font-semibold ${imageResult.data.Hazardous ? "text-red-600" : "text-emerald-600"}`}
                            >
                              {imageResult.data.Hazardous ? "Yes" : "No"}
                            </span>
                          </div>
                        </div>

                        {imageResult.data["Required Export Document List"]
                          ?.length > 0 && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-xs font-semibold text-blue-800 mb-2">
                              Required Export Documents
                            </p>
                            <ul className="space-y-1">
                              {imageResult.data[
                                "Required Export Document List"
                              ].map((doc, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-slate-700 flex items-center gap-2"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {imageResult.draftId && (
                          <button
                            type="button"
                            onClick={handleSendImageToDraft}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                          >
                            <Send className="w-4 h-4" />
                            Send to Compliance Form
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ---- Results ---- */}
            {complianceResult && (
              <ComplianceResponse
                response={
                  complianceResult as {
                    complianceResponse?: Record<string, unknown>;
                    [key: string]: unknown;
                  }
                }
              />
            )}
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail
              draftId={draftId || undefined}
              title="Regulatory Logs"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
