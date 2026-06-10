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
} from "react-icons/fa";
import CloseIcon from "@mui/icons-material/Close";
import { useInView } from "react-intersection-observer";
import { useNavigate } from "react-router-dom";
import FeatureCarousel from "./FeatureCarousel";
import AppleStyleSideBackground from "./EnhancedBackground";
import AboutSection from "./AboutSection";
import Button from "./Button";
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

  // Primary CTA button
  const GradientButton: React.FC<GradientButtonProps> = ({ children, onClick }) => (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base sm:text-lg px-6 py-3 rounded-full flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-colors duration-150"
    >
      {children}
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

  const complianceCheck = (): void => {
    const token = localStorage.getItem("token");
    localStorage.clear();
    if (token) {
      localStorage.setItem("token", token);
    }
    navigate("/compliance");
  };

  const routeOptimization = (): void => {
    const token = localStorage.getItem("token");
    localStorage.clear();
    if (token) {
      localStorage.setItem("token", token);
    }
    navigate("/route-optimization");
  };

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
  ];

  return (
    <div className="bg-gray-50 text-gray-900 font-sans min-h-screen relative overflow-x-hidden">
      <AppleStyleSideBackground>
        {/* Navigation Bar with old code's colors */}
        <nav className="fixed top-0 left-4 right-4 mx-auto mt-6 max-w-6xl bg-white border border-gray-200 rounded-2xl shadow-sm z-50 flex justify-between items-center px-6 lg:px-8 py-4 transition-shadow duration-150 hover:shadow-md">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"
          >
            Smart
            <span className="bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              logix
            </span>
          </motion.h2>

          <div className="flex items-center">
            <div className="hidden md:flex items-center space-x-4">
              <motion.button
                onClick={handleDocsClick}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Docs
              </motion.button>
              <motion.button
                onClick={handleNewsClick}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                News
              </motion.button>
              <motion.a
                href="#about"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="text-gray-700 hover:text-blue-600 text-base font-medium px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                About
              </motion.a>
              <motion.div
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center"
              >
                <Button onClick={handleInventoryClick} />
              </motion.div>
              <motion.button
                onClick={handleProfileClick}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm px-5 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors duration-150 border border-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <FaUserCircle size={16} className="text-blue-600" />
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
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-gray-900"
              >
                Smart
                <span className="bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                  logix
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
                className="text-xl md:text-2xl max-w-2xl mx-auto lg:mx-0 mt-6 text-gray-600 leading-relaxed font-medium"
              >
                Innovating Logistics for the Future
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3, ease: "easeOut" }}
                className="mt-6 flex flex-col sm:flex-row justify-center lg:justify-start gap-6"
              >
                <GradientButton
                  onClick={complianceCheck}
                >
                  <FaCheckCircle className="text-lg" />
                  <span>Compliance Check</span>
                </GradientButton>
                <GradientButton
                  onClick={routeOptimization}
                >
                  <FaRoute className="text-lg" />
                  <span>Route Optimization</span>
                </GradientButton>
              </motion.div>
            </motion.div>

            <div className="hidden lg:flex w-full lg:w-1/2">
              <FeatureCarousel features={features} />
            </div>
          </div>
        </section>

        {/* About Section */}
        <AboutSection />

        {/* Problems We Solve Section from Old Code */}
        <section
          ref={solvesInView}
          className="py-12 sm:py-24 px-4 sm:px-6 relative z-10 bg-gray-50"
          id="solves"
        >
          <motion.h2
            initial={{ opacity: 0 }}
            animate={solvesVisible ? { opacity: 1 } : {}}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-gray-900 mb-12"
          >
            Problems We Solve
          </motion.h2>
          <div className="max-w-5xl mx-auto space-y-8">
            {[
              {
                problem: "Inefficient Route Selection",
                icon: <FaRoute className="text-gray-600" />,
                solve: "Route Optimization",
              },
              {
                problem: "Compliance Complexities",
                icon: <FaCheckCircle className="text-gray-600" />,
                solve: "Compliance Check",
              },
              {
                problem: "High Operational Costs",
                icon: <FaDollarSign className="text-gray-600" />,
                solve: "Cost Optimization",
              },
              {
                problem: "Transit Delays",
                icon: <FaClock className="text-gray-600" />,
                solve: "Transit Time Optimization",
              },
              {
                problem: "Environmental Impact",
                icon: <FaLeaf className="text-gray-600" />,
                solve: "Carbon Emission Checker",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                animate={solvesVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: index * 0.06, duration: 0.3, ease: "easeOut" }}
                className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-150"
              >
                {/* Problem Side */}
                <div className="flex-1 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Problem
                    </h3>
                    <p className="text-gray-600">{item.problem}</p>
                  </div>
                </div>
                {/* Arrow */}
                <svg
                  className="w-8 h-8 text-gray-400 hidden sm:block"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {/* Solution Side */}
                <div className="flex-1 flex items-center gap-4 sm:justify-end">
                  <div className="text-right">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Solution
                    </h3>
                    <p className="text-gray-600">{item.solve}</p>
                  </div>
                  <div
                    className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center"
                  >
                    <FaCheckCircle className="text-emerald-500" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer with old code's colors */}
        <footer className="py-6 px-4 text-center relative z-10 bg-gray-50 border-t border-gray-200/50">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-gray-900 text-sm font-medium"
          >
            © {new Date().getFullYear()} SupplyChain. All rights reserved.
          </motion.p>
        </footer>
      </AppleStyleSideBackground>
    </div>
  );
}

export default MovexDashboard;
