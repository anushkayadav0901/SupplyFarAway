import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

/**
 * Static mapping from path segments to a human-readable label and the
 * feature group they belong to. Used to resolve page titles and crumbs.
 *
 * Keep this in sync with App.tsx routes. Unknown routes degrade to
 * "Home › Page" (capitalised slug).
 */
type RouteMeta = {
  group?: string;
  label: string;
};

// V7 / H7: all known routes listed — unknown segments degrade gracefully.
const ROUTE_MAP: Record<string, RouteMeta> = {
  // Auth
  createAccount: { label: "Create Account" },

  // Dashboard
  dashboard: { label: "Overview" },

  // Compliance group
  "compliance-check": { group: "Compliance", label: "Compliance Check" },
  compliance: { group: "Compliance", label: "Compliance" },
  "csv-upload": { group: "Compliance", label: "CSV Upload" },
  "product-analysis": { group: "Compliance", label: "Product Analysis" },

  // Operations group
  "route-optimization": { group: "Operations", label: "Route Optimization" },
  map: { group: "Operations", label: "Map" },
  "carbon-footprint": { group: "Operations", label: "Carbon Footprint" },
  "inventory-management": { group: "Operations", label: "Inventory" },
  "export-report": { group: "Operations", label: "Export Report" },
  "load-aggregation": { group: "Operations", label: "Load Match" },
  "live-tracking": { group: "Operations", label: "Live Tracking" },
  "truck-registry": { group: "Operations", label: "Truck Registry" },

  // Verification group
  "box-count": { group: "Verification", label: "Box Count" },
  "shipment-diff": { group: "Verification", label: "Shipment Diff" },
  "rfid-verification": { group: "Verification", label: "RFID" },
  "weight-check": { group: "Verification", label: "Weight Check" },

  // Intelligence group
  "anomaly-detection": { group: "Intelligence", label: "Anomaly Detection" },
  "fraud-dashboard": { group: "Intelligence", label: "Fraud & Risk" },
  "audit-log": { group: "Intelligence", label: "Audit Log" },
  "trust-center": { group: "Intelligence", label: "Trust Center" },

  // Profile / account
  profile: { label: "Profile" },
  history: { label: "History" },
  "manage-account": { label: "Account" },
  analysis: { label: "Analysis" },

  // Misc
  news: { label: "News" },
  docs: { label: "Documentation" },
};

export function resolvePageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Supply Chain";
  const first = segments[0];
  const meta = ROUTE_MAP[first];
  // Graceful degradation: capitalise slug words when route is unknown.
  return (
    meta?.label ??
    first
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

interface BreadcrumbProps {
  className?: string;
  /** Optional override label for the current page. */
  currentLabel?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  className = "",
  currentLabel,
}) => {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    const first = segments[0];
    const meta = ROUTE_MAP[first];

    // Graceful degradation for unknown routes: show "Page" label
    const pageLabel =
      currentLabel ??
      meta?.label ??
      first.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const items: { label: string; href?: string }[] = [];

    if (meta?.group) {
      items.push({ label: meta.group });
    }

    items.push({ label: pageLabel });

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
        aria-label="Home"
        className="flex items-center gap-1 hover:text-white transition-colors duration-150 rounded-md px-1.5 py-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Home size={13} aria-hidden="true" />
        <span className="sr-only">Home</span>
      </Link>

      {crumbs.map((c, idx) => (
        <React.Fragment key={`${c.label}-${idx}`}>
          <ChevronRight
            size={12}
            className="text-white/50 flex-shrink-0"
            aria-hidden="true"
          />
          <span
            className={
              idx === crumbs.length - 1
                ? "font-semibold text-white capitalize"
                : "text-white/70 capitalize"
            }
            aria-current={idx === crumbs.length - 1 ? "page" : undefined}
          >
            {c.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
