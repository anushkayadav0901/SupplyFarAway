import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Truck, Boxes } from "lucide-react";
import { trpc } from "../../lib/trpc";
import FeatureGroupGrid from "../../components/FeatureGroupGrid";

function Dashboard() {
  const navigate = useNavigate();
  const { isError } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
    enabled: !!localStorage.getItem("token"),
  });

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
    else if (isError) navigate("/");
  }, [navigate, isError]);

  return (
    <div className="relative">
      <GridBackdrop />
      <Hero navigate={navigate} />

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
      className="absolute inset-x-0 top-0 h-[80vh] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <svg className="w-full h-full text-slate-300/40">
        <defs>
          <pattern id="grid-bg" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-bg)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-b from-transparent to-slate-50" />
    </div>
  );
}

function Hero({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-24 pb-12 text-center">
      <h1 className="font-bold tracking-tight text-slate-900 leading-[1.02]">
        <span className="block text-5xl sm:text-6xl md:text-7xl">End-to-end</span>
        <span className="relative inline-flex items-center justify-center gap-3 sm:gap-5 my-1 sm:my-2">
          <DecorIcon className="hidden sm:inline-flex">
            <Truck size={22} />
          </DecorIcon>
          <span
            className="text-5xl sm:text-6xl md:text-7xl text-transparent"
            style={{ WebkitTextStroke: "1.5px rgb(37, 99, 235)" }}
          >
            logistics
          </span>
          <DecorIcon className="hidden sm:inline-flex">
            <Boxes size={22} />
          </DecorIcon>
        </span>
        <span className="block text-5xl sm:text-6xl md:text-7xl text-blue-600">
          intelligence
        </span>
      </h1>

      <p className="mt-8 max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
        Plan a route, verify a shipment, screen for compliance — every step visible,
        every decision explainable.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => navigate("/routes")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base px-7 py-3 rounded-full inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Plan a route
          <ArrowRight size={16} />
        </button>
        <button
          onClick={() => navigate("/inspect")}
          className="text-blue-700 hover:bg-blue-50 border-2 border-blue-200 hover:border-blue-300 font-semibold text-sm sm:text-base px-7 py-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Inspect a shipment
        </button>
      </div>
    </section>
  );
}

function DecorIcon({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-blue-200 bg-white text-blue-500 items-center justify-center ${className}`}
    >
      <span className="flex w-full h-full items-center justify-center">{children}</span>
    </span>
  );
}

function Footer({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <footer className="relative border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-[10px]">
            SF
          </span>
          <span className="font-bold text-slate-900 text-sm">SupplyFarAway</span>
        </div>
        <p className="text-xs text-slate-500">
          Route optimization, compliance, and verification for modern supply chains.
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <button onClick={() => navigate("/docs")} className="hover:text-slate-900">
            Docs
          </button>
          <button onClick={() => navigate("/news")} className="hover:text-slate-900">
            News
          </button>
          <a
            href="https://github.com/anushkayadav0901/SupplyFarAway"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Dashboard;
