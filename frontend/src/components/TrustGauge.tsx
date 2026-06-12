import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TrustGaugeProps {
  /** 0 - 100. Anything outside that range is clamped. */
  value: number;
  /** Diameter in px. Default 200. */
  size?: number;
  /** Stroke width of the arc. Default size / 10. */
  stroke?: number;
  /** Label shown beneath the score. */
  label?: string;
  /** Pulse animation. Defaults true. */
  pulse?: boolean;
  /** Whether to render a compact variant (smaller text). */
  compact?: boolean;
  /** Optional sub-label rendered under the value. */
  subLabel?: string;
}

/** Tween a number toward target over ~400ms using requestAnimationFrame. */
function useAnimatedValue(target: number, durationMs = 400): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const animate = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

function colorForScore(v: number): { ring: string; soft: string; text: string } {
  if (v >= 80) {
    return {
      ring: "#10b981", // emerald-500
      soft: "#6ee7b7",
      text: "#047857",
    };
  }
  if (v >= 60) {
    return {
      ring: "#3b82f6", // blue-500
      soft: "#93c5fd",
      text: "#1d4ed8",
    };
  }
  if (v >= 40) {
    return {
      ring: "#f59e0b", // amber-500
      soft: "#fcd34d",
      text: "#b45309",
    };
  }
  return {
    ring: "#ef4444", // red-500
    soft: "#fca5a5",
    text: "#b91c1c",
  };
}

const TrustGauge: React.FC<TrustGaugeProps> = ({
  value,
  size = 200,
  stroke,
  label = "Trust Index",
  pulse = true,
  compact = false,
  subLabel,
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const animated = useAnimatedValue(clamped, 600);
  const strokeWidth = stroke ?? Math.max(8, Math.round(size / 12));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const colors = colorForScore(animated);

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(animated)} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <linearGradient id={`tg-grad-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors.ring} />
            <stop offset="100%" stopColor={colors.soft} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#tg-grad-${size})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          initial={false}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      </svg>

      {/* Pulse halo */}
      {pulse && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-2 rounded-full"
          style={{
            boxShadow: `0 0 0 0 ${colors.soft}`,
            opacity: 0.5,
          }}
          animate={{
            boxShadow: [
              `0 0 0 0 ${colors.soft}`,
              `0 0 0 ${Math.round(size / 10)}px ${colors.soft}00`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <div
        className="absolute inset-0 flex flex-col items-center justify-center select-none"
        style={{ color: colors.text }}
      >
        <span
          className={
            compact
              ? "text-3xl font-bold tabular-nums"
              : "text-5xl font-extrabold tabular-nums"
          }
        >
          {Math.round(animated)}
        </span>
        <span
          className={
            compact
              ? "text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5"
              : "text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1"
          }
        >
          {label}
        </span>
        {subLabel && (
          <span className="text-[10px] text-slate-400 mt-0.5">{subLabel}</span>
        )}
      </div>
    </div>
  );
};

export default TrustGauge;
