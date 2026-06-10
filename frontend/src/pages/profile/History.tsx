import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaShieldAlt,
  FaRoute,
  FaBox,
  FaTrash,
  FaClock,
  FaImage,
  FaExpand,
  FaTimes,
} from "react-icons/fa";
import Toast from "./../../components/Toast";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

// MUI Imports for Dropdown
import { Select, MenuItem, FormControl, InputLabel } from "@mui/material";

interface ToastProps {
  type: string;
  message: string;
}

const History: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("compliance");
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // tRPC queries
  const {
    data: complianceData,
    isLoading: complianceLoading,
    isError: complianceError,
    refetch: refetchCompliance,
  } = trpc.compliance.history.useQuery(undefined, {
    retry: false,
  });

  const {
    data: routeData,
    isLoading: routeLoading,
    isError: routeError,
    refetch: refetchRoute,
  } = trpc.logistics.getRouteHistory.useQuery(undefined, {
    retry: false,
  });

  const {
    data: productAnalysisData,
    isLoading: productLoading,
    isError: productError,
    refetch: refetchProductAnalysis,
  } = trpc.compliance.productAnalysisHistory.useQuery(undefined, {
    retry: false,
  });

  const complianceHistory = complianceData?.complianceHistory ?? [];
  const routeHistory = routeData?.routeHistory ?? [];
  const productAnalysisHistory = productAnalysisData?.productAnalysisHistory ?? [];

  const loading = complianceLoading || routeLoading || productLoading;

  // tRPC mutations
  const deleteComplianceMutation = trpc.compliance.deleteRecord.useMutation({
    onSuccess: () => {
      setToastProps({ type: "success", message: "Compliance record deleted successfully!" });
      void refetchCompliance();
    },
    onError: () => {
      setToastProps({ type: "error", message: "Failed to delete compliance record." });
    },
  });

  const deleteRouteMutation = trpc.logistics.deleteRouteRecord.useMutation({
    onSuccess: () => {
      setToastProps({ type: "success", message: "Route record deleted successfully!" });
      void refetchRoute();
    },
    onError: () => {
      setToastProps({ type: "error", message: "Failed to delete route record." });
    },
  });

  const deleteProductAnalysisMutation = trpc.compliance.deleteProductAnalysis.useMutation({
    onSuccess: () => {
      setToastProps({ type: "success", message: "Product analysis record deleted successfully!" });
      void refetchProductAnalysis();
    },
    onError: () => {
      setToastProps({ type: "error", message: "Failed to delete product analysis record." });
    },
  });

  const handleDeleteCompliance = (recordId: string): void => {
    deleteComplianceMutation.mutate({ recordId });
  };

  const handleDeleteRoute = (recordId: string): void => {
    deleteRouteMutation.mutate({ recordId });
  };

  const handleDeleteProductAnalysis = (recordId: string): void => {
    deleteProductAnalysisMutation.mutate({ recordId });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.2, ease: "easeOut" },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15, ease: "easeOut" } },
  };

  // Tab navigation — rendered always (stable during load)
  const tabNav = (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-2">
      {/* Dropdown for small screens */}
      <div className="sm:hidden">
        <FormControl fullWidth>
          <InputLabel id="tab-select-label">Select Tab</InputLabel>
          <Select
            labelId="tab-select-label"
            value={activeTab}
            label="Select Tab"
            onChange={(e) => setActiveTab(e.target.value as string)}
            sx={{
              borderRadius: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.4)",
              "& .MuiSelect-select": { paddingY: "12px" },
            }}
          >
            <MenuItem value="compliance">
              <div className="flex items-center gap-2">
                <FaShieldAlt className="text-blue-500" />
                Compliance
              </div>
            </MenuItem>
            <MenuItem value="route">
              <div className="flex items-center gap-2">
                <FaRoute className="text-emerald-500" />
                Routes
              </div>
            </MenuItem>
            <MenuItem value="product">
              <div className="flex items-center gap-2">
                <FaBox className="text-purple-500" />
                Product Analysis
              </div>
            </MenuItem>
          </Select>
        </FormControl>
      </div>
      {/* Horizontal tabs for larger screens */}
      <div className="hidden sm:flex">
        <button
          onClick={() => setActiveTab("compliance")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-medium transition-[colors,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
            activeTab === "compliance"
              ? "bg-blue-500 text-white shadow-md"
              : "text-gray-600 hover:text-blue-500 hover:bg-blue-50"
          }`}
        >
          <FaShieldAlt className="text-lg" />
          <span className="hidden sm:inline">Compliance History</span>
          <span className="sm:hidden">Compliance</span>
        </button>
        <button
          onClick={() => setActiveTab("route")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-medium transition-[colors,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${
            activeTab === "route"
              ? "bg-emerald-500 text-white shadow-md"
              : "text-gray-600 hover:text-emerald-500 hover:bg-emerald-50"
          }`}
        >
          <FaRoute className="text-lg" />
          <span className="hidden sm:inline">Saved Routes</span>
          <span className="sm:hidden">Routes</span>
        </button>
        <button
          onClick={() => setActiveTab("product")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-medium transition-[colors,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1 ${
            activeTab === "product"
              ? "bg-purple-500 text-white shadow-md"
              : "text-gray-600 hover:text-purple-500 hover:bg-purple-50"
          }`}
        >
          <FaBox className="text-lg" />
          <span className="hidden sm:inline">Product Analysis</span>
          <span className="sm:hidden">Products</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      <Header title="History" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation — always shown for layout stability */}
        <div className="mb-8">{tabNav}</div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="history-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white/80 rounded-2xl border border-gray-200/50 p-6 animate-pulse"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-gray-200 rounded w-40" />
                      <div className="h-4 bg-gray-100 rounded w-32" />
                    </div>
                    <div className="h-8 w-24 bg-gray-200 rounded-full" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-32 bg-gray-100 rounded-xl" />
                    <div className="h-32 bg-gray-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
          <motion.div
            key="history-content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="wait">
            {activeTab === "compliance" && (
              <motion.div
                key="tab-compliance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <FaShieldAlt className="text-2xl text-blue-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Compliance History
                  </h2>
                </div>
                {complianceError ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <p className="text-red-600 mb-4">Failed to load compliance history.</p>
                    <button
                      onClick={() => void refetchCompliance()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : complianceHistory.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
                    <FaShieldAlt className="text-4xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-4">
                      No compliance checks yet.
                    </p>
                    <button
                      onClick={() => navigate("/compliance-check")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      Run your first compliance check
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" style={{ scrollbarGutter: "stable" }}>
                    {complianceHistory.map((entry: any, index: number) => (
                      <motion.div
                        key={entry._id}
                        variants={itemVariants}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-shadow duration-150 ease-out"
                      >
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-bold">
                                #{index + 1}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">
                                Compliance Check
                              </h3>
                              <p className="text-gray-500 flex items-center gap-2">
                                <FaClock className="text-sm" />
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-4 py-2 rounded-full text-sm font-medium ${
                                entry.complianceResponse.complianceStatus ===
                                "Ready for Shipment"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {entry.complianceResponse.complianceStatus}
                            </span>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteCompliance(entry._id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            >
                              <FaTrash />
                            </motion.button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="bg-gray-50 rounded-xl p-4">
                              <h4 className="font-semibold text-gray-900 mb-3">
                                Risk Assessment
                              </h4>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm text-gray-600">
                                  Risk Score:
                                </span>
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      entry.complianceResponse.riskLevel
                                        .riskScore >= 80
                                        ? "bg-emerald-500"
                                        : entry.complianceResponse.riskLevel
                                            .riskScore >= 60
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{
                                      width: `${entry.complianceResponse.riskLevel.riskScore}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {entry.complianceResponse.riskLevel.riskScore}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {entry.complianceResponse.summary}
                              </p>
                            </div>
                            {entry.complianceResponse.violations.length > 0 && (
                              <div className="bg-red-50 rounded-xl p-4">
                                <h4 className="font-semibold text-red-800 mb-3">
                                  Violations
                                </h4>
                                <ul className="space-y-2">
                                  {entry.complianceResponse.violations.map(
                                    (v: any, i: number) => (
                                      <li
                                        key={i}
                                        className="text-sm text-red-700"
                                      >
                                        <strong>{v.field}:</strong> {v.message}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Shipment Details
                            </h4>
                            {entry.formData.ShipmentDetails ? (
                              <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-gray-600">Origin:</span>
                                  <span className="font-medium">
                                    {
                                      entry.formData.ShipmentDetails[
                                        "Origin Country"
                                      ]
                                    }
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-gray-600">
                                    Destination:
                                  </span>
                                  <span className="font-medium">
                                    {
                                      entry.formData.ShipmentDetails[
                                        "Destination Country"
                                      ]
                                    }
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-gray-600">
                                    HS Code:
                                  </span>
                                  <span className="font-medium">
                                    {entry.formData.ShipmentDetails["HS Code"]}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-gray-600">
                                    Description:
                                  </span>
                                  <span className="font-medium">
                                    {
                                      entry.formData.ShipmentDetails[
                                        "Product Description"
                                      ]
                                    }
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-gray-600">
                                    Quantity:
                                  </span>
                                  <span className="font-medium">
                                    {entry.formData.ShipmentDetails["Quantity"]}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-gray-600">Weight:</span>
                                  <span className="font-medium">
                                    {
                                      entry.formData.ShipmentDetails[
                                        "Gross Weight"
                                      ]
                                    }{" "}
                                    kg
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm">
                                No shipment details available.
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "route" && (
              <motion.div
                key="tab-route"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <FaRoute className="text-2xl text-emerald-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Saved Routes
                  </h2>
                </div>
                {routeError ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <p className="text-red-600 mb-4">Failed to load route history.</p>
                    <button
                      onClick={() => void refetchRoute()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : routeHistory.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
                    <FaRoute className="text-4xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-4">
                      No saved routes yet.
                    </p>
                    <button
                      onClick={() => navigate("/route-optimization")}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    >
                      Optimize your first route
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" style={{ scrollbarGutter: "stable" }}>
                    {routeHistory.map((entry: any, index: number) => (
                      <motion.div
                        key={entry._id}
                        variants={itemVariants}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-shadow duration-150 ease-out"
                      >
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-emerald-600 font-bold">
                                #{index + 1}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">
                                Route Optimization
                              </h3>
                              <p className="text-gray-500 flex items-center gap-2">
                                <FaClock className="text-sm" />
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                              Saved
                            </span>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteRoute(entry._id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            >
                              <FaTrash />
                            </motion.button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Route Overview
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">From:</span>
                                <span className="font-medium">
                                  {entry.formData?.from || "N/A"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">To:</span>
                                <span className="font-medium">
                                  {entry.formData?.to || "N/A"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">Weight:</span>
                                <span className="font-medium">
                                  {entry.formData?.weight || "N/A"} kg
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">Distance:</span>
                                <span className="font-medium">
                                  {entry.routeData?.totalDistance || "N/A"} km
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">
                                  Carbon Score:
                                </span>
                                <span className="font-medium text-emerald-600">
                                  {entry.routeData?.totalCarbonScore || "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 mb-3">
                              Route Directions
                            </h3>
                            {entry.routeData?.routeDirections?.length > 0 ? (
                              <div className="space-y-3">
                                {entry.routeData.routeDirections.map(
                                  (direction: any, i: number) => (
                                    <div
                                      key={direction.id}
                                      className="flex items-center gap-3 text-sm"
                                    >
                                      <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                        {i + 1}
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900">
                                          {direction.waypoints[0]} →{" "}
                                          {direction.waypoints[1]}
                                        </p>
                                        <p className="text-gray-600">
                                          Transport:{" "}
                                          {direction.state
                                            .charAt(0)
                                            .toUpperCase() +
                                            direction.state.slice(1)}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm">
                                No route directions available.
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "product" && (
              <motion.div
                key="tab-product"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <FaBox className="text-2xl text-purple-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Product Analysis History
                  </h2>
                </div>
                {productError ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <p className="text-red-600 mb-4">Failed to load product analysis history.</p>
                    <button
                      onClick={() => void refetchProductAnalysis()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : productAnalysisHistory.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
                    <FaBox className="text-4xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-4">
                      No product analyses yet.
                    </p>
                    <button
                      onClick={() => navigate("/product-analysis")}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                    >
                      Analyse your first product
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" style={{ scrollbarGutter: "stable" }}>
                    {productAnalysisHistory.map((entry: any, index: number) => (
                      <motion.div
                        key={entry._id}
                        variants={itemVariants}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-shadow duration-150 ease-out"
                      >
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-purple-600 font-bold">
                                #{index + 1}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">
                                Product Analysis
                              </h3>
                              <p className="text-gray-500 flex items-center gap-2">
                                <FaClock className="text-sm" />
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                handleDeleteProductAnalysis(entry._id)
                              }
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            >
                              <FaTrash />
                            </motion.button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Product Details
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">HS Code:</span>
                                <span className="font-medium">
                                  {entry.geminiResponse["HS Code"]}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">
                                  Description:
                                </span>
                                <span className="font-medium">
                                  {entry.geminiResponse["Product Description"]}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">
                                  Perishable:
                                </span>
                                <span className="font-medium">
                                  {entry.geminiResponse.Perishable
                                    ? "Yes"
                                    : "No"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-gray-600">
                                  Hazardous:
                                </span>
                                <span className="font-medium">
                                  {entry.geminiResponse.Hazardous
                                    ? "Yes"
                                    : "No"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Product Image
                            </h4>
                            {entry.imageDetails?.signedUrl ? (
                              <div className="relative w-full h-48">
                                <img
                                  src={entry.imageDetails.signedUrl}
                                  alt="Product"
                                  width="100%"
                                  height={192}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-contain rounded-lg"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = "/placeholder-image.jpg";
                                  }}
                                />
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    setSelectedImage(
                                      entry.imageDetails.signedUrl
                                    )
                                  }
                                  className="absolute bottom-2 right-2 bg-purple-500 text-white p-2 rounded-full shadow-md hover:bg-purple-600 transition-colors duration-200"
                                >
                                  <FaExpand className="text-sm" />
                                </motion.button>
                              </div>
                            ) : (
                              <div className="w-full h-48 flex items-center justify-center bg-gray-200 rounded-lg">
                                <FaImage className="text-4xl text-gray-400" />
                                <p className="text-gray-500 text-sm ml-2">
                                  No image available
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 bg-gray-50 rounded-xl p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">
                            Export Requirements
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-gray-600">
                                Required Documents:
                              </span>
                              <ul className="list-disc pl-5 mt-1">
                                {entry.geminiResponse[
                                  "Required Export Document List"
                                ]?.map((doc: string, i: number) => (
                                  <li key={i} className="text-gray-800">
                                    {doc}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Recommendations:
                              </span>
                              <p className="text-gray-800 mt-1">
                                {entry.geminiResponse.Recommendations?.message}
                              </p>
                              <p className="text-gray-600 italic mt-1">
                                Tip:{" "}
                                {
                                  entry.geminiResponse.Recommendations
                                    ?.additionalTip
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image Popup Modal — outside scroll container, uses AnimatePresence for exit animation */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative bg-white rounded-2xl p-6 max-w-3xl w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                aria-label="Close lightbox"
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-full"
              >
                <div className="bg-red-600 rounded-full p-2">
                  <FaTimes className="text-xl text-white" />
                </div>
              </button>
              {/* min-h prevents modal height jump while image loads */}
              <div className="min-h-[200px] flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Expanded Product"
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                />
              </div>
              <p className="text-center text-gray-600 mt-4 italic">
                Expanded View
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default History;
