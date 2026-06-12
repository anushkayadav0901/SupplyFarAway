import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Diff,
  Tag,
  Weight,
  Radar,
  ShieldAlert,
  ScrollText,
  Truck,
  Boxes,
  Navigation,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

interface FeatureLink {
  path: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface FeatureGroup {
  id: string;
  label: string;
  accent: "blue" | "emerald" | "violet";
  description: string;
  items: FeatureLink[];
}

const GROUPS: FeatureGroup[] = [
  {
    id: "verification",
    label: "Verification",
    accent: "blue",
    description: "Sensor-grounded checks that prove what's on the truck.",
    items: [
      {
        path: "/box-count",
        title: "Box Count",
        desc: "Vision-led count against the declared manifest.",
        Icon: Camera,
      },
      {
        path: "/shipment-diff",
        title: "Shipment Diff",
        desc: "Loading vs delivery imagery with tamper score.",
        Icon: Diff,
      },
      {
        path: "/rfid-verification",
        title: "RFID / NFC",
        desc: "Tag reconciliation across manifest and scan.",
        Icon: Tag,
      },
      {
        path: "/weight-check",
        title: "Weight Check",
        desc: "Load-cell readings against declared weight.",
        Icon: Weight,
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    accent: "violet",
    description: "Risk signals, fraud heuristics, and a tamper-evident trail.",
    items: [
      {
        path: "/anomaly-detection",
        title: "Anomaly Detection",
        desc: "Multivariate scan over weight, count, route.",
        Icon: Radar,
      },
      {
        path: "/fraud-dashboard",
        title: "Fraud & Risk",
        desc: "Aggregated risk across every event source.",
        Icon: ShieldAlert,
      },
      {
        path: "/audit-log",
        title: "Audit Log",
        desc: "Append-only verification chain per shipment.",
        Icon: ScrollText,
      },
      {
        path: "/trust-center",
        title: "Trust Center",
        desc: "Unified per-shipment subsystem health view.",
        Icon: ShieldCheck,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    accent: "emerald",
    description: "Ground operations: pooling, registry, and live position.",
    items: [
      {
        path: "/load-aggregation",
        title: "Load Match",
        desc: "Corridor matcher for small-truck loads.",
        Icon: Boxes,
      },
      {
        path: "/truck-registry",
        title: "Truck Registry",
        desc: "Capacity and base-city directory of fleet.",
        Icon: Truck,
      },
      {
        path: "/live-tracking",
        title: "Live Tracking",
        desc: "Geo pings with ETA against destination.",
        Icon: Navigation,
      },
      {
        path: "/route-optimization",
        title: "Route Optimization",
        desc: "AI-led corridor planning with cost lens.",
        Icon: Navigation,
      },
    ],
  },
];

const accentClasses: Record<
  FeatureGroup["accent"],
  { chip: string; iconBg: string; iconText: string; ring: string; barFrom: string }
> = {
  blue: {
    chip: "bg-blue-50 text-blue-700 ring-blue-100",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    ring: "hover:ring-blue-200",
    barFrom: "from-blue-500 to-blue-300",
  },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    ring: "hover:ring-emerald-200",
    barFrom: "from-emerald-500 to-emerald-300",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700 ring-violet-100",
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    ring: "hover:ring-violet-200",
    barFrom: "from-violet-500 to-violet-300",
  },
};

const FeatureGroupGrid: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section
      className="relative max-w-7xl mx-auto px-4 sm:px-6 mt-10 space-y-10"
      aria-label="Feature groups"
    >
      {GROUPS.map((group) => {
        const acc = accentClasses[group.accent];
        return (
          <div key={group.id}>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ring-1 ${acc.chip}`}
                  >
                    {group.label}
                  </span>
                </div>
                <p className="text-sm text-slate-600 max-w-2xl">
                  {group.description}
                </p>
              </div>
              <div
                className={`hidden sm:block flex-1 max-w-[200px] h-px bg-gradient-to-r ${acc.barFrom} opacity-50 mb-2`}
                aria-hidden="true"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.items.map((item, idx) => {
                const { Icon } = item;
                return (
                  <motion.button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: idx * 0.04,
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    viewport={{ once: true, margin: "-50px" }}
                    whileHover={{ y: -3 }}
                    className={`group text-left bg-white rounded-2xl border border-slate-200 ring-1 ring-transparent ${acc.ring} shadow-sm hover:shadow-md transition-all duration-200 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${acc.iconBg} ${acc.iconText}`}
                      >
                        <Icon size={20} />
                      </span>
                      <ChevronRight
                        size={16}
                        className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-150"
                      />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mt-1">
                      {item.desc}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default FeatureGroupGrid;
