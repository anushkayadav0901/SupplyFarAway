import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/auth/Login";
import CreateAccount from "./pages/auth/CreateAccount";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/dashboard/Dashboard";
import ComplianceCheck from "./pages/compliance-check/ComplianceCheck";
import RouteOptimization from "./pages/route-optimization/RouteOptimization";
import RouteMap from "./pages/route-optimization/route";
import Profile from "./pages/profile/Profile";
import History from "./pages/profile/History";
import ManageAccount from "./pages/profile/ManageAccount";
import Analysis from "./pages/profile/Analysis";
import CarbonFootprint from "./pages/route-optimization/CarbonFootprint";
import ProductAnalysis from "./pages/compliance-check/ProductAnalysis";
import InventoryManagement from "./pages/inventory-management/InventoryManagement";
import Compliance from "./pages/compliance-check/Compliance";
import CsvUpload from "./pages/compliance-check/CsvUpload";
import ExportReport from "./pages/inventory-management/ExportReport";
import News from "./pages/news/News";
import DocumentationPage from "./pages/documentation/DocumentationPage";
import BoxCount from "./pages/box-count/BoxCount";
import ShipmentDiff from "./pages/shipment-diff/ShipmentDiff";
import LoadAggregation from "./pages/load-aggregation/LoadAggregation";
import LiveTracking from "./pages/live-tracking/LiveTracking";
import AnomalyDetection from "./pages/anomaly-detection/AnomalyDetection";
import RfidVerification from "./pages/rfid-verification/RfidVerification";
import WeightCheck from "./pages/weight-check/WeightCheck";
import FraudDashboard from "./pages/fraud-dashboard/FraudDashboard";
import TruckRegistry from "./pages/truck-registry/TruckRegistry";
import AuditLog from "./pages/audit-log/AuditLog";
import TrustCenter from "./pages/trust-center/TrustCenter";

// ─────────────────────────────────────────────────────────────
// ErrorBoundary — catches render-phase errors anywhere in the
// subtree and renders a graceful fallback (AlertTriangle + message
// + Reload). No stack trace is exposed to the user.
// ─────────────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log to console for developers; never expose to the UI.
    console.error("[ErrorBoundary] Uncaught render error:", error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
          <AlertTriangle
            size={48}
            className="text-amber-500"
            aria-hidden="true"
          />
          <p className="text-slate-700 text-lg font-semibold">
            Something went wrong. Please reload the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// Page transition config — 150 ms, respects reduced-motion via
// framer-motion's built-in reduced-motion support.
// ─────────────────────────────────────────────────────────────
const pageFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: "easeOut" },
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} {...pageFade}>
        <Routes location={location}>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/createAccount" element={<CreateAccount />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/compliance-check" element={<ComplianceCheck />} />
            <Route path="/route-optimization" element={<RouteOptimization />} />
            <Route path="/map/:draftId" element={<RouteMap />} />
            <Route path="/map" element={<RouteMap />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/history/:userId" element={<History />} />
            <Route path="/manage-account/:userId" element={<ManageAccount />} />
            <Route path="/analysis/:userId" element={<Analysis />} />
            <Route
              path="/carbon-footprint/:draftId"
              element={<CarbonFootprint />}
            />
            <Route path="/carbon-footprint" element={<CarbonFootprint />} />
            <Route path="/product-analysis" element={<ProductAnalysis />} />
            <Route
              path="/inventory-management"
              element={<InventoryManagement />}
            />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/csv-upload" element={<CsvUpload />} />
            <Route path="/export-report/:draftId" element={<ExportReport />} />
            <Route path="/news" element={<News />} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="/box-count" element={<BoxCount />} />
            <Route path="/shipment-diff" element={<ShipmentDiff />} />
            <Route path="/load-aggregation" element={<LoadAggregation />} />
            <Route path="/live-tracking" element={<LiveTracking />} />
            <Route path="/anomaly-detection" element={<AnomalyDetection />} />
            <Route path="/rfid-verification" element={<RfidVerification />} />
            <Route path="/weight-check" element={<WeightCheck />} />
            <Route path="/fraud-dashboard" element={<FraudDashboard />} />
            <Route path="/truck-registry" element={<TruckRegistry />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/trust-center" element={<TrustCenter />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export { ErrorBoundary };
export default App;
