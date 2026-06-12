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
import { useTheme } from "../../context/ThemeContext";
import ThemeToggle from "../../components/ThemeToggle";
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

interface GradientButtonProps {
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

  // Primary CTA button with gradient
  const GradientButton: React.FC<GradientButtonProps> = ({ children, onClick }) => (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="relative bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base sm:text-lg px-8 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden group"
    >
      <span className="relative z-10 flex items-center gap-3">{children}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.button>
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
    navigate("/route-optimization");
  };

  const newFeatures = [
    { route: "/box-count", title: "Box Count Verification", desc: "Upload a shipment photo and compare the AI-detected box count against the declared manifest count.", icon: <FaCamera className="text-blue-600" size={22} /> },
    { route: "/shipment-diff", title: "Damage & Tampering Diff", desc: "Upload loading and delivery photos. AI estimates missing items, visible damage, and tampering probability.", icon: <FaExchangeAlt className="text-emerald-600" size={22} /> },
    { route: "/load-aggregation", title: "Small Truck Load Aggregation", desc: "Post loads with origin, destination, weight, and pickup date. Algorithm matches loads sharing route corridors.", icon: <FaTruck className="text-blue-600" size={22} /> },
    { route: "/live-tracking", title: "Live Tracking & ETA", desc: "Driver posts geolocation pings. System computes ETA to destination using straight-line distance.", icon: <FaLocationArrow className="text-emerald-600" size={22} /> },
    { route: "/anomaly-detection", title: "AI Anomaly Detection", desc: "Runs a Gemini analysis on shipment metadata to flag suspicious patterns in weight, count, and route.", icon: <FaBrain className="text-blue-600" size={22} /> },
    { route: "/rfid-verification", title: "RFID/NFC Verification", desc: "Submit manifest and scanned tag lists. System returns matched, missing, and extra tags.", icon: <FaTag className="text-emerald-600" size={22} /> },
    { route: "/weight-check", title: "Load Sensor Weight Check", desc: "Compare measured load-sensor weight against declared shipment weight. Flags deviations beyond threshold.", icon: <FaWeight className="text-blue-600" size={22} /> },
    { route: "/fraud-dashboard", title: "Fraud & Risk Dashboard", desc: "Aggregated risk metrics across all verification events for the current user.", icon: <FaShieldAlt className="text-emerald-600" size={22} /> },
    { route: "/truck-registry", title: "Truck Registry", desc: "Small-truck owners register their truck (plate, capacity, base city). Powers the load aggregation matcher.", icon: <FaTruck className="text-blue-600" size={22} /> },
    { route: "/audit-log", title: "Verification Audit Log", desc: "Append-only log of all verification events on a shipment — box count, RFID scan, weight check, anomaly.", icon: <FaListAlt className="text-emerald-600" size={22} /> },
  ];

  const features: Feature[] = [
    {
      id: 1,
      title: "Route Optimization",
      description:
        "Leverage AI-powered insights to streamline cargo routes, cut costs, and boost delivery speed with intelligent planning.",
      icon: <FaRoute className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 2,
      title: "Compliance Check",
      description:
        "Stay ahead of regulations with automated checks that ensure seamless, compliant logistics operations.",
      icon: <FaCheckCircle className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 3,
      title: "Inventory Management",
      description:
        "Efficiently track and manage your cargo inventory in real-time, ensuring optimal stock levels and minimizing delays.",
      icon: <FaBox className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 4,
      title: "Compliance Using CSV",
      description:
        "Upload CSV files to automate and simplify compliance checks, ensuring all shipments meet regulatory standards effortlessly.",
      icon: <FaFileCsv className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 5,
      title: "Product Analysis",
      description:
        "Analyze product shipment data to identify trends, optimize logistics, and improve decision-making with actionable insights.",
      icon: <FaChartBar className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 6,
      title: "Map View",
      description:
        "Visualize your shipping routes on an interactive map, tracking progress and optimizing paths across land, sea, and air.",
      icon: <FaMapMarkedAlt className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 7,
      title: "Detailed Carbon Analysis",
      description:
        "Measure and analyze the carbon footprint of your shipments, enabling sustainable logistics with detailed emissions insights.",
      icon: <FaLeaf className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 8,
      title: "Export Report",
      description:
        "Generate and export comprehensive reports on routes, compliance, and emissions for easy sharing and record-keeping.",
      icon: <FaFileExport className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 9,
      title: "Box Count Verification",
      description:
        "Upload a shipment photo and compare the AI-detected box count against the declared manifest count.",
      icon: <FaCamera className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 10,
      title: "Damage & Tampering Diff",
      description:
        "Upload loading and delivery photos. AI estimates missing items, visible damage, and tampering probability with a risk score.",
      icon: <FaExchangeAlt className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 11,
      title: "Small Truck Load Aggregation",
      description:
        "Post loads with origin, destination, weight, and pickup date. Algorithm matches loads sharing route corridors.",
      icon: <FaTruck className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 12,
      title: "Live Tracking & ETA",
      description:
        "Driver posts geolocation pings. System computes ETA to destination using straight-line distance.",
      icon: <FaLocationArrow className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 13,
      title: "AI Anomaly Detection",
      description:
        "Runs a Gemini analysis on shipment metadata to flag suspicious patterns in weight, count, and route.",
      icon: <FaBrain className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 14,
      title: "RFID/NFC Verification",
      description:
        "Submit manifest and scanned tag lists. System returns matched, missing, and extra tags.",
      icon: <FaTag className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 15,
      title: "Load Sensor Weight Check",
      description:
        "Compare measured load-sensor weight against declared shipment weight. Flags deviations beyond threshold.",
      icon: <FaWeight className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 16,
      title: "Fraud & Risk Dashboard",
      description:
        "Aggregated risk metrics across all verification events for the current user.",
      icon: <FaShieldAlt className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 17,
      title: "Truck Registry",
      description:
        "Small-truck owners register their truck (plate, capacity, base city). Powers the load aggregation matcher.",
      icon: <FaTruck className="text-blue-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
    {
      id: 18,
      title: "Verification Audit Log",
      description:
        "Append-only log of all verification events on a shipment — box count, RFID scan, weight check, anomaly.",
      icon: <FaListAlt className="text-emerald-600" size={24} />,
      bgAccent: "",
      borderColor: "",
    },
  ];

  return (
    <div className="bg-gray-50 text-gray-900 font-sans min-h-screen relative overflow-x-hidden">
      <AppleStyleSideBackground>
        {/* Navigation Bar - Modern Design */}
        <nav className="fixed top-0 left-4 right-4 mx-auto mt-6 max-w-6xl bg-white/80 backdrop-blur-lg border border-gray-200/50 rounded-3xl shadow-lg z-50 flex justify-between items-center px-6 lg:px-8 py-4 transition-all duration-300 hover:shadow-xl">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"
          >
            Smart
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
              logix
            </span>
          </motion.h2>

          <div className="flex items-center">
            <div className="hidden md:flex items-center space-x-4">
              <motion.button
                onClick={handleDocsClick}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-5 py-2.5 rounded-xl hover:bg-blue-50/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Docs
              </motion.button>
              <motion.button
                onClick={handleNewsClick}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-5 py-2.5 rounded-xl hover:bg-blue-50/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                News
              </motion.button>
              <motion.a
                href="#about"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-5 py-2.5 rounded-xl hover:bg-blue-50/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                About
              </motion.a>
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center"
              >
                <Button onClick={handleInventoryClick} />
              </motion.div>
              <motion.button
                onClick={handleProfileClick}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2.5 transition-all duration-200 shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <FaUserCircle size={16} />
                Profile
              </motion.button>
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
                Smart
                <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
                  logix
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
                className="text-xl md:text-2xl max-w-2xl mx-auto lg:mx-0 mt-6 text-gray-600 leading-relaxed font-normal"
              >
                Revolutionizing logistics with AI-powered route optimization and real-time tracking
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3, ease: "easeOut" }}
                className="mt-10 flex flex-col sm:flex-row justify-center lg:justify-start gap-4"
              >
                <GradientButton
                  onClick={complianceCheck}
                >
                  <FaCheckCircle className="text-xl" />
                  <span>Compliance Check</span>
                </GradientButton>
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

