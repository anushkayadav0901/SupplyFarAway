import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Route, ShieldCheck, BarChart3 } from "lucide-react";
import FeatureGroupGrid from "../../components/FeatureGroupGrid";
import CountUp from "../../components/CountUp";

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="relative">
      <GridBackdrop />
      <Hero navigate={navigate} />
      <MetricsBar />
      <section className="relative pb-24">
        <FeatureGroupGrid />
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

function GridBackdrop() {
  return (
    <div
      className="absolute inset-x-0 top-0 h-[90vh] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <svg className="w-full h-full text-tertiary-200/40">
        <defs>
          <pattern id="dashboard-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dashboard-grid)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-neutral-50" />
    </div>
  );
}

function Hero({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section className="relative max-w-4xl mx-auto px-6 pt-20 sm:pt-28 pb-16 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-200 bg-primary-50/70 text-primary-700 text-xs font-medium mb-10">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
        Powered by Gemini 2.5 on Vertex AI
      </div>

      <h1 className="font-bold tracking-tight text-tertiary-900 leading-[1.02]">
        <span className="block text-4xl sm:text-5xl md:text-6xl">End-to-end</span>
        <span className="block text-4xl sm:text-5xl md:text-6xl text-primary-600 mt-1">
          logistics intelligence
        </span>
      </h1>

      <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-tertiary-500 leading-relaxed">
        Route optimization, compliance checks, and shipment verification &mdash;
        every step visible, every decision explainable.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => navigate("/routes")}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm sm:text-base px-7 py-3 rounded-full inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          Plan a route
          <ArrowRight size={16} />
        </button>
        <button
          onClick={() => navigate("/compliance")}
          className="text-primary-700 hover:bg-primary-50 border-2 border-primary-200 hover:border-primary-300 font-semibold text-sm sm:text-base px-7 py-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          Try compliance check
        </button>
      </div>
    </section>
  );
}

function MetricsBar() {
  const stats = [
    { value: 2847, label: "Routes optimized", icon: Route },
    { value: 1523, label: "Shipments verified", icon: ShieldCheck },
    { value: 99.2, label: "Compliance rate", icon: BarChart3, decimals: 1, suffix: "%" },
  ];

  return (
    <div className="relative max-w-3xl mx-auto px-6 mb-16">
      <div className="grid grid-cols-3 divide-x divide-tertiary-200 border border-tertiary-200 rounded-2xl bg-white/90">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex flex-col items-center py-6 px-4 text-center">
              <Icon size={18} className="text-primary-500 mb-2" />
              <span className="text-2xl sm:text-3xl font-bold text-tertiary-900 tabular-nums">
                <CountUp value={stat.value} decimals={stat.decimals ?? 0} suffix={stat.suffix ?? ""} />
              </span>
              <span className="text-xs text-tertiary-500 mt-1">{stat.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Footer({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <footer className="relative border-t border-tertiary-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-[10px]">
            SF
          </span>
          <span className="font-bold text-tertiary-900 text-sm">SupplyFarAway</span>
        </div>
        <p className="text-xs text-tertiary-500">
          Route optimization, compliance, and verification for modern supply chains.
        </p>
        <div className="flex items-center gap-4 text-xs text-tertiary-500">
          <button onClick={() => navigate("/docs")} className="hover:text-tertiary-900">
            Docs
          </button>
          <button onClick={() => navigate("/news")} className="hover:text-tertiary-900">
            News
          </button>
          <a
            href="https://github.com/anushkayadav0901/SupplyFarAway"
            target="_blank"
            rel="noreferrer"
            className="hover:text-tertiary-900"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Dashboard;
