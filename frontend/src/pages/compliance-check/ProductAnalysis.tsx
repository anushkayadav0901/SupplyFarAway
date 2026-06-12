import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ContentCopy, Send } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import { motion } from "framer-motion";
import { FaTrash, FaImage } from "react-icons/fa";
import Toast from "./../../components/Toast";
import Header from "../../components/Header";

// Fall back to local dev when VITE_BACKEND_URL is unset so the upload never
// targets "undefined/api/analyze-product".
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  "http://localhost:5000";

interface ToastProps {
  type: string;
  message: string;
}

interface AnalysisData {
  "HS Code": string;
  "Product Description": string;
  Perishable: boolean;
  Hazardous: boolean;
  "Required Export Document List": string[];
  Recommendations: {
    message: string;
    additionalTip: string;
  };
}

interface AnalysisResult {
  data?: AnalysisData;
  draftId?: string;
  error?: string;
}

const ProductAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [works, setWorks] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedImage]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File): void => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToastProps({
        type: "error",
        message: "Only image files are supported. Please choose a JPG, PNG, WebP, or GIF.",
      });
      return;
    }
    // Defence-in-depth: enforce the same 10MB cap that the server enforces so
    // the user gets feedback before uploading a large image and waiting for
    // a 413.
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setToastProps({
        type: "error",
        message: `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max allowed is 10 MB.`,
      });
      return;
    }
    setSelectedImage(file);
    setAnalysisResult(null);
    setToastProps({
      type: "success",
      message: `Image uploaded successfully!`,
    });
  };

  const handleRemoveImage = (): void => {
    setSelectedImage(null);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setToastProps({
      type: "info",
      message: "Uploaded image removed successfully.",
    });
  };

  // /api/analyze-product is a legacy Express endpoint (multipart/form-data image upload via multer)
  // Keep as axios call — not in tRPC registry
  const handleAnalyze = async (): Promise<void> => {
    if (!selectedImage) return;

    setWorks(false);

    setIsLoading(true);
    setAnalysisResult(null);
    const formData = new FormData();
    formData.append("image", selectedImage);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.post(
        `${BACKEND_URL}/api/analyze-product`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setAnalysisResult(response.data as AnalysisResult);
    } catch (error: unknown) {
      console.error("Error analyzing image:", error);
      // Prefer the server-provided error message (multer / route returns JSON
      // with { error: "..." }) over the generic axios status message.
      let errMsg = "Failed to analyze image";
      if (axios.isAxiosError(error)) {
        const serverMsg = (error.response?.data as { error?: string } | undefined)?.error;
        errMsg = serverMsg || error.message || errMsg;
      } else if (error instanceof Error) {
        errMsg = error.message;
      }
      setAnalysisResult({ error: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string): void => {
    void navigator.clipboard.writeText(text);
    setToastProps({
      type: "success",
      message: `Copied: ${text}`,
    });
  };

  const handleSendToCompliance = (): void => {
    if (!analysisResult || !analysisResult.draftId) {
      setToastProps({
        type: "error",
        message: "No draft available to send to compliance check.",
      });
      return;
    }

    navigate(`/compliance-check?draftId=${analysisResult.draftId}`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const itemVariants = {
    hidden: { y: 12, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: "easeOut" as const },
    },
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      {/* Header */}
      <Header title="Product Analysis" page="compliance-check" />

      {/* Main Content */}
      <div className="flex flex-col items-center px-4 sm:px-6 py-12">
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
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Analyze Product Image
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    Upload a product image for AI-powered analysis and
                    compliance insights
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

                  {selectedImage ? (
                    <div className="relative">
                      <div className="mb-6">
                        <div className="mx-auto w-[320px] aspect-[4/3] relative mb-4">
                          {previewUrl && (
                            <img
                              src={previewUrl}
                              alt="Preview"
                              width={320}
                              height={240}
                              className="w-full h-full object-contain rounded-2xl shadow-xl"
                            />
                          )}
                        </div>
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
                          Image Successfully Uploaded
                        </h3>
                        <p className="text-gray-600">
                          <span className="font-medium text-blue-600">
                            {selectedImage.name}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button
                          onClick={handleRemoveImage}
                          className="group relative px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          disabled={isLoading}
                        >
                          <span className="relative flex items-center justify-center space-x-2">
                            <FaTrash className="w-4 h-4" />
                            <span>Remove Image</span>
                          </span>
                        </button>

                        <button
                          onClick={() => void handleAnalyze()}
                          className="group relative px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[180px]"
                          disabled={isLoading}
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
                            <span>
                              {isLoading ? "Analyzing..." : "Analyze Product"}
                            </span>
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="mb-6">
                        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <FaImage className="text-white text-2xl" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-3">
                          {isDragging
                            ? "Drop your image here!"
                            : "Upload Product Image"}
                        </h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                          Drag and drop your product image here, or click the
                          button below to browse and select your file
                        </p>
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileInput}
                        className="hidden"
                        disabled={isLoading}
                      />

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        disabled={isLoading}
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
                          <span>Select Image</span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-8 mb-8">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin">
                      <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-4 font-medium">
                    Analyzing your product image...
                  </p>
                </div>
              )}

              {/* Analysis Results */}
              {analysisResult && (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-6"
                >
                  {analysisResult.data ? (
                    <>
                      <motion.div
                        variants={itemVariants}
                        className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200"
                      >
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-white"
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
                          <h3 className="text-xl font-semibold text-gray-800">
                            Product Details
                          </h3>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-white rounded-xl">
                            <div className="flex-1">
                              <span className="text-gray-600 font-medium block mb-1">
                                HS Code:
                              </span>
                              <span className="text-gray-800 font-semibold">
                                {analysisResult.data["HS Code"]}
                              </span>
                            </div>
                            <Tooltip title="Copy HS Code" placement="top">
                              <button
                                onClick={() =>
                                  handleCopy(analysisResult.data!["HS Code"])
                                }
                                className="ml-2 p-2 text-gray-500 hover:text-teal-600 transition rounded-lg hover:bg-teal-50"
                              >
                                <ContentCopy fontSize="small" />
                              </button>
                            </Tooltip>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-white rounded-xl">
                            <div className="flex-1">
                              <span className="text-gray-600 font-medium block mb-1">
                                Description:
                              </span>
                              <span className="text-gray-800">
                                {analysisResult.data["Product Description"]}
                              </span>
                            </div>
                            <Tooltip title="Copy Description" placement="top">
                              <button
                                onClick={() =>
                                  handleCopy(
                                    analysisResult.data!["Product Description"]
                                  )
                                }
                                className="ml-2 p-2 text-gray-500 hover:text-teal-600 transition rounded-lg hover:bg-teal-50"
                              >
                                <ContentCopy fontSize="small" />
                              </button>
                            </Tooltip>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white rounded-xl">
                              <span className="text-gray-600 font-medium block mb-1">
                                Perishable:
                              </span>
                              <span
                                className={`font-semibold ${
                                  analysisResult.data["Perishable"]
                                    ? "text-orange-600"
                                    : "text-green-600"
                                }`}
                              >
                                {analysisResult.data["Perishable"]
                                  ? "Yes"
                                  : "No"}
                              </span>
                            </div>
                            <div className="p-4 bg-white rounded-xl">
                              <span className="text-gray-600 font-medium block mb-1">
                                Hazardous:
                              </span>
                              <span
                                className={`font-semibold ${
                                  analysisResult.data["Hazardous"]
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {analysisResult.data["Hazardous"]
                                  ? "Yes"
                                  : "No"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={itemVariants}
                        className="bg-blue-50 rounded-2xl p-6 border border-blue-200"
                      >
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-white"
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
                          <h3 className="text-xl font-semibold text-gray-800">
                            Required Export Documents
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {analysisResult.data[
                            "Required Export Document List"
                          ].map((doc, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-3 p-3 bg-white rounded-lg"
                            >
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-gray-800">{doc}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>

                      <motion.div
                        variants={itemVariants}
                        className="bg-amber-50 rounded-2xl p-6 border border-amber-200"
                      >
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                              />
                            </svg>
                          </div>
                          <h3 className="text-xl font-semibold text-gray-800">
                            Recommendations
                          </h3>
                        </div>
                        <div className="space-y-4">
                          <div className="p-4 bg-white rounded-xl">
                            <p className="text-gray-800">
                              <strong className="text-amber-700">
                                Message:
                              </strong>{" "}
                              {analysisResult.data.Recommendations.message}
                            </p>
                          </div>
                          <div className="p-4 bg-white rounded-xl">
                            <p className="text-gray-800">
                              <strong className="text-amber-700">
                                Additional Tips:
                              </strong>{" "}
                              {
                                analysisResult.data.Recommendations
                                  .additionalTip
                              }
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={itemVariants}
                        className="flex justify-center"
                      >
                        <button
                          onClick={handleSendToCompliance}
                          className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <span className="relative flex items-center justify-center space-x-3">
                            <Send className="w-5 h-5" />
                            <span>Send to Compliance Check</span>
                          </span>
                        </button>
                      </motion.div>
                    </>
                  ) : (
                    <motion.div
                      variants={itemVariants}
                      className="bg-red-50 border border-red-200 rounded-2xl p-6"
                    >
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
                        <p className="text-red-700 font-medium">
                          Error: {analysisResult.error}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Instructions */}
              {works && (
                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200 mt-8">
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
                        How it works
                      </h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Upload a clear image of your product and our AI will
                        analyze it to determine the HS code, product
                        description, and required export documentation. For best
                        results, ensure the product is clearly visible and
                        well-lit in the image.
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

export default ProductAnalysis;