        {/* Problems We Solve Section - Enhanced Design */}
        <section
          ref={solvesInView}
          className="py-16 sm:py-28 px-4 sm:px-6 relative z-10 bg-gradient-to-b from-gray-50 to-white"
          id="solves"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={solvesVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
              Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
              Problems We Solve
            </h2>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
              Transforming logistics challenges into opportunities
            </p>
          </motion.div>
          <div className="max-w-5xl mx-auto space-y-6">
            {[
              {
                problem: "Inefficient Route Selection",
                icon: <FaRoute className="text-blue-600" />,
                solve: "AI-Powered Route Optimization",
                color: "blue",
              },
              {
                problem: "Compliance Complexities",
                icon: <FaCheckCircle className="text-emerald-600" />,
                solve: "Automated Compliance Check",
                color: "emerald",
              },
              {
                problem: "High Operational Costs",
                icon: <FaDollarSign className="text-purple-600" />,
                solve: "Cost Optimization Engine",
                color: "purple",
              },
              {
                problem: "Transit Delays",
                icon: <FaClock className="text-amber-600" />,
                solve: "Real-Time Transit Optimization",
                color: "amber",
              },
              {
                problem: "Environmental Impact",
                icon: <FaLeaf className="text-green-600" />,
                solve: "Carbon Emission Tracking",
                color: "green",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                animate={solvesVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                className="group relative bg-white rounded-2xl p-6 sm:p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                
                <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Problem Side */}
                  <div className="flex-1 flex items-center gap-5">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}
                    >
                      <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Problem
                      </h3>
                      <p className="text-xl font-bold text-gray-900">{item.problem}</p>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0">
                    <svg
                      className="w-10 h-10 text-blue-600 group-hover:translate-x-2 transition-transform duration-300"
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
                  
                  {/* Solution Side */}
                  <div className="flex-1 flex items-center gap-5 sm:justify-end">
                    <div className="text-right">
                      <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                        Solution
                      </h3>
                      <p className="text-xl font-bold text-gray-900">{item.solve}</p>
                    </div>
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${item.color}-100 to-${item.color}-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}
                    >
                      <FaCheckCircle className={`text-${item.color}-600 text-2xl`} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer - Enhanced Design */}
        <footer className="py-12 px-4 text-center relative z-10 bg-gradient-to-br from-gray-50 to-gray-100 border-t border-gray-200/50">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="flex flex-col items-center gap-6"
            >
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
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
                  Smart<span className="bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">logix</span>
                </h3>
              </div>
              
              {/* Tagline */}
              <p className="text-gray-600 text-base max-w-md">
                Revolutionizing logistics with AI-powered solutions for a smarter, sustainable future
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
              <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
              
              {/* Copyright */}
              <p className="text-gray-500 text-sm font-medium">
                © {new Date().getFullYear()} Supply Chain. All rights reserved.
              </p>
            </motion.div>
          </div>
        </footer>
      </AppleStyleSideBackground>
    </div>
  );
}

export default MovexDashboard;
