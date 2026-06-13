import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import Toast from "./../../components/Toast";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

interface ToastProps {
  type: string;
  message: string;
}

interface ParsedFormData {
  ShipmentDetails: {
    "Origin Country": string;
    "Destination Country": string;
    "HS Code": string;
    "Product Description": string;
    Quantity: string;
    "Gross Weight": string;
  };
  TradeAndRegulatoryDetails: {
    "Incoterms 2020": string;
    "Declared Value": {
      currency: string;
      amount: string;
    };
    "Currency of Transaction": string;
    "Trade Agreement Claimed": string;
    "Dual-Use Goods": string;
    "Hazardous Material": string;
    Perishable: string;
  };
  PartiesAndIdentifiers: {
    "Shipper/Exporter": string;
    "Consignee/Importer": string;
    "Manufacturer Information": string;
    "EORI/Tax ID": string;
  };
  LogisticsAndHandling: {
    "Means of Transport": string;
    "Port of Loading": string;
    "Port of Discharge": string;
    "Special Handling": string;
    "Temperature Requirements": string;
  };
  DocumentVerification: {
    "Commercial Invoice": {
      checked: boolean;
      subItems: {
        "Invoice number present": boolean;
        "Details match shipment": boolean;
        "Customs compliant": boolean;
      };
    };
    "Packing List": {
      checked: boolean;
      subItems: {
        "Contents accurate": boolean;
        "Quantities match": boolean;
        "Matches invoice": boolean;
      };
    };
    "Certificate of Origin": {
      checked: boolean;
      subItems: {
        "Origin verified": boolean;
        "Trade agreement compliant": boolean;
      };
    };
    "Licenses/Permits": {
      checked: boolean;
      subItems: {
        "Valid number": boolean;
        "Not expired": boolean;
        "Authority verified": boolean;
      };
    };
    "Bill of Lading": {
      checked: boolean;
      subItems: {
        "Accurate details": boolean;
        "Shipping regulations compliant": boolean;
      };
    };
  };
  IntendedUseDetails: {
    "Intended Use": string;
  };
}

const CsvUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<ParsedFormData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [send, setSend] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });

  // tRPC mutation to create a draft from CSV data
  const createDraftFromCsvMutation = trpc.compliance.createDraftFromCsv.useMutation({
    onSuccess: (data) => {
      const draftId = data.recordId;
      if (!draftId) {
        setCsvError("Draft ID not returned from server");
        setToastProps({
          type: "error",
          message: "Failed to process compliance check.",
        });
        setLoading(false);
        return;
      }
      navigate(`/compliance?draftId=${String(draftId)}`);
    },
    onError: (error) => {
      setCsvError(
        error.message || "Error processing compliance check. Please try again."
      );
      setToastProps({
        type: "error",
        message: error.message || "Failed to process compliance check.",
      });
      console.error(error);
      setLoading(false);
    },
  });

  const handleCsvUpload = (file: File): void => {
    if (!file) return;

    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: { data: Record<string, string>[] }) => {
        try {
          if (!result.data || result.data.length === 0) {
            setCsvError(
              `"${file.name}" does not contain any data rows. Please add at least one row of shipment data below the headers and try again.`,
            );
            setToastProps({
              type: "error",
              message: `"${file.name}" is empty.`,
            });
            setLoading(false);
            return;
          }
          if (result.data.length > 1) {
            setToastProps({
              type: "warn",
              message: `CSV contains ${result.data.length} rows — only the first will be used.`,
            });
          }
          const data = result.data[0];
          const parsedFormData: ParsedFormData = {
            ShipmentDetails: {
              "Origin Country": data["Origin Country"] || "",
              "Destination Country": data["Destination Country"] || "",
              "HS Code": data["HS Code"] || "",
              "Product Description": data["Product Description"] || "",
              Quantity: data["Quantity"] || "",
              "Gross Weight": data["Gross Weight"] || "",
            },
            TradeAndRegulatoryDetails: {
              "Incoterms 2020": data["Incoterms 2020"] || "",
              "Declared Value": {
                currency: data["Currency"] || "",
                amount: data["Declared Value"] || "",
              },
              "Currency of Transaction": data["Currency of Transaction"] || "",
              "Trade Agreement Claimed": data["Trade Agreement Claimed"] || "",
              "Dual-Use Goods": data["Dual-Use Goods"] || "No",
              "Hazardous Material": data["Hazardous Material"] || "No",
              Perishable: data["Perishable"] || "No",
            },
            PartiesAndIdentifiers: {
              "Shipper/Exporter": data["Shipper/Exporter"] || "",
              "Consignee/Importer": data["Consignee/Importer"] || "",
              "Manufacturer Information":
                data["Manufacturer Information"] || "",
              "EORI/Tax ID": data["EORI/Tax ID"] || "",
            },
            LogisticsAndHandling: {
              "Means of Transport": data["Means of Transport"] || "",
              "Port of Loading": data["Port of Loading"] || "",
              "Port of Discharge": data["Port of Discharge"] || "",
              "Special Handling": data["Special Handling"] || "",
              "Temperature Requirements":
                data["Temperature Requirements"] || "",
            },
            DocumentVerification: {
              "Commercial Invoice": {
                checked: data["Commercial Invoice"] === "true" || false,
                subItems: {
                  "Invoice number present":
                    data["Invoice number present"] === "true" || false,
                  "Details match shipment":
                    data["Details match shipment"] === "true" || false,
                  "Customs compliant":
                    data["Customs compliant"] === "true" || false,
                },
              },
              "Packing List": {
                checked: data["Packing List"] === "true" || false,
                subItems: {
                  "Contents accurate":
                    data["Contents accurate"] === "true" || false,
                  "Quantities match":
                    data["Quantities match"] === "true" || false,
                  "Matches invoice":
                    data["Matches invoice"] === "true" || false,
                },
              },
              "Certificate of Origin": {
                checked: data["Certificate of Origin"] === "true" || false,
                subItems: {
                  "Origin verified":
                    data["Origin verified"] === "true" || false,
                  "Trade agreement compliant":
                    data["Trade agreement compliant"] === "true" || false,
                },
              },
              "Licenses/Permits": {
                checked: data["Licenses/Permits"] === "true" || false,
                subItems: {
                  "Valid number": data["Valid number"] === "true" || false,
                  "Not expired": data["Not expired"] === "true" || false,
                  "Authority verified":
                    data["Authority verified"] === "true" || false,
                },
              },
              "Bill of Lading": {
                checked: data["Bill of Lading"] === "true" || false,
                subItems: {
                  "Accurate details":
                    data["Accurate details"] === "true" || false,
                  "Shipping regulations compliant":
                    data["Shipping regulations compliant"] === "true" || false,
                },
              },
            },
            IntendedUseDetails: {
              "Intended Use": data["Intended Use"] || "",
            },
          };

          setFormData(parsedFormData);
          setUploadedFile(file);
          setCsvError(null);
          setToastProps({
            type: "success",
            message: `CSV file "${file.name}" uploaded successfully!`,
          });
        } catch (error) {
          setCsvError(
            "Error parsing CSV file. Please ensure it matches the required format."
          );
          setToastProps({
            type: "error",
            message: `Error parsing "${file.name}". Check the format and try again.`,
          });
          console.error(error);
        } finally {
          setLoading(false);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (error: any) => {
        setCsvError("Failed to upload CSV file. Please try again.");
        setToastProps({
          type: "error",
          message: `Failed to upload "${file.name}". Please try again.`,
        });
        console.error(error);
        setLoading(false);
      },
    });
  };

  const handleSendToCompliance = (): void => {
    if (!formData) {
      setToastProps({
        type: "error",
        message: "No CSV data available. Please upload a file first.",
      });
      return;
    }

    setLoading(true);
    setSend(false);

    createDraftFromCsvMutation.mutate({
      formData: formData as unknown as Record<string, unknown>,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (uploadedFile) {
      setToastProps({
        type: "warn",
        message: `Please remove the previous file before uploading a new one.`,
      });
      return;
    }
    handleCsvUpload(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (uploadedFile) {
      setToastProps({
        type: "warn",
        message: `Please remove the previous file before uploading a new one.`,
      });
      return;
    }
    // Windows/Excel often label CSVs as application/vnd.ms-excel and Safari
    // sometimes leaves type empty — fall back to extension when MIME is
    // ambiguous so the drop path matches the file picker behaviour (which
    // already accepts via accept=".csv").
    const looksLikeCsv =
      !!file &&
      (file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel" ||
        file.type === "" ||
        /\.csv$/i.test(file.name));
    if (looksLikeCsv) {
      handleCsvUpload(file);
    } else {
      setCsvError("Please drop a valid CSV file.");
      setToastProps({
        type: "warn",
        message: "Invalid file type. Please drop a CSV file.",
      });
    }
  };

  const handleRemoveFile = (): void => {
    setUploadedFile(null);
    setFormData(null);
    setCsvError(null);
    setToastProps({
      type: "info",
      message: "Uploaded file removed successfully.",
    });
  };

  const handleDownloadTemplate = (): void => {
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
    setToastProps({
      type: "info",
      message: "CSV template downloaded successfully!",
    });
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      {/* Header - Unchanged */}
      <Header title="CSV Upload" page="compliance" />
      {/* Main Content */}
      <div className="flex flex-col items-center px-4 sm:px-6 py-12">
        {/* Upload Card */}
        <div className="w-full max-w-4xl">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Card Header */}
            <div className="bg-blue-600 p-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Upload Your CSV File
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    Streamline your compliance process with bulk data upload
                  </p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-8 sm:p-12">
              {/* Upload Zone */}
              <div className="relative mb-8">
                <div
                  className={`
                    relative border-2 border-dashed rounded-2xl p-12 text-center transition-colors duration-150
                    ${
                      isDragging
                        ? "border-blue-400 bg-blue-50 shadow-sm"
                        : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50"
                    }
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <defs>
                        <pattern
                          id="grid"
                          width="10"
                          height="10"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 10 0 L 0 0 0 10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect width="100" height="100" fill="url(#grid)" />
                    </svg>
                  </div>

                  {uploadedFile ? (
                    <div className="relative">
                      <div className="mb-6">
                        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-8 h-8 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                          File Successfully Uploaded
                        </h3>
                        <p className="text-gray-600">
                          <span className="font-medium text-blue-600">
                            {uploadedFile.name}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button
                          onClick={handleRemoveFile}
                          className="group relative px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          disabled={loading}
                        >
                          <span className="relative flex items-center justify-center space-x-2">
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            <span>Remove File</span>
                          </span>
                        </button>

                        <button
                          onClick={handleSendToCompliance}
                          className="group relative px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          disabled={loading || !formData}
                        >
                          <span className="relative flex items-center justify-center space-x-2">
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
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            <span>Send to Compliance Check</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="mb-6">
                        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <svg
                            className="w-10 h-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-3">
                          {isDragging
                            ? "Drop your file here!"
                            : "Choose your CSV file"}
                        </h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                          Drag and drop your CSV file here, or click the button
                          below to browse and select your file
                        </p>
                      </div>

                      <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={loading}
                      />

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        disabled={loading}
                      >
                        <span className="relative flex items-center justify-center space-x-3">
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
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                          <span>Select CSV File</span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Download Section */}
              {send && (
                <div className="bg-emerald-50 rounded-2xl p-6 mb-8 border border-emerald-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between">
                    <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                      <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
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
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">
                          Need a template?
                        </h4>
                        <p className="text-gray-600 text-sm">
                          Download our pre-formatted CSV template to get started
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadTemplate}
                      className="group relative px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      disabled={loading}
                    >
                      <span className="relative flex items-center justify-center space-x-2">
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
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Download Template</span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {csvError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-red-600"
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
                    </div>
                    <p className="text-red-700 font-medium">{csvError}</p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin">
                      <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-4 font-medium">
                    Processing your file...
                  </p>
                </div>
              )}

              {/* Instructions */}
              {send && (
                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-0.5">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">
                        File Format Requirements
                      </h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Upload a CSV file with headers matching the form fields
                        (e.g., "Origin Country", "HS Code", etc.). Use the
                        template above for the correct format and ensure all
                        required fields are included.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default CsvUploadPage;
