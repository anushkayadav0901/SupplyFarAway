import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaRoute,
  FaCheckCircle,
  FaBox,
  FaFileCsv,
  FaChartBar,
  FaMapMarkedAlt,
  FaLeaf,
  FaFileExport,
  FaUserCircle,
  FaBars,
  FaDollarSign,
  FaClock,
  FaCamera,
  FaExchangeAlt,
  FaTruck,
  FaLocationArrow,
  FaBrain,
  FaTag,
  FaWeight,
  FaShieldAlt,
  FaListAlt,
} from "react-icons/fa";
import CloseIcon from "@mui/icons-material/Close";
import { useInView } from "react-intersection-observer";
import { useNavigate } from "react-router-dom";
import FeatureCarousel from "./FeatureCarousel";
import AppleStyleSideBackground from "./EnhancedBackground";
import AboutSection from "./AboutSection";
// LiveStatsSection is preserved but no longer rendered here — the
// DashboardHero now surfaces the same metrics with live tRPC data.
import Button from "./Button";
import DashboardHero from "./DashboardHero";
import OperationsTicker from "../../components/OperationsTicker";
import FeatureGroupGrid from "../../components/FeatureGroupGrid";
import { trpc } from "../../lib/trpc";

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  bgAccent: string;
  borderColor: string;
}

interface CtaButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

