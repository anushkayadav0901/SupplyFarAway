import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Package, ShieldAlert, Truck, Boxes, ChevronRight } from "lucide-react";
import TrustGauge from "../../components/TrustGauge";
import HeroSkeleton from "../../components/skeletons/HeroSkeleton";
import CountUp from "../../components/CountUp";
import { trpc } from "../../lib/trpc";

interface TileProps {
  label: string;
  value: number;
  delta?: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: "blue" | "emerald" | "amber" | "red";
  onClick?: () => void;
}

const accentMap: Record<TileProps["accent"], { icon: string; bg: string; ring: string }> = {
  blue: {
    icon: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-100 hover:ring-blue-200",
  },
  emerald: {
    icon: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-100 hover:ring-emerald-200",
  },
  amber: {
    icon: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-100 hover:ring-amber-200",
  },
  red: {
    icon: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-100 hover:ring-red-200",
  },
};

const HeroTile: React.FC<TileProps> = ({ label, value, delta, Icon, accent, onClick }) => {
  const a = accentMap[accent];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`group text-left bg-white rounded-2xl border border-slate-200 ring-1 ring-transparent ${a.ring} p-4 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${a.bg} ${a.icon}`}
        >
          <Icon size={18} />
        </span>
        {onClick && (
          <ChevronRight
            size={14}
            className="text-slate-300 group-hover:text-slate-500 transition-colors"
          />
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
        {label}
      </div>
      <CountUp
        value={value}
        className="text-3xl font-bold tabular-nums text-slate-900 mt-0.5 leading-none block"
      />
      {delta && (
        <div className="text-[11px] text-slate-500 mt-1.5">{delta}</div>
      )}
    </motion.button>
  );
};

const DashboardHero: React.FC = () => {
  const navigate = useNavigate();

  const tickerQuery = trpc.insights.operationsTicker.useQuery(undefined, {
    // Pause polling while the tab is hidden — saves bandwidth & CPU.
    refetchInterval: () =>
      typeof document !== "undefined" && document.hidden ? false : 4000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  if (tickerQuery.isLoading && !tickerQuery.data) {
    return <HeroSkeleton />;
  }

  const t = tickerQuery.data;
  const trustScore = t?.avgTrustScore ?? 0;
  const trustDelta = t?.avgTrustScoreDelta ?? 0;
  const trustDeltaLabel =
    trustDelta === 0
      ? "no change · 24h"
      : trustDelta > 0
      ? `+${trustDelta} · 24h`
      : `${trustDelta} · 24h`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative bg-white  rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden"
    >
      {/* Removed: decorative blur element */}
      <div className="relative grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-center">
        <div className="flex flex-col items-center">
          <TrustGauge
            value={trustScore}
            label="Network Trust"
            subLabel="live · 4s refresh"
          />
          <button
            onClick={() => navigate("/trust-center")}
            className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Open Trust Center <ChevronRight size={12} />
          </button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                Operations overview
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                Today across the network
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Trust score is {trustScore}/100 ({trustDeltaLabel}).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HeroTile
              label="Active Shipments"
              value={t?.activeShipments ?? 0}
              Icon={Package}
              accent="blue"
              onClick={() => navigate("/inventory-management")}
            />
            <HeroTile
              label="Open Loads"
              value={t?.openLoads ?? 0}
              Icon={Boxes}
              accent="emerald"
              onClick={() => navigate("/load-aggregation")}
            />
            <HeroTile
              label="Registered Trucks"
              value={t?.registeredTrucks ?? 0}
              Icon={Truck}
              accent="blue"
              onClick={() => navigate("/truck-registry")}
            />
            <HeroTile
              label="High-risk · 24h"
              value={t?.highRiskEventsLast24h ?? 0}
              Icon={ShieldAlert}
              accent={(t?.highRiskEventsLast24h ?? 0) > 0 ? "red" : "amber"}
              onClick={() => navigate("/fraud-dashboard")}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default DashboardHero;
