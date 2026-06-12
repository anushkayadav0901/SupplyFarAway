import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Diff,
  Tag,
  Weight,
  Radar,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileQuestion,
  CheckCheck,
  PackagePlus,
} from "lucide-react";
import Header from "../../components/Header";
import TrustGauge from "../../components/TrustGauge";
import OperationsTicker from "../../components/OperationsTicker";
import { RowSkeleton } from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";
import { formatRelativeTime, trustToneFromScore } from "../../lib/insights";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of subsystem cards rendered before a "Show more" button. */
const MAX_CARDS_DISPLAY = 200;

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
// ---------------------------------------------------------------------------

function fmtScore(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Subsystem =
  | "boxCount"
  | "shipmentDiff"
  | "rfid"
  | "weight"
  | "anomaly"
  | "compliance";

interface SubsystemMeta {
  label: string;
  desc: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  link: string;
}

const SUBSYSTEMS: Record<Subsystem, SubsystemMeta> = {
  boxCount: {
    label: "Box Count",
    desc: "Vision count vs declared manifest.",
    Icon: Camera,
    link: "/box-count",
  },
  shipmentDiff: {
    label: "Shipment Diff",
    desc: "Loading vs delivery imagery review.",
    Icon: Diff,
    link: "/shipment-diff",
  },
  rfid: {
    label: "RFID / NFC",
    desc: "Manifest vs scanned tag reconciliation.",
    Icon: Tag,
    link: "/rfid-verification",
  },
  weight: {
    label: "Weight Check",
    desc: "Load-cell signal vs declared weight.",
    Icon: Weight,
    link: "/weight-check",
  },
  anomaly: {
    label: "Anomaly Detection",
    desc: "Multivariate risk scan over shipment.",
    Icon: Radar,
    link: "/anomaly-detection",
  },
  compliance: {
    label: "Compliance",
    desc: "Regulatory pre-flight for the shipment.",
    Icon: CheckCheck,
    link: "/compliance-check",
  },
};

interface DraftLike {
  _id: string;
  formData?: {
    shipmentId?: string;
    productName?: string;
    originCity?: string;
    destinationCity?: string;
  };
  timestamp?: string | Date;
}

// ---------------------------------------------------------------------------
// toneToVisuals helper
// ---------------------------------------------------------------------------

const toneToVisuals = (score: number, hasData: boolean) => {
  if (!hasData) {
    return {
      badge: "bg-slate-100 text-slate-600 ring-slate-200",
      ring: "ring-slate-100",
      iconBg: "bg-slate-50",
      iconText: "text-slate-500",
      label: "No data",
      tone: "idle" as const,
    };
  }
  const tone = trustToneFromScore(score);
  if (tone === "ok") {
    return {
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      ring: "ring-emerald-100",
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-600",
      label: "Healthy",
      tone,
    };
  }
  if (tone === "warn") {
    return {
      badge: "bg-amber-50 text-amber-700 ring-amber-100",
      ring: "ring-amber-100",
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      label: "Watch",
      tone,
    };
  }
  if (tone === "danger") {
    return {
      badge: "bg-red-50 text-red-700 ring-red-100",
      ring: "ring-red-100",
      iconBg: "bg-red-50",
      iconText: "text-red-600",
      label: "At risk",
      tone,
    };
  }
  return {
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
    ring: "ring-blue-100",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    label: "Active",
    tone,
  };
};

// ---------------------------------------------------------------------------
// SubsystemCardSkeleton — matches loaded card dimensions for no layout shift (V1)
// ---------------------------------------------------------------------------

function SubsystemCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 ring-1 ring-slate-100 p-5 shadow-sm animate-pulse">
      {/* Header row: icon + badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="h-5 w-16 rounded-full bg-slate-100" />
      </div>
      {/* Title */}
      <div className="h-4 w-28 rounded bg-slate-100" />
      {/* Desc */}
      <div className="mt-1.5 space-y-1.5">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-3/4 rounded bg-slate-100" />
      </div>
      {/* Score + timestamp row */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="h-8 w-10 rounded bg-slate-100" />
          <div className="h-2 w-8 rounded bg-slate-100 mt-1" />
        </div>
        <div className="h-3 w-20 rounded bg-slate-100" />
      </div>
      {/* CTA row */}
      <div className="mt-4 h-4 w-24 rounded bg-slate-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubsystemCard — memoized for stable-props list (V9)
// ---------------------------------------------------------------------------

interface CardData {
  key: Subsystem;
  meta: SubsystemMeta;
  hasData: boolean;
  score: number;
  latestAt: Date | null;
  note: string;
}

const SubsystemCard = React.memo(function SubsystemCard({
  c,
  idx,
  prefersReduced,
  onClick,
}: {
  c: CardData;
  idx: number;
  prefersReduced: boolean | null;
  onClick: () => void;
}) {
  const v = toneToVisuals(c.score, c.hasData);
  const { Icon } = c.meta;
  return (
    <motion.button
      key={c.key}
      onClick={onClick}
      initial={{ opacity: 0, y: prefersReduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: prefersReduced ? 0 : idx * 0.04, duration: 0.2 }}
      whileHover={prefersReduced ? undefined : { y: -2 }}
      aria-label={`Open ${c.meta.label} — ${v.label}`}
      className={`group text-left bg-white rounded-2xl border border-slate-200 ring-1 ${v.ring} p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className={`inline-flex w-10 h-10 rounded-xl items-center justify-center ${v.iconBg} ${v.iconText}`}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ring-1 ${v.badge}`}
        >
          {v.tone === "ok" && <CheckCircle2 size={10} aria-hidden="true" />}
          {(v.tone === "warn" || v.tone === "danger") && (
            <AlertTriangle size={10} aria-hidden="true" />
          )}
          {(v.tone === "idle" || v.tone === "info") && (
            <Clock size={10} aria-hidden="true" />
          )}
          {v.label}
        </span>
      </div>
      <h3 className="text-base font-bold text-slate-900">{c.meta.label}</h3>
      <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{c.note}</p>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-3xl font-bold tabular-nums text-slate-900 leading-none">
            {fmtScore(c.hasData ? c.score : undefined)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
            score
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 justify-end">
            <Clock size={10} aria-hidden="true" />
            {c.latestAt ? formatRelativeTime(c.latestAt) : "—"}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-700 group-hover:text-blue-800">
        Open feature{" "}
        <ChevronRight
          size={12}
          className="transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </motion.button>
  );
});

// ---------------------------------------------------------------------------
// InstructionalEmptyState — shown while no draft is selected (trust-center directive)
// ---------------------------------------------------------------------------

function InstructionalEmptyState({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* Instructional message */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
          <PackagePlus className="w-7 h-7 text-blue-500" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">
          Select a shipment to get started
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Pick a shipment from the dropdown above to see per-subsystem verification
          health, trust scores, and anomaly signals.
        </p>
        <button
          onClick={() => navigate("/inventory-management")}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Go to inventory management to create a shipment"
        >
          <PackagePlus className="w-4 h-4" aria-hidden="true" />
          Create a shipment
        </button>
      </div>
      {/* Skeleton placeholders hinting at future panels (V1 — match loaded dimensions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SubsystemCardSkeleton key={i} />
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const TrustCenter: React.FC = () => {
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [draftId, setDraftId] = useState<string>("");
  const [showAll, setShowAll] = useState(false);

  const draftsQuery = trpc.inventory.getDrafts.useQuery(
    { tab: undefined },
    { retry: false }
  );

  const drafts: DraftLike[] = useMemo(() => {
    const list = (draftsQuery.data?.drafts ?? []) as unknown as DraftLike[];
    return list;
  }, [draftsQuery.data]);

  React.useEffect(() => {
    if (!draftId && drafts.length > 0 && drafts[0]?._id) {
      setDraftId(String(drafts[0]._id));
    }
  }, [drafts, draftId]);

  const selectedDraft = useMemo(
    () => drafts.find((d) => String(d._id) === draftId),
    [drafts, draftId]
  );

  const bundleQuery = trpc.insights.draftBundle.useQuery(
    { draftId: draftId || "" },
    { enabled: !!draftId, retry: false, refetchInterval: 8000 }
  );

  const scoreQuery = trpc.insights.shipmentTrustScore.useQuery(
    { draftId: draftId || "" },
    { enabled: !!draftId, retry: false, refetchInterval: 8000 }
  );

  const bundle = bundleQuery.data;
  const trustScore = scoreQuery.data?.score ?? 0;

  type SubsystemDoc = Record<string, unknown> | null;
  const subsystemsData: Record<Subsystem, SubsystemDoc> = useMemo(
    () => ({
      boxCount: (bundle?.boxCount ?? null) as SubsystemDoc,
      shipmentDiff: (bundle?.shipmentDiff ?? null) as SubsystemDoc,
      rfid: (bundle?.rfid ?? null) as SubsystemDoc,
      weight: (bundle?.weight ?? null) as SubsystemDoc,
      anomaly: (bundle?.anomaly ?? null) as SubsystemDoc,
      compliance: (bundle?.compliance ?? null) as SubsystemDoc,
    }),
    [bundle]
  );

  type ScoreBreakdown = Record<
    Subsystem,
    { score: number; latestAt?: Date | string | null; note?: string }
  >;
  const scoreBreakdown = (scoreQuery.data?.breakdown ??
    {}) as Partial<ScoreBreakdown>;

  const cards: CardData[] = useMemo(() => {
    return (Object.keys(SUBSYSTEMS) as Subsystem[]).map((key) => {
      const meta = SUBSYSTEMS[key];
      const doc = subsystemsData[key];
      const hasData = !!doc;
      const b = scoreBreakdown[key];
      const score = b?.score ?? 0;
      const latestAtRaw = b?.latestAt;
      const latestAt = latestAtRaw
        ? latestAtRaw instanceof Date
          ? latestAtRaw
          : new Date(String(latestAtRaw))
        : null;
      const note = b?.note ?? meta.desc;
      return { key, meta, hasData, score, latestAt, note };
    });
  }, [subsystemsData, scoreBreakdown]);

  const healthyCount = cards.filter(
    (c) => c.hasData && trustToneFromScore(c.score) === "ok"
  ).length;
  const riskCount = cards.filter(
    (c) => c.hasData && trustToneFromScore(c.score) === "danger"
  ).length;
  const activeCount = cards.filter((c) => c.hasData).length;

  // Cap cards list (extra directive)
  const displayedCards = showAll ? cards : cards.slice(0, MAX_CARDS_DISPLAY);
  const hasMoreCards = cards.length > MAX_CARDS_DISPLAY;

  const isDataLoading =
    !!draftId && (bundleQuery.isLoading || scoreQuery.isLoading);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Trust Center" page="trust-center" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-8">
        {/* Hero */}
        <section
          className="relative bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-hidden"
          aria-label="Trust center hero"
        >
          <div
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 opacity-50 blur-2xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-center">
            <div className="flex items-center justify-center">
              {draftsQuery.isLoading ? (
                <div
                  className="w-[200px] h-[200px] rounded-full bg-slate-100 animate-pulse"
                  aria-label="Loading trust gauge"
                />
              ) : (
                <TrustGauge value={trustScore} label="Shipment Trust" />
              )}
            </div>
            <div>
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                    <ShieldCheck size={12} aria-hidden="true" /> Trust Center
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                    Per-shipment subsystem health
                  </h1>
                  <p className="text-slate-600 mt-1 max-w-xl">
                    Verification, intelligence and audit signals consolidated
                    into a single per-draft view. Pick a shipment below to drill
                    in.
                  </p>
                </div>
                <div className="min-w-[260px]">
                  <label
                    htmlFor="draft-picker"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Shipment <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  {draftsQuery.isLoading ? (
                    <div
                      className="h-10 w-full rounded-xl bg-slate-100 animate-pulse"
                      aria-label="Loading shipments"
                    />
                  ) : drafts.length === 0 ? (
                    <button
                      onClick={() => navigate("/inventory-management")}
                      aria-label="No shipments found. Go to inventory management to create one."
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      No shipments yet — create one
                    </button>
                  ) : (
                    <select
                      id="draft-picker"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      aria-required="true"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {drafts.map((d) => {
                        const f = d.formData ?? {};
                        const lbl =
                          f.shipmentId ||
                          f.productName ||
                          `${f.originCity ?? "?"} → ${f.destinationCity ?? "?"}` ||
                          String(d._id).slice(-8);
                        return (
                          <option key={String(d._id)} value={String(d._id)}>
                            {lbl}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SummaryStat
                  label="Subsystems"
                  value={String(activeCount)}
                  total={String(cards.length)}
                />
                <SummaryStat
                  label="Healthy"
                  value={String(healthyCount)}
                  total={String(cards.length)}
                  tone="ok"
                />
                <SummaryStat
                  label="At risk"
                  value={String(riskCount)}
                  total={String(cards.length)}
                  tone="high"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Selected shipment meta */}
        {selectedDraft && (
          <section
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap"
            aria-label="Selected shipment details"
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex w-10 h-10 rounded-xl bg-blue-50 text-blue-600 items-center justify-center"
                aria-hidden="true"
              >
                <FileQuestion size={18} />
              </span>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Shipment
                </div>
                <div className="text-slate-900 font-semibold">
                  {selectedDraft.formData?.shipmentId ??
                    selectedDraft.formData?.productName ??
                    String(selectedDraft._id).slice(-12)}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedDraft.formData?.originCity ?? "—"} →{" "}
                  {selectedDraft.formData?.destinationCity ?? "—"}
                </div>
              </div>
            </div>
            <button
              onClick={() =>
                navigate(`/audit-log?draftId=${selectedDraft._id}`)
              }
              aria-label={`View audit chain for shipment ${selectedDraft.formData?.shipmentId ?? selectedDraft._id}`}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              View audit chain{" "}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </section>
        )}

        {/* Subsystem cards */}
        <section aria-label="Subsystem signals">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Subsystem signals
          </h2>
          <AnimatePresence mode="wait">
            {/* No draft selected — show instructional empty state with matching-dimension skeletons */}
            {!draftId ? (
              <InstructionalEmptyState navigate={navigate} />
            ) : isDataLoading ? (
              /* Loading state — identical grid/card dimensions to avoid layout shift (V1) */
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <SubsystemCardSkeleton key={i} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="loaded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {displayedCards.map((c, idx) => (
                  <SubsystemCard
                    key={c.key}
                    c={c}
                    idx={idx}
                    prefersReduced={prefersReduced}
                    onClick={() => navigate(c.meta.link)}
                  />
                ))}
                {/* Show more affordance (extra directive) */}
                {hasMoreCards && !showAll && (
                  <div className="sm:col-span-2 lg:col-span-3 text-center py-4">
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      Show {cards.length - MAX_CARDS_DISPLAY} more subsystems
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Live activity ticker */}
        <section aria-label="Live operations activity">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            Live activity
          </h2>
          <OperationsTicker />
        </section>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SummaryStat
// ---------------------------------------------------------------------------

interface SummaryStatProps {
  label: string;
  value: string;
  total: string;
  tone?: "ok" | "high";
}

const SummaryStat: React.FC<SummaryStatProps> = ({
  label,
  value,
  total,
  tone,
}) => {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "high"
        ? "text-red-700"
        : "text-slate-900";
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-2xl font-bold tabular-nums ${toneClass}`}>
          {value}
        </span>
        <span className="text-xs text-slate-400">/ {total}</span>
      </div>
    </div>
  );
};

export default TrustCenter;
