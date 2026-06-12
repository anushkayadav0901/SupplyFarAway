import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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

          {/* Protected Routes (Wrap in ProtectedRoute layout) */}
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
    <ThemeProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
