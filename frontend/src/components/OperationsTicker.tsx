import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Tag,
  Weight,
  Camera,
  ShieldAlert,
  PackageSearch,
  Radar,
  ScrollText,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { formatRelativeTime } from "../lib/insights";

interface DisplayTick {
  id: string;
  type: string;
  summary: string;
  severity: "info" | "ok" | "warn" | "high";
  at: Date;
}

const iconForType = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("box")) return Camera;
  if (t.includes("rfid")) return Tag;
  if (t.includes("weight")) return Weight;
  if (t.includes("anom")) return Radar;
  if (t.includes("fraud")) return ShieldAlert;
  if (t.includes("diff")) return PackageSearch;
  if (t.includes("audit")) return ScrollText;
  return Activity;
};

const severityToTone = (severity: string): DisplayTick["severity"] => {
  const s = severity.toLowerCase();
  if (s === "high" || s === "critical") return "high";
  if (s === "medium" || s === "warn") return "warn";
  if (s === "ok" || s === "success") return "ok";
  // "low" / "info" / anything else
  return "info";
};

const sevStyles: Record<DisplayTick["severity"], { ring: string; dot: string; text: string }> = {
  high: {
    ring: "ring-red-200 bg-red-50",
    dot: "bg-red-500",
    text: "text-red-700",
  },
  warn: {
    ring: "ring-amber-200 bg-amber-50",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  info: {
    ring: "ring-blue-200 bg-blue-50",
    dot: "bg-blue-500",
    text: "text-blue-700",
  },
  ok: {
    ring: "ring-emerald-200 bg-emerald-50",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
};

interface OperationsTickerProps {
  /** Maximum number of ticks rendered. Default 12. */
  limit?: number;
  /** Polling interval. Default 4000ms. */
  intervalMs?: number;
}

const OperationsTicker: React.FC<OperationsTickerProps> = ({
  limit = 12,
  intervalMs = 4000,
}) => {
  // Pause animation on hover or when the tab is hidden so the marquee
  // doesn't drain CPU off-screen.
  const [isHovered, setIsHovered] = useState(false);
  const [isDocVisible, setIsDocVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisChange = () => setIsDocVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  const isAnimating = !isHovered && isDocVisible;

  const { data, isLoading } = trpc.insights.operationsTicker.useQuery(undefined, {
    // Pause polling when the page is hidden so we don't drain bandwidth
    // off-screen — matches the marquee pause behaviour below.
    refetchInterval: () =>
      typeof document !== "undefined" && document.hidden ? false : intervalMs,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const ticks: DisplayTick[] = useMemo(() => {
    if (!data) return [];
    const recent = data.recentTicks ?? [];
    return recent.slice(0, limit).map((t, idx): DisplayTick => {
      const at = new Date(t.ts);
      return {
        id: `${t.type}-${at.getTime()}-${idx}`,
        type: t.type,
        summary: t.summary,
        severity: severityToTone(t.severity ?? "low"),
        at,
      };
    });
  }, [data, limit]);

  if (isLoading && ticks.length === 0) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        aria-label="Operations ticker loading"
        role="status"
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
          <Activity size={14} className="text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operations Feed
          </span>
        </div>
        <div className="flex gap-3 px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-56 rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (ticks.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
          <Activity size={14} className="text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operations Feed
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-4 text-sm text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>
            No verification activity yet. Events will stream here as shipments move
            through the network.
          </span>
        </div>
      </div>
    );
  }

  // Duplicate ticks for seamless marquee loop
  const loop = [...ticks, ...ticks];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operations Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            Live
          </span>
        </div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-white z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-white z-10" />
        <motion.div
          className="flex gap-3 py-3 px-4"
          animate={isAnimating ? { x: ["0%", "-50%"] } : { x: "0%" }}
          transition={
            isAnimating
              ? { duration: 40, ease: "linear", repeat: Infinity }
              : { duration: 0 }
          }
          style={{ width: "max-content" }}
        >
          {loop.map((tick, idx) => {
            const Icon = iconForType(tick.type);
            const sty = sevStyles[tick.severity];
            return (
              <div
                key={`${tick.id}-${idx}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ring-1 ${sty.ring} shrink-0`}
              >
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-lg ${sty.dot}/10`}
                >
                  <Icon size={14} className={sty.text} />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-900 max-w-[260px] truncate">
                    {tick.summary}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                    <span>{tick.type}</span>
                    <span aria-hidden>·</span>
                    <span>{formatRelativeTime(tick.at)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default OperationsTicker;
