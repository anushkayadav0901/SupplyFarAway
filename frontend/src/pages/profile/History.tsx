import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Route,
  Package,
  Trash2,
  Clock,
  Image,
  Maximize2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { trpc } from "../../lib/trpc";

const HistoryTab: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("compliance");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const {
    data: complianceData,
    isLoading: complianceLoading,
    isError: complianceError,
    refetch: refetchCompliance,
  } = trpc.compliance.history.useQuery(undefined, { retry: false });

  const {
    data: routeData,
    isLoading: routeLoading,
    isError: routeError,
    refetch: refetchRoute,
  } = trpc.logistics.getRouteHistory.useQuery(undefined, { retry: false });

  const {
    data: productAnalysisData,
    isLoading: productLoading,
    isError: productError,
    refetch: refetchProductAnalysis,
  } = trpc.compliance.productAnalysisHistory.useQuery(undefined, { retry: false });

  const complianceHistory = complianceData?.complianceHistory ?? [];
  const routeHistory = routeData?.routeHistory ?? [];
  const productAnalysisHistory = productAnalysisData?.productAnalysisHistory ?? [];

  const loading = complianceLoading || routeLoading || productLoading;

  const deleteComplianceMutation = trpc.compliance.deleteRecord.useMutation({
    onSuccess: () => { toast.success("Compliance record deleted."); void refetchCompliance(); },
    onError: () => { toast.error("Failed to delete compliance record."); },
  });

  const deleteRouteMutation = trpc.logistics.deleteRouteRecord.useMutation({
    onSuccess: () => { toast.success("Route record deleted."); void refetchRoute(); },
    onError: () => { toast.error("Failed to delete route record."); },
  });

  const deleteProductAnalysisMutation = trpc.compliance.deleteProductAnalysis.useMutation({
    onSuccess: () => { toast.success("Product analysis deleted."); void refetchProductAnalysis(); },
    onError: () => { toast.error("Failed to delete product analysis record."); },
  });

  const tabs = [
    { value: "compliance", label: "Compliance", icon: ShieldCheck },
    { value: "route", label: "Saved Routes", icon: Route },
    { value: "product", label: "Product Analysis", icon: Package },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-48 mb-4" />
            <div className="h-20 bg-slate-50 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1 overflow-x-auto">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button key={value} onClick={() => setActiveTab(value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === value
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Compliance tab */}
      {activeTab === "compliance" && (
        <div className="space-y-4">
          {complianceError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <p className="text-red-600 mb-4 text-sm">Failed to load compliance history.</p>
              <button onClick={() => void refetchCompliance()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors">
                Retry
              </button>
            </div>
          ) : complianceHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No compliance checks yet.</p>
              <button onClick={() => navigate("/compliance")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                Run your first compliance check
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1" style={{ scrollbarGutter: "stable" }}>
              {complianceHistory.map((entry: any, index: number) => (
                <div key={entry._id} className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Compliance Check</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        entry.complianceResponse.complianceStatus === "Ready for Shipment"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {entry.complianceResponse.complianceStatus}
                      </span>
                      <button onClick={() => deleteComplianceMutation.mutate({ recordId: entry._id })}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="font-semibold text-slate-700 mb-2">Risk Assessment</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-slate-500">Risk Score:</span>
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${
                            entry.complianceResponse.riskLevel.riskScore >= 80 ? "bg-emerald-500"
                              : entry.complianceResponse.riskLevel.riskScore >= 60 ? "bg-yellow-500"
                              : "bg-red-500"
                          }`} style={{ width: `${entry.complianceResponse.riskLevel.riskScore}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{entry.complianceResponse.riskLevel.riskScore}</span>
                      </div>
                      <p className="text-xs text-slate-500">{entry.complianceResponse.summary}</p>
                    </div>
                    {entry.formData?.ShipmentDetails && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="font-semibold text-slate-700 mb-2">Shipment Details</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">Origin:</span><span className="font-medium">{entry.formData.ShipmentDetails["Origin Country"]}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Destination:</span><span className="font-medium">{entry.formData.ShipmentDetails["Destination Country"]}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">HS Code:</span><span className="font-medium">{entry.formData.ShipmentDetails["HS Code"]}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Weight:</span><span className="font-medium">{entry.formData.ShipmentDetails["Gross Weight"]} kg</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                  {entry.complianceResponse.violations?.length > 0 && (
                    <div className="mt-3 bg-red-50 rounded-xl p-4">
                      <p className="font-semibold text-red-800 text-xs mb-2">Violations</p>
                      <ul className="space-y-1">
                        {entry.complianceResponse.violations.map((v: any, i: number) => (
                          <li key={i} className="text-xs text-red-700"><strong>{v.field}:</strong> {v.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routes tab */}
      {activeTab === "route" && (
        <div className="space-y-4">
          {routeError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <p className="text-red-600 mb-4 text-sm">Failed to load route history.</p>
              <button onClick={() => void refetchRoute()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors">
                Retry
              </button>
            </div>
          ) : routeHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Route className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No saved routes yet.</p>
              <button onClick={() => navigate("/routes")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                Optimize your first route
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1" style={{ scrollbarGutter: "stable" }}>
              {routeHistory.map((entry: any, index: number) => (
                <div key={entry._id} className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center">
                        <span className="text-emerald-600 font-bold text-sm">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Route Optimization</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Saved</span>
                      <button onClick={() => deleteRouteMutation.mutate({ recordId: entry._id })}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="font-semibold text-slate-700 mb-2">Route Overview</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">From:</span><span className="font-medium">{entry.formData?.from || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">To:</span><span className="font-medium">{entry.formData?.to || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Weight:</span><span className="font-medium">{entry.formData?.weight || "N/A"} kg</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Distance:</span><span className="font-medium">{entry.routeData?.totalDistance || "N/A"} km</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Carbon Score:</span><span className="font-medium text-emerald-600">{entry.routeData?.totalCarbonScore || "N/A"}</span></div>
                      </div>
                    </div>
                    {entry.routeData?.routeDirections?.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="font-semibold text-slate-700 mb-2">Route Directions</p>
                        <div className="space-y-2">
                          {entry.routeData.routeDirections.map((dir: any, i: number) => (
                            <div key={dir.id || i} className="flex items-center gap-2 text-xs">
                              <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">{i + 1}</div>
                              <span className="font-medium">{dir.waypoints[0]} → {dir.waypoints[1]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product Analysis tab */}
      {activeTab === "product" && (
        <div className="space-y-4">
          {productError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <p className="text-red-600 mb-4 text-sm">Failed to load product analysis history.</p>
              <button onClick={() => void refetchProductAnalysis()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors">
                Retry
              </button>
            </div>
          ) : productAnalysisHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No product analyses yet.</p>
              <button onClick={() => navigate("/compliance")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                Analyse your first product
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1" style={{ scrollbarGutter: "stable" }}>
              {productAnalysisHistory.map((entry: any, index: number) => (
                <div key={entry._id} className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 font-bold text-sm">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Product Analysis</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => deleteProductAnalysisMutation.mutate({ recordId: entry._id })}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="font-semibold text-slate-700 text-sm mb-2">Product Details</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">HS Code:</span><span className="font-medium">{entry.geminiResponse["HS Code"]}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Description:</span><span className="font-medium">{entry.geminiResponse["Product Description"]}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Perishable:</span><span className="font-medium">{entry.geminiResponse.Perishable ? "Yes" : "No"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Hazardous:</span><span className="font-medium">{entry.geminiResponse.Hazardous ? "Yes" : "No"}</span></div>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="font-semibold text-slate-700 text-sm mb-2">Product Image</p>
                      {entry.imageDetails?.signedUrl ? (
                        <div className="relative w-full h-40">
                          <img src={entry.imageDetails.signedUrl} alt="Product" loading="lazy"
                            className="w-full h-full object-contain rounded-lg"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder-image.jpg"; }}
                          />
                          <button onClick={() => setSelectedImage(entry.imageDetails.signedUrl)}
                            className="absolute bottom-2 right-2 bg-slate-800 text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors">
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-40 flex flex-col items-center justify-center bg-slate-100 rounded-lg">
                          <Image className="w-6 h-6 text-slate-400 mb-1" />
                          <p className="text-xs text-slate-400">No image available</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {entry.geminiResponse["Required Export Document List"]?.length > 0 && (
                    <div className="mt-3 bg-slate-50 rounded-xl p-4">
                      <p className="font-semibold text-slate-700 text-xs mb-2">Required Documents</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {entry.geminiResponse["Required Export Document List"].map((doc: string, i: number) => (
                          <li key={i} className="text-xs text-slate-600">{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
          <div className="relative bg-white rounded-2xl p-6 max-w-3xl w-full mx-4 shadow-sm border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedImage(null)} aria-label="Close"
              className="absolute top-4 right-4 bg-red-600 rounded-full p-2 text-white hover:bg-red-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="min-h-[200px] flex items-center justify-center">
              <img src={selectedImage} alt="Expanded Product" className="w-full h-auto max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
