import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Violation {
  field: string;
  message: string;
}

interface Recommendation {
  field: string;
  message: string;
}

interface RiskLevel {
  riskScore: number;
  summary: string;
}

interface Scores {
  ShipmentDetails?: number;
  TradeAndRegulatoryDetails?: number;
  PartiesAndIdentifiers?: number;
  LogisticsAndHandling?: number;
  IntendedUseDetails?: number;
}

interface ComplianceResponseData {
  complianceStatus?: string;
  summary?: string;
  violations?: Violation[];
  recommendations?: Recommendation[];
  additionalTips?: string[];
  riskLevel?: RiskLevel;
  scores?: Scores;
}

interface ComplianceResponseProps {
  response: {
    complianceResponse?: ComplianceResponseData;
    [key: string]: unknown;
  } | null;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Error Boundary Component (keep as is)
class ErrorBoundary extends React.Component<
  React.PropsWithChildren<Record<never, never>>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Something went wrong displaying the compliance results. Please try
          again.
        </div>
      );
    }
    return this.props.children;
  }
}

// ComplianceResponse Component
const ComplianceResponse: React.FC<ComplianceResponseProps> = ({ response }) => {
  if (
    !response ||
    !response.complianceResponse ||
    Object.keys(response.complianceResponse).length === 0
  ) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg">
        No compliance results available.
      </div>
    );
  }

  // Safely extract properties, providing robust fallbacks for potential undefined/null values
  const complianceResponseData = response.complianceResponse;

  const complianceStatus =
    complianceResponseData.complianceStatus ?? "Not Ready";
  const summary = complianceResponseData.summary ?? "No summary provided";
  const violations = complianceResponseData.violations ?? [];
  const recommendations = complianceResponseData.recommendations ?? [];
  const additionalTips = complianceResponseData.additionalTips ?? [];

  // Ensure riskLevel is always an object with default properties
  const riskLevel = complianceResponseData.riskLevel ?? {
    riskScore: 0,
    summary: "No risk assessment available",
  };

  // Ensure scores is always an object
  const scores = complianceResponseData.scores ?? {};

  const chartData = [
    { name: "Shipment Details", score: scores.ShipmentDetails || 0 },
    {
      name: "Trade & Regulatory",
      score: scores.TradeAndRegulatoryDetails || 0,
    },
    { name: "Parties & Identifiers", score: scores.PartiesAndIdentifiers || 0 },
    { name: "Logistics & Handling", score: scores.LogisticsAndHandling || 0 },
    { name: "Intended Use", score: scores.IntendedUseDetails || 0 },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
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
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-6 bg-blue-50 shadow-custom-medium rounded-lg p-8"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header */}
            <motion.h2
              variants={itemVariants}
              className="text-3xl font-bold text-gray-900 mb-6 flex items-center"
            >
              <span className="mr-2">
                {complianceStatus === "Ready for Shipment" ? (
                  <CheckCircle2 className="text-emerald-500" size={32} />
                ) : (
                  <AlertTriangle className="text-red-500" size={32} />
                )}
              </span>
              Compliance Check Results
            </motion.h2>

            {/* Compliance Status */}
            <motion.div variants={itemVariants} className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Status</h3>
              <span
                className={`inline-block px-4 py-2 mt-2 rounded-full text-white font-medium ${
                  complianceStatus === "Ready for Shipment"
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              >
                {complianceStatus}
              </span>
            </motion.div>

            {/* Summary */}
            <motion.div variants={itemVariants} className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Summary</h3>
              <p className="mt-2 text-gray-600">{summary}</p>
            </motion.div>

            {/* Risk Level */}
            <motion.div variants={itemVariants} className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Risk Level
              </h3>
              <div className="mt-2">
                <p className="text-gray-600">
                  Risk Score: {riskLevel.riskScore}/100
                </p>
                <div className="w-full bg-gray-200 rounded-full h-4 mt-2 overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: riskLevel.riskScore / 100 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ transformOrigin: "left" }}
                    className={`h-4 w-full rounded-full ${
                      riskLevel.riskScore < 30
                        ? "bg-green-500"
                        : riskLevel.riskScore < 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                </div>
                <p className="mt-2 text-gray-600">{riskLevel.summary}</p>
              </div>
            </motion.div>

            {/* Violations and Recommendations */}
            {(violations.length > 0 || recommendations.length > 0) && (
              <motion.div variants={itemVariants} className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Issues & Recommendations
                </h3>
                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full bg-white rounded-lg shadow-sm">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="px-4 py-2 text-left text-blue-700">
                          Field
                        </th>
                        <th className="px-4 py-2 text-left text-blue-700">
                          Violation
                        </th>
                        <th className="px-4 py-2 text-left text-blue-700">
                          Recommendation
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {violations.map((violation, index) => {
                        const matchingRecommendation = recommendations.find(
                          (rec) => rec.field === violation.field
                        );
                        return (
                          <motion.tr
                            key={index}
                            variants={itemVariants}
                            className="border-b"
                          >
                            <td className="px-4 py-2 text-gray-800">
                              {violation.field || "Unknown"}
                            </td>
                            <td className="px-4 py-2 text-red-600">
                              {violation.message || "No message"}
                            </td>
                            <td className="px-4 py-2 text-green-600">
                              {matchingRecommendation?.message || "N/A"}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Scores */}
            <motion.div variants={itemVariants} className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Compliance Scores
              </h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#2563EB" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Additional Tips */}
            {additionalTips.length > 0 && (
              <motion.div variants={itemVariants}>
                <h3 className="text-xl font-semibold text-gray-900">
                  Additional Tips
                </h3>
                <ul className="mt-2 space-y-2">
                  {additionalTips.map((tip, index) => (
                    <motion.li
                      key={index}
                      variants={itemVariants}
                      className="flex items-start"
                    >
                      <span className="text-blue-500 mr-2">•</span>
                      <span className="text-gray-600">{tip}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </ErrorBoundary>
  );
};

export default ComplianceResponse;
