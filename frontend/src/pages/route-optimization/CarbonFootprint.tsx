import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FaLeaf, FaTimes } from "react-icons/fa";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useNavigate, useParams } from "react-router-dom";
import Toast from "./../../components/Toast";
import { trpc } from "../../lib/trpc";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteLeg {
  leg: string;
  origin: string;
  destination: string;
  mode: string;
  distance: string;
  emissions: string;
}

interface CarbonData {
  totalDistance: string;
  totalEmissions: string;
  routeAnalysis: RouteLeg[];
  suggestions: string[];
  earthImpact: string;
}

interface ToastProps {
  type: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CarbonFootprint(): React.ReactElement {
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });
  const navigate = useNavigate();
  const { draftId } = useParams<{ draftId: string }>();
  const prefersReducedMotion = useReducedMotion();

  // (Dead helper removed — was firing an uncleared setTimeout that updated
  // state after unmount when the user navigated away mid-toast.)

  const { data: rawCarbonData, isLoading: loading, isError, refetch } = trpc.logistics.getCarbonFootprint.useQuery(
    { draftId: draftId ?? "" },
    { enabled: !!draftId }
  );

  const carbonData = rawCarbonData as CarbonData | undefined;

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
    }
  };

  const chartData = carbonData?.routeAnalysis
    ? {
        labels: carbonData.routeAnalysis.map(
          (leg) => `${leg.leg} (${leg.mode})`
        ),
        datasets: [
          {
            label: "CO2e Emissions (kg)",
            // Extract the first numeric token from the emissions string so
            // minor format drift (e.g. "1.5kg CO2e" vs "1.5 kg CO2e") doesn't
            // produce NaN bars in the chart.
            data: carbonData.routeAnalysis.map((leg) => {
              const match = String(leg.emissions ?? "").match(/-?\d+(\.\d+)?/);
              return match ? parseFloat(match[0]) : 0;
            }),
            backgroundColor: "rgba(22, 163, 74, 0.5)",
            borderColor: "rgba(22, 163, 74, 1)",
            borderWidth: 1,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Carbon Emissions by Route Leg" },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "kg CO2e" } },
    },
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-gray-900 p-6 md:p-10">
      <Toast type={toastProps.type} message={toastProps.message} />
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleClose}
          className="bg-white hover:bg-gray-100 text-gray-600 p-2 rounded-full border border-gray-200 shadow-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Close"
        >
          <FaTimes className="w-4 h-4" />
        </button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="max-w-6xl mx-auto relative"
      >
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.06, duration: 0.2 }}
            className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-gray-900"
          >
            Carbon{" "}
            <span className="text-green-600">Footprint</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="text-base text-gray-500 max-w-2xl mx-auto"
          >
            Visualize your route's carbon impact and its effect on Earth.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="bg-white rounded-2xl p-6 md:p-10 border border-gray-200 shadow-sm"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="w-12 h-12 mb-4"
              >
                <FaLeaf className="w-full h-full text-green-500" />
              </motion.div>
              <p className="text-gray-600 text-base font-medium">
                Loading carbon footprint data...
              </p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <FaLeaf className="text-xl text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Could not load carbon footprint data
              </h3>
              <p className="text-gray-500 text-sm mb-6 max-w-sm">
                There was a problem fetching the analysis. Please try again or go back to run a new route.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => refetch()}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                >
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : carbonData ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* Summary */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">
                  Carbon Footprint Summary
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                    <p className="text-gray-500 text-sm mb-1">Total Distance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {carbonData.totalDistance}
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                    <p className="text-gray-500 text-sm mb-1">Total Emissions</p>
                    <p className="text-2xl font-bold text-red-600">
                      {carbonData.totalEmissions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Graph */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Emissions Breakdown</h3>
                {chartData && <Bar data={chartData} options={chartOptions} />}
              </div>

              {/* Route Analysis */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Route Analysis</h3>
                <div className="space-y-3">
                  {carbonData.routeAnalysis.map((leg, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                      <h4 className="text-base font-semibold text-green-700 mb-1">
                        {leg.leg}: {leg.origin} → {leg.destination}
                      </h4>
                      <p className="text-sm text-gray-600">Mode: {leg.mode}</p>
                      <p className="text-sm text-gray-600">Distance: {leg.distance}</p>
                      <p className="text-sm text-red-600 font-medium">Emissions: {leg.emissions}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Earth Impact */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Impact on Earth</h3>
                <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center">
                  <svg className="w-24 h-24 mx-auto mb-4" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="#1e3a8a" />
                    <path
                      d="M30 50 C40 20, 60 20, 70 50 C60 80, 40 80, 30 50"
                      fill="#10b981"
                    />
                    <path
                      d="M50 30 C70 40, 70 60, 50 70 C30 60, 30 40, 50 30"
                      fill="#34d399"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="rgba(220, 38, 38, 0.4)"
                      strokeWidth="4"
                      animate={{ r: [45, 49, 45] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </svg>
                  <p className="text-base text-gray-700">
                    {carbonData.earthImpact}
                  </p>
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">Suggestions</h3>
                <ul className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2">
                  {carbonData.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <FaLeaf className="text-2xl text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No carbon data available</h3>
              <p className="text-gray-500 text-sm mb-6 max-w-sm">
                Run a route analysis first to see the carbon footprint breakdown.
              </p>
              <button
                onClick={() => navigate("/route-optimization")}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                Go to Route Optimization
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default CarbonFootprint;
