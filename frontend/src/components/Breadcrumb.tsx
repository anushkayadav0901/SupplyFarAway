import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

/**
 * Static mapping from path segments to a human-readable label and the
 * feature group they belong to. Used to resolve page titles and crumbs.
 */
type RouteMeta = {
  group?: string;
  label: string;
};

const ROUTE_MAP: Record<string, RouteMeta> = {
  dashboard: { label: "Overview" },
  "compliance-check": { group: "Compliance", label: "Compliance Check" },
  compliance: { group: "Compliance", label: "Compliance" },
  "csv-upload": { group: "Compliance", label: "CSV Upload" },
  "product-analysis": { group: "Compliance", label: "Product Analysis" },
  "route-optimization": { group: "Operations", label: "Route Optimization" },
  map: { group: "Operations", label: "Map" },
  "carbon-footprint": { group: "Operations", label: "Carbon Footprint" },
  "inventory-management": { group: "Operations", label: "Inventory" },
  "export-report": { group: "Operations", label: "Export Report" },
  news: { label: "News" },
  docs: { label: "Documentation" },
  profile: { label: "Profile" },
  history: { label: "History" },
  "manage-account": { label: "Account" },
  analysis: { label: "Analysis" },
  "box-count": { group: "Verification", label: "Box Count" },
  "shipment-diff": { group: "Verification", label: "Shipment Diff" },
  "rfid-verification": { group: "Verification", label: "RFID" },
  "weight-check": { group: "Verification", label: "Weight Check" },
  "anomaly-detection": { group: "Intelligence", label: "Anomaly Detection" },
  "fraud-dashboard": { group: "Intelligence", label: "Fraud & Risk" },
  "audit-log": { group: "Intelligence", label: "Audit Log" },
  "trust-center": { group: "Intelligence", label: "Trust Center" },
  "load-aggregation": { group: "Operations", label: "Load Match" },
  "live-tracking": { group: "Operations", label: "Live Tracking" },
  "truck-registry": { group: "Operations", label: "Truck Registry" },
};

export function resolvePageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "SupplyChain";
  const last = segments[0];
  const meta = ROUTE_MAP[last];
  return meta?.label ?? "SupplyChain";
}

interface BreadcrumbProps {
  className?: string;
  /** Optional override label for the current page. */
  currentLabel?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ className = "", currentLabel }) => {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    const first = segments[0];
    const meta = ROUTE_MAP[first];
    const items: { label: string; href?: string }[] = [];

    if (meta?.group) {
      items.push({ label: meta.group });
    }
    items.push({
      label: currentLabel ?? meta?.label ?? first.replace(/-/g, " "),
    });
    return items;
  }, [location.pathname, currentLabel]);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs sm:text-sm text-white/80 ${className}`}
    >
      <Link
        to="/dashboard"
        aria-label="Dashboard"
        className="flex items-center gap-1 hover:text-white transition-colors duration-150 rounded-md px-1.5 py-0.5 hover:bg-white/10"
      >
        <Home size={13} />
      </Link>
      {crumbs.map((c, idx) => (
        <React.Fragment key={`${c.label}-${idx}`}>
          <ChevronRight size={12} className="text-white/50" aria-hidden="true" />
          <span
            className={
              idx === crumbs.length - 1
                ? "font-semibold text-white capitalize"
                : "text-white/70 capitalize"
            }
          >
            {c.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