function MovexDashboard() {
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [solvesInView, solvesVisible] = useInView({ threshold: 0.2 });

  const navigate = useNavigate();

  // Fetch user data via tRPC
  const { data: meData, isError } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
    enabled: !!localStorage.getItem("token"),
  });

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
      return;
    }
    if (isError) {
      navigate("/");
    }
  }, [navigate, isError]);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSidebar) {
        setShowSidebar(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSidebar]);

  // Primary CTA button
  const CtaButton: React.FC<CtaButtonProps> = ({ children, onClick }) => (
    <button
      onClick={onClick}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base sm:text-lg px-8 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm transition-colors duration-200"
    >
      <span className="flex items-center gap-3">{children}</span>
    </button>
  );

  const handleProfileClick = (): void => {
    const userId = meData?.user?.id;
    if (userId) {
      navigate(`/profile/${userId}`);
    } else {
      navigate("/");
    }
  };

  const handleInventoryClick = (): void => {
    navigate("/inventory-management");
  };

  const handleNewsClick = (): void => {
    navigate("/news");
  };

  const handleDocsClick = (): void => {
    navigate("/docs");
  };

  // Bug fix: previously these handlers called localStorage.clear(), which
  // also wiped the theme preference and any other persisted UI state. The
  // tRPC mutations that own per-feature state are responsible for clearing
  // their own caches — navigation alone is the correct contract here.
  const complianceCheck = (): void => {
    navigate("/compliance");
  };

  const routeOptimization = (): void => {
    navigate("/routes");
  };

  const newFeatures = [
    { route: "/inspect", title: "Physical Inspection", desc: "Unified camera count, scale weight, and RFID verification.", icon: <FaCamera className="text-blue-600" size={22} /> },
    { route: "/risk", title: "Risk & Trust Center", desc: "Aggregated shipment risk scores, anomaly scans, and audit logs.", icon: <FaShieldAlt className="text-blue-600" size={22} /> },
    { route: "/routes", title: "Route Planning", desc: "Optimize paths for cost/carbon and track active pings.", icon: <FaLocationArrow className="text-blue-600" size={22} /> },
    { route: "/fleet", title: "Fleet & Corridors", desc: "Registry of trucks and load matching corridors.", icon: <FaTruck className="text-blue-600" size={22} /> },
    { route: "/compliance", title: "Compliance Check", desc: "AI HS-Code extraction, CSV intake, and form screening.", icon: <FaCheckCircle className="text-blue-600" size={22} /> },
    { route: "/inventory", title: "Shipment Inventory", desc: "Active manifests list and export actions.", icon: <FaBox className="text-blue-600" size={22} /> },
  ];

  const features: Feature[] = [
    {
      id: 1,
      title: "Route Optimization",
      description:
        "Streamline cargo routes, cut costs, and improve delivery speed.",
      icon: <FaRoute className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 2,
      title: "Compliance Check",
      description:
        "Automated checks that verify compliance with regulations.",
      icon: <FaCheckCircle className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 3,
      title: "Inventory Management",
      description:
        "Track and manage cargo inventory with real-time visibility.",
      icon: <FaBox className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 4,
      title: "Compliance Using CSV",
      description:
        "Upload CSV files to simplify compliance checks.",
      icon: <FaFileCsv className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 5,
      title: "Product Analysis",
      description:
        "Analyze product shipment data to identify trends and optimize logistics.",
      icon: <FaChartBar className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 6,
      title: "Map View",
      description:
        "Visualize shipping routes on an interactive map for better planning.",
      icon: <FaMapMarkedAlt className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 7,
      title: "Detailed Carbon Analysis",
      description:
        "Measure carbon footprint of shipments with detailed emissions insights.",
      icon: <FaLeaf className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 8,
      title: "Export Report",
      description:
        "Generate and export reports on routes, compliance, and emissions.",
      icon: <FaFileExport className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 9,
      title: "Box Count Verification",
      description:
        "Compare detected box count against the declared manifest from a photo.",
      icon: <FaCamera className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 10,
      title: "Damage & Tampering Diff",
      description:
        "Compare loading and delivery photos to estimate missing items and damage.",
      icon: <FaExchangeAlt className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 11,
      title: "Small Truck Load Aggregation",
      description:
        "Match small truck loads sharing route corridors.",
      icon: <FaTruck className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 12,
      title: "Live Tracking & ETA",
      description:
        "Geolocation pings from drivers with ETA calculations.",
      icon: <FaLocationArrow className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 13,
      title: "AI Anomaly Detection",
      description:
        "Flag suspicious patterns in shipment weight, count, and route data.",
      icon: <FaBrain className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 14,
      title: "RFID/NFC Verification",
      description:
        "Reconcile manifest and scanned tag lists for matched and missing tags.",
      icon: <FaTag className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 15,
      title: "Load Sensor Weight Check",
      description:
        "Compare load-sensor weight against declared shipment weight.",
      icon: <FaWeight className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 16,
      title: "Fraud & Risk Dashboard",
      description:
        "Aggregated risk metrics across all verification events.",
      icon: <FaShieldAlt className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 17,
      title: "Truck Registry",
      description:
        "Register truck plate, capacity, and base city for load matching.",
      icon: <FaTruck className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 18,
      title: "Verification Audit Log",
      description:
        "Append-only log of all verification events on a shipment.",
      icon: <FaListAlt className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
  ];

  return (
    <div className="bg-gray-50 text-gray-900 font-sans min-h-screen relative overflow-x-hidden">
      <AppleStyleSideBackground>
        {/* Navigation Bar - Modern Design */}
        <nav className="fixed top-0 left-4 right-4 mx-auto mt-6 max-w-6xl bg-white border border-gray-200 rounded-3xl shadow-sm z-50 flex justify-between items-center px-6 lg:px-8 py-4 transition-all duration-300">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"
          >
            SupplyChain
          </motion.h2>

          <div className="flex items-center">
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={handleDocsClick}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-5 py-2.5 rounded-xl hover:bg-blue-50/80 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Docs
              </button>
              <button
                onClick={handleNewsClick}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-5 py-2.5 rounded-xl hover:bg-blue-50/80 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                News
              </button>
              <a
                href="#about"
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-5 py-2.5 rounded-xl hover:bg-blue-50/80 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                About
              </a>
              <div className="flex items-center">
                <Button onClick={handleInventoryClick} />
              </div>
              <button
                onClick={handleProfileClick}
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2.5 transition-colors duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <FaUserCircle size={16} />
                Profile
              </button>
            </div>

            <motion.button
              onClick={() => setShowSidebar(!showSidebar)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Open navigation menu"
              aria-expanded={showSidebar}
              className="md:hidden w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-150 border border-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <FaBars size={18} className="text-gray-700" />
            </motion.button>
          </div>
        </nav>

        {/* Mobile Sidebar with old code's colors */}
        <AnimatePresence>
          {showSidebar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed inset-0 bg-black/20 z-40 md:hidden"
                onClick={() => setShowSidebar(false)}
                aria-hidden="true"
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                className="fixed top-6 left-4 h-[calc(100vh-3rem)] w-[85vw] max-w-xs sm:w-80 bg-white border border-gray-200 rounded-2xl z-50 p-8 md:hidden shadow-lg"
                onKeyDown={(e) => { if (e.key === "Escape") setShowSidebar(false); }}
              >
                <div className="flex justify-between items-center mb-10">
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.2 }}
                    className="text-xl font-bold text-gray-900"
                  >
                    Menu
                  </motion.h2>
                  <motion.button
                    onClick={() => setShowSidebar(false)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close navigation menu"
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-150 border border-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <CloseIcon sx={{ fontSize: 20 }} className="text-gray-900" />
                  </motion.button>
                </div>
                <div className="space-y-3">
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06, duration: 0.2 }}
                    whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.1, ease: "easeOut" } }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left text-base py-4 px-5 text-gray-900 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors duration-150 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={handleDocsClick}
                  >
                    Docs
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.09, duration: 0.2 }}
                    whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.1, ease: "easeOut" } }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left text-base py-4 px-5 text-gray-900 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors duration-150 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={handleNewsClick}
                  >
                    News
                  </motion.button>
                  <motion.a
                    href="#about"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12, duration: 0.2 }}
                    whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.1, ease: "easeOut" } }}
                    whileTap={{ scale: 0.98 }}
                    className="block text-base py-4 px-5 text-gray-900 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors duration-150 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={() => setShowSidebar(false)}
                  >
                    About
                  </motion.a>
                  <motion.button
                    onClick={() => {
                      handleInventoryClick();
                      setShowSidebar(false);
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.2 }}
                    whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.1, ease: "easeOut" } }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left text-base py-4 px-5 text-gray-900 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors duration-150 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    Inventory
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      handleProfileClick();
                      setShowSidebar(false);
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18, duration: 0.2 }}
                    whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.1, ease: "easeOut" } }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-4 text-base py-4 px-5 text-gray-900 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors duration-150 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <FaUserCircle size={18} className="text-gray-600" />
                    <span>Profile</span>
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Header Section with Lottie Animation */}
        <section className="relative min-h-screen flex items-center z-10 pt-28 pb-16 px-4 sm:px-8 md:px-12">
          <div className="container mx-auto max-w-7xl relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full lg:w-1/2 text-center lg:text-left"
            >
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08, ease: "easeOut" }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-gray-900 leading-tight"
              >
                SupplyChain
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
                className="text-xl md:text-2xl max-w-2xl mx-auto lg:mx-0 mt-6 text-gray-600 leading-relaxed font-normal"
              >
                Route optimization, compliance checks, and shipment verification — all in one place.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3, ease: "easeOut" }}
                className="mt-10 flex flex-col sm:flex-row justify-center lg:justify-start gap-4"
              >
                <CtaButton
                  onClick={complianceCheck}
                >
                  <FaCheckCircle className="text-xl" />
                  <span>Compliance Check</span>
                </CtaButton>
                <motion.button
                  onClick={routeOptimization}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 hover:border-blue-600 font-semibold text-base sm:text-lg px-8 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:shadow-lg transition-all duration-200"
                >
                  <FaRoute className="text-xl text-blue-600" />
                  <span>Route Optimization</span>
                </motion.button>
              </motion.div>
            </motion.div>

            <div className="hidden lg:flex w-full lg:w-1/2">
              <FeatureCarousel features={features} />
            </div>
          </div>
        </section>

        {/* Live Network Hero — trust gauge, operations tiles, ticker */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 relative z-10" id="network">
          <div className="max-w-7xl mx-auto space-y-6">
            <DashboardHero />
            <OperationsTicker />
          </div>
        </section>

        {/* Grouped Feature Navigation */}
        <section className="py-10 sm:py-14 px-0 relative z-10" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center mb-6">
            <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider ring-1 ring-blue-100">
              Feature Suite
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3">
              Built for verifiable logistics
            </h2>
            <p className="text-base text-gray-600 mt-2 max-w-2xl mx-auto">
              Verification, intelligence and operations grouped by what you're trying
              to do.
            </p>
          </div>
          <FeatureGroupGrid />
        </section>

        {/* About Section (retained) */}
        <AboutSection />

        {/* LiveStatsSection retained in repo, hidden from dashboard render — the
            hero tiles above expose the same metrics with live tRPC data. */}

        {/* Problems We Solve Section */}
        <section
          ref={solvesInView}
          className="py-16 sm:py-28 px-4 sm:px-6 relative z-10 bg-gray-50"
          id="solves"
        >
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
              What the platform addresses
            </h2>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
              Common logistics challenges and how the platform handles them.
            </p>
          </div>
          <div className="max-w-5xl mx-auto space-y-6">
            {[
              {
                problem: "Inefficient Route Selection",
                icon: <FaRoute className="text-blue-600" />,
                solve: "Route Optimization",
                color: "blue",
              },
              {
                problem: "Compliance Complexities",
                icon: <FaCheckCircle className="text-blue-600" />,
                solve: "Automated Compliance Check",
                color: "blue",
              },
              {
                problem: "High Operational Costs",
                icon: <FaDollarSign className="text-blue-600" />,
                solve: "Cost Optimization",
                color: "blue",
              },
              {
                problem: "Transit Delays",
                icon: <FaClock className="text-blue-600" />,
                solve: "Transit Optimization",
                color: "blue",
              },
              {
                problem: "Environmental Impact",
                icon: <FaLeaf className="text-blue-600" />,
                solve: "Carbon Tracking",
                color: "blue",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex-1 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shadow-sm">
                      <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Problem
                      </h3>
                      <p className="text-xl font-bold text-gray-900">{item.problem}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <svg
                      className="w-10 h-10 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M13 7l5 5-5 5M6 12h12"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center gap-5 sm:justify-end">
                    <div className="text-right">
                      <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-1">
                        Solution
                      </h3>
                      <p className="text-xl font-bold text-gray-900">{item.solve}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shadow-sm">
                      <FaCheckCircle className="text-blue-600 text-2xl" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer - Enhanced Design */}
        <footer className="py-12 px-4 text-center relative z-10 bg-gray-50 border-t border-gray-200/50">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                  >
                    <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
                    <path
                      d="M8 12l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  SupplyChain
                </h3>
              </div>
              
              {/* Tagline */}
              <p className="text-gray-600 text-base max-w-md">
                Route optimization, compliance, and verification for modern supply chains.
              </p>
              
              {/* Links */}
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <button onClick={handleDocsClick} className="text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                  Documentation
                </button>
                <button onClick={handleNewsClick} className="text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                  News
                </button>
                <a href="#about" className="text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                  About
                </a>
                <button onClick={handleInventoryClick} className="text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                  Inventory
                </button>
              </div>
              
              {/* Divider */}
              <div className="w-full max-w-md h-px bg-gray-300/30" />
              
              {/* Copyright */}
              <p className="text-gray-500 text-sm font-medium">
                © {new Date().getFullYear()} Supply Chain. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </AppleStyleSideBackground>
    </div>
  );
}

export default MovexDashboard;
