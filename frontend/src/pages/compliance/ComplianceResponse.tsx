import React from "react";
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

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto mt-6 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        {/* Header */}
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          {complianceStatus === "Ready for Shipment" ? (
            <CheckCircle2 className="text-emerald-500 shrink-0" size={28} />
          ) : (
            <AlertTriangle className="text-red-500 shrink-0" size={28} />
          )}
          Compliance Results
        </h2>

        {/* Compliance Status */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</h3>
          <span
            className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
              complianceStatus === "Ready for Shipment"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {complianceStatus}
          </span>
        </div>

        {/* Summary */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Summary</h3>
          <p className="text-slate-700">{summary}</p>
        </div>

        {/* Risk Level */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Risk Score — {riskLevel.riskScore}/100
          </h3>
          <div className="w-full bg-slate-200 rounded h-2 overflow-hidden">
            <div
              style={{ width: `${riskLevel.riskScore}%` }}
              className={`h-2 rounded ${
                riskLevel.riskScore < 30
                  ? "bg-emerald-500"
                  : riskLevel.riskScore < 60
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            />
          </div>
          <p className="mt-2 text-sm text-slate-600">{riskLevel.summary}</p>
        </div>

        {/* Violations and Recommendations */}
        {(violations.length > 0 || recommendations.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Issues & Recommendations
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-slate-200 rounded-lg text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-left text-slate-700 font-semibold border-b border-slate-200">
                      Field
                    </th>
                    <th className="px-4 py-2 text-left text-slate-700 font-semibold border-b border-slate-200">
                      Violation
                    </th>
                    <th className="px-4 py-2 text-left text-slate-700 font-semibold border-b border-slate-200">
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
                      <tr key={index} className="border-b border-slate-100">
                        <td className="px-4 py-2 text-slate-800">
                          {violation.field || "Unknown"}
                        </td>
                        <td className="px-4 py-2 text-red-600">
                          {violation.message || "No message"}
                        </td>
                        <td className="px-4 py-2 text-emerald-600">
                          {matchingRecommendation?.message || "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Scores */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Compliance Scores
          </h3>
          <div className="h-64">
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
        </div>

        {/* Additional Tips */}
        {additionalTips.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Additional Tips
            </h3>
            <ul className="space-y-1">
              {additionalTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default ComplianceResponse;
