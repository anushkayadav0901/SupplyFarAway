import React from "react";
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
  accent: "blue" | "emerald";
  description: string;
  items: FeatureLink[];
}

const GROUPS: FeatureGroup[] = [
  {
    id: "verification",
    label: "Security & Verification",
    accent: "blue",
    description: "Physical inspection checks and aggregated risk metrics.",
    items: [
      {
        path: "/inspect",
        title: "Physical Inspection",
        desc: "Unified camera count, scale weight, and RFID verification.",
        Icon: Camera,
      },
      {
        path: "/risk",
        title: "Risk & Trust Center",
        desc: "Aggregated shipment risk scores, anomaly scans, and audit logs.",
        Icon: ShieldAlert,
      },
    ],
  },
  {
    id: "operations",
    label: "Logistics Operations",
    accent: "emerald",
    description: "Fleet tracking, routing, and corridor optimization.",
    items: [
      {
        path: "/routes",
        title: "Route Planning",
        desc: "Optimize paths for cost/carbon and track active pings.",
        Icon: Navigation,
      },
      {
        path: "/fleet",
        title: "Fleet & Corridors",
        desc: "Registry of trucks and load matching corridors.",
        Icon: Truck,
      },
    ],
  },
  {
    id: "records",
    label: "Compliance & Intake",
    accent: "blue",
    description: "Regulatory forms, bulk uploads, and manifest registries.",
    items: [
      {
        path: "/compliance",
        title: "Compliance check",
        desc: "AI HS-Code extraction, CSV intake, and form screening.",
        Icon: ShieldCheck,
      },
      {
        path: "/inventory",
        title: "Shipment Inventory",
        desc: "Active manifests list and export actions.",
        Icon: Boxes,
      },
    ],
  },
];

const accentClasses: Record<
  FeatureGroup["accent"],
  { chip: string; iconBg: string; iconText: string; hoverBorder: string }
> = {
  blue: {
    chip: "bg-blue-100 text-blue-700 ring-blue-500/20",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    hoverBorder: "hover:border-blue-400",
  },
  emerald: {
    chip: "bg-blue-100 text-blue-700 ring-blue-500/20",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    hoverBorder: "hover:border-blue-400",
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
                className="hidden sm:block flex-1 max-w-[200px] h-px bg-slate-200 opacity-60 mb-2"
                aria-hidden="true"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.items.map((item) => {
                const { Icon } = item;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`group text-left bg-white rounded-2xl border border-slate-200 ${acc.hoverBorder} shadow-sm hover:shadow-md transition-colors duration-200 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${acc.iconBg} ${acc.iconText}`}
                      >
                        <Icon size={20} />
                      </span>
                      <ChevronRight
                        size={16}
                        className="text-slate-300 group-hover:text-slate-500 transition-colors duration-150"
                      />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mt-1">
                      {item.desc}
                    </p>
                  </button>
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
