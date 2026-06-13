import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import { ShieldCheck, Upload, FileText } from "lucide-react";
import PageLead from "../../components/PageLead";
import InsightsRail from "../../components/InsightsRail";
import NewsContextCard from "../../components/NewsContextCard";
import ComplianceResponse from "./ComplianceResponse";
import AIThinking from "../../components/AIThinking";
import ReferenceNewsButton from "../../components/ReferenceNewsButton";
import { trpc } from "../../lib/trpc";

type ComplianceMode = "form" | "csv";

// Structured parsed CSV form data shape matching backend expectation
interface ParsedCsvFormData {
  ShipmentDetails: Record<string, string>;
  TradeAndRegulatoryDetails: Record<string, unknown>;
  PartiesAndIdentifiers: Record<string, string>;
  LogisticsAndHandling: Record<string, string>;
  DocumentVerification: Record<string, unknown>;
  IntendedUseDetails: Record<string, string>;
}

export default function Compliance() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  // --- Results ---
  const [complianceResult, setComplianceResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [submitError, setSubmitError] = useState<string>("");

  // Sync draftId to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (draftId) params.draftId = draftId;
    setSearchParams(params);
  }, [draftId, setSearchParams]);

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
      setSubmitError("");
      setComplianceResult({
        complianceResponse: data.complianceResponse,
      });
      // After a draftless submission the backend creates a new draft and
      // returns its id as recordId — sync it so the UI can link to it.
      const returnedId = data.recordId ? String(data.recordId) : "";
      if (!draftId && returnedId) {
        setDraftId(returnedId);
      }
      const idToInvalidate = draftId || returnedId;
      if (idToInvalidate) {
        utils.inventory.getDraftById
          .invalidate({ id: idToInvalidate })
          .catch(() => null);
      }
    },
    onError: (err) => {
      setSubmitError(err.message || "Compliance check failed.");
    },
  });

  // CSV draft mutation
  const csvDraftMutation = trpc.compliance.createDraftFromCsv.useMutation({
    onSuccess: (data) => {
      setCsvError(null);
      const newId = String(data.recordId ?? "");
      if (newId) {
        setDraftId(newId);
        setActiveMode("form");
      }
    },
    onError: (err) => {
      setCsvError(err.message || "CSV import failed.");
    },
  });

  // --- Form tab handlers ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // draftId is optional on the backend — if none is selected, the backend
    // creates an ephemeral draft so a judge can type fields and get results
    // without picking from inventory first.
    checkMutation.mutate({
      ...(draftId ? { draftId } : {}),
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
          setCsvError(`Note: ${result.data.length} rows found — using the first row only.`);
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
    else setCsvError("Please drop a CSV file.");
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
    ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">

      <PageLead
        title="Screen for export compliance"
        sub="Gemini extracts the HS code, regulatory flags, and dual-use warnings. Fill the form or drop a CSV to get started."
      />

      {/* Mode tabs */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveMode(tab.id)}
            className={`flex items-center gap-2 px-1 py-3 border-b-2 font-semibold text-sm transition-colors whitespace-nowrap ${
              activeMode === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">

          {/* ---- FORM TAB ---- */}
          {activeMode === "form" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Verify Shipment Details
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  3 fields required — AI infers compliance from the full draft context.
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Origin Country
                    </label>
                    <input
                      type="text"
                      value={originCountry}
                      onChange={(e) => setOriginCountry(e.target.value)}
                      placeholder="e.g. US"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Destination Country
                    </label>
                    <input
                      type="text"
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                      placeholder="e.g. CA"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    HS Code{" "}
                    <span className="text-slate-400 font-normal">
                      (optional — AI will infer if blank)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8517.12"
                    value={hsCode}
                    onChange={(e) => setHsCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {checkMutation.isPending && (
                  <AIThinking
                    steps={[
                      "Reading shipment context…",
                      "Cross-checking trade regulations…",
                      "Computing compliance score & documents…",
                    ]}
                  />
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={checkMutation.isPending}
                    className="px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
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
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  CSV Bulk Import
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a CSV to create a compliance draft instantly.
                </p>
              </div>

              {!csvFile ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 ${
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
                  <p className="text-sm font-medium text-slate-600">
                    {isDragging ? "Drop your file here" : "Drag & drop CSV"}
                  </p>
                  <p className="text-sm text-slate-400">or click to browse</p>
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
                    className="px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg"
                  >
                    Select CSV File
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {csvFile.name}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Parsed successfully — ready to import.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCsvReset}
                      className="px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-900 text-sm font-semibold rounded-lg"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={handleCsvSubmit}
                      disabled={csvDraftMutation.isPending}
                      className="px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
                    >
                      {csvDraftMutation.isPending ? "Importing..." : "Import Draft"}
                    </button>
                  </div>
                </div>
              )}

              {csvError && (
                <p className="text-sm text-red-600">{csvError}</p>
              )}

              {csvDraftMutation.isPending && (
                <p className="text-sm text-blue-700">Creating draft from CSV...</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Need a template?
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Download with all required column headers pre-filled.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-900 text-sm font-semibold rounded-lg"
                >
                  Download Template
                </button>
              </div>
            </div>
          )}


          {submitError && (
            <p className="text-sm text-red-600" role="alert">{submitError}</p>
          )}

          {/* ---- Results ---- */}
          {complianceResult && (
            <div className="space-y-6">
              <NewsContextCard
                surface="compliance"
                origin={originCountry}
                destination={destinationCountry}
                hsCode={hsCode}
              />
              <ComplianceResponse
                response={
                  complianceResult as {
                    complianceResponse?: Record<string, unknown>;
                    [key: string]: unknown;
                  }
                }
              />
              <ReferenceNewsButton
                subject={hsCode || `${originCountry} ${destinationCountry}`}
                kind="compliance"
              />
            </div>
          )}
        </div>

        <aside className="lg:col-span-4">
          <InsightsRail
            draftId={draftId || undefined}
            title="Regulatory Logs"
          />
        </aside>
      </div>
    </div>
  );
}
