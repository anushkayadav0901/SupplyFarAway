import React from "react";
import { motion } from "framer-motion";
import {
  FaRoute,
  FaCheckCircle,
  FaLightbulb,
  FaBox,
  FaLeaf,
} from "react-icons/fa";

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="relative py-20 sm:py-32 px-4 sm:px-6 z-10">
      {/* Top Separator */}
      <div className="absolute top-0 left-0 w-full h-px bg-gray-200/30"></div>
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-px bg-blue-400/60"></div>

      {/* Subtle Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="about-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="black" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#about-grid)" />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Column - Clean Structured Layout */}
          <div className="hidden lg:block relative w-full h-[500px]">
            <div className="absolute inset-0 bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col justify-center gap-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    icon: <FaCheckCircle className="text-emerald-600 text-xl" />,
                    title: "Compliance",
                    desc: "Automated verification against trade rules",
                    bg: "bg-emerald-50/50 border border-emerald-200/50",
                  },
                  {
                    icon: <FaRoute className="text-blue-600 text-xl" />,
                    title: "Route Optimization",
                    desc: "Efficient cost & carbon calculations",
                    bg: "bg-blue-50/50 border border-blue-200/50",
                  },
                  {
                    icon: <FaBox className="text-amber-600 text-xl" />,
                    title: "Inventory",
                    desc: "Real-time verification and manifest sync",
                    bg: "bg-amber-50/50 border border-amber-200/50",
                  },
                  {
                    icon: <FaLeaf className="text-emerald-600 text-xl" />,
                    title: "Sustainability",
                    desc: "Eco-friendly corridor analytics",
                    bg: "bg-emerald-50/50 border border-emerald-200/50",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl ${item.bg} flex flex-col gap-3 transition-colors duration-200`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200/60 shadow-sm">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-950 text-sm">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200/80 pt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                      <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
                      <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                    SupplyChain Platform
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* END LEFT COLUMN */}

          {/* Right Column - Content */}
          <div className="space-y-10 flex flex-col justify-center h-full">
            {/* Header */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="inline-block"
              >
                <span className="text-sm font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                  About Us
                </span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                viewport={{ once: true }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1]"
              >
                SupplyChain
              </motion.h2>
            </div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <p className="text-xl text-gray-700 leading-relaxed font-medium">
                A logistics platform for route optimization, compliance checks, and shipment verification.
              </p>
            </motion.div>

            {/* Key Features Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 ">
                Key Features
              </h3>

              <div className="grid sm:grid-cols-2 gap-6">
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 hover:shadow-md transition-shadow duration-200 border border-blue-100"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FaCheckCircle className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Compliance Check
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Automated validation to ensure adherence to industry
                      regulations and standards
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 hover:shadow-md transition-shadow duration-200 border border-emerald-100"
                >
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FaRoute className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Route Optimization
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Time, cost, and carbon-efficient path planning for smarter
                      deliveries
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 hover:shadow-md transition-shadow duration-200 border border-blue-100"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FaBox className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Inventory Management
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Centralized system to track and manage all inventory data
                      in real time
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 hover:shadow-md transition-shadow duration-200 border border-emerald-100"
                >
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FaLeaf className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Sustainability
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Corridor analytics for carbon-efficient routing
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom Separator */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gray-200/30"></div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-px bg-emerald-400/60"></div>

      {/* Removed: corner decorative elements — unnecessary ornamentation */}
    </section>
  );
};

export default AboutSection;
