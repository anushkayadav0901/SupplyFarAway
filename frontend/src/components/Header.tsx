import React from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Global, css } from "@emotion/react";
import Breadcrumb, { resolvePageTitle } from "./Breadcrumb";

interface HeaderProps {
  title?: string;
  page?: string;
}

const Header = ({ title, page = "dashboard" }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Smart title resolution: if caller passes empty string or omits the prop,
  // derive it from the URL. Otherwise honour whatever the page passed in.
  const resolvedTitle =
    title && title.trim().length > 0
      ? title
      : resolvePageTitle(location.pathname) || "Supply Chain";

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
      }}
      className="relative max-w-7xl mx-auto bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white py-8 sm:py-12 rounded-b-3xl overflow-hidden w-full shadow-xl"
    >
      {/* Animated SVG Background - Circuit Pattern */}
      <div className="absolute inset-0">
        <svg
          className="w-full h-full"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid Pattern */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="var(--color-neutral-50)"
                strokeWidth="0.5"
                strokeOpacity="0.1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Circuit Lines */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <path
              d="M100 50 L300 50 L300 100 L500 100 L500 150 L700 150"
              stroke="var(--color-neutral-50)"
              strokeWidth="2"
              strokeOpacity="0.1"
              fill="none"
            />
            <path
              d="M800 60 L1000 60 L1000 120 L1200 120"
              stroke="var(--color-primary-400)"
              strokeWidth="1.5"
              strokeOpacity="0.15"
              fill="none"
            />
            <path
              d="M200 140 L400 140 L400 80 L600 80 L600 40"
              stroke="var(--color-secondary-400)"
              strokeWidth="1"
              strokeOpacity="0.1"
              fill="none"
            />
          </motion.g>

          {/* Circuit Nodes */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.15 }}
          >
            <circle
              cx="300"
              cy="50"
              r="3"
              fill="var(--color-neutral-50)"
              fillOpacity="0.2"
            />
            <circle
              cx="500"
              cy="100"
              r="2"
              fill="var(--color-primary-400)"
              fillOpacity="0.3"
            />
            <circle
              cx="1000"
              cy="60"
              r="2.5"
              fill="var(--color-secondary-400)"
              fillOpacity="0.25"
            />
            <circle
              cx="400"
              cy="140"
              r="2"
              fill="var(--color-neutral-50)"
              fillOpacity="0.15"
            />
          </motion.g>
        </svg>
      </div>

      {/* Breadcrumb row */}
      <div className="relative px-4 sm:px-6 mb-3">
        <Breadcrumb currentLabel={title && title.trim().length > 0 ? title : undefined} />
      </div>

      {/* Main Content */}
      <div className="relative px-4 sm:px-6 flex items-center justify-between gap-3">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.2,
            delay: 0.05,
            ease: "easeOut",
          }}
          className="flex items-center space-x-1 sm:space-x-2"
        >
          {/* Logo Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.15,
              delay: 0.05,
              ease: "easeOut",
            }}
          >
          <Link
            to="/dashboard"
            aria-label="Go to dashboard"
            className="relative w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600 outline-none group"
          >
            {/* Logo Icon - Abstract S */}
            <div className="relative">
              <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform duration-200"
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
            </div>
          </Link>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: 0.08,
              ease: "easeOut",
            }}
            className="text-xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {resolvedTitle}
          </motion.h1>

          {/* Subtle accent line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            style={{ originX: 0 }}
            transition={{
              duration: 0.2,
              delay: 0.1,
              ease: "easeOut",
            }}
            className="hidden sm:block w-16 h-0.5 bg-gradient-to-r from-white/40 to-transparent ml-4 rounded-full"
          />
        </motion.div>

        {/* Right side - Status indicator and Buttons */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.2,
            delay: 0.1,
            ease: "easeOut",
          }}
          className="flex items-center space-x-2"
        >
          {/* Conditional Buttons Based on Page */}
          {page === "compliance-check" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/inventory-management")}
              className="border-none bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
            >
              Inventory
            </motion.button>
          )}
          {page === "export" && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/inventory-management")}
                className="border-none bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
              >
                Inventory
              </motion.button>
            </>
          )}
          {/* Quick nav links to key features */}
          <div className="hidden sm:flex items-center gap-2">
            {[
              { label: "Trust Center", path: "/trust-center" },
              { label: "Live Tracking", path: "/live-tracking" },
              { label: "Fraud", path: "/fraud-dashboard" },
            ].map((link) => (
              <motion.button
                key={link.path}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(link.path)}
                className="border-none bg-white/20 hover:bg-white/30 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
              >
                {link.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom accent border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-neutral-50)]/20 to-transparent" />

      {/* Global Button Active Style */}
      <Global
        styles={css`
          button:active {
            transform: translateY(4px);
            box-shadow: 0px 0px 0px 0px transparent;
          }
        `}
      />
    </motion.header>
  );
};

export default Header;
