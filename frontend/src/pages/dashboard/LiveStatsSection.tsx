import React, { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  FaGlobeAmericas,
  FaShippingFast,
  FaLeaf,
  FaChartLine,
  FaBolt,
  FaShieldAlt,
} from "react-icons/fa";

/* ─────────────────────── helpers ─────────────────────── */

/** Animated counter that counts from 0 → target when `start` becomes true */
const AnimatedCounter: React.FC<{
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}> = ({ target, duration = 2, suffix = "", prefix = "", decimals = 0 }) => {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()
  );
  const [display, setDisplay] = useState("0");
  const started = useRef(false);
  const [ref, inView] = useInView({ threshold: 0.4, triggerOnce: true });

  useEffect(() => {
    if (inView && !started.current) {
      started.current = true;
      animate(mv, target, { duration, ease: "easeOut" });
    }
  }, [inView, mv, target, duration]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return unsub;
  }, [rounded]);

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

/* ─────── sparkline ─────── */
const Sparkline: React.FC<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}> = ({ data, color = "#3b82f6", width = 120, height = 36 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  // filled area path
  const areaPath = `M0,${height} L${points
    .split(" ")
    .map((p) => `L${p}`)
    .join(" ")} L${width},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path d={areaPath} fill={color} fillOpacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={width}
          cy={
            height -
            ((data[data.length - 1] - min) / range) * (height - 4) -
            2
          }
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
};

/* ───── circular progress ring ───── */
const ProgressRing: React.FC<{
  percent: number;
  size?: number;
  strokeWidth?: number;
}> = ({
  percent,
  size = 120,
  strokeWidth = 8,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [ref, inView] = useInView({ threshold: 0.5, triggerOnce: true });

  return (
    <div ref={ref} className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* progress — solid emerald stroke */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={
            inView
              ? { strokeDashoffset: circumference * (1 - percent / 100) }
              : { strokeDashoffset: circumference }
          }
          transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      {/* centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">
          <AnimatedCounter target={percent} suffix="%" />
        </span>
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mt-0.5">
          Green Score
        </span>
      </div>
    </div>
  );
};

/* ───── Global network map ───── */
const GlobalNetworkMap: React.FC = () => {
  // Simplified world "nodes" with animated connections
  const nodes = [
    { x: 150, y: 120, label: "NYC", delay: 0 },
    { x: 320, y: 90, label: "LON", delay: 0.2 },
    { x: 380, y: 140, label: "DXB", delay: 0.4 },
    { x: 480, y: 100, label: "SIN", delay: 0.6 },
    { x: 530, y: 130, label: "TKY", delay: 0.8 },
    { x: 200, y: 180, label: "SAO", delay: 1.0 },
    { x: 350, y: 190, label: "JHB", delay: 0.3 },
    { x: 100, y: 100, label: "LAX", delay: 0.5 },
    { x: 460, y: 160, label: "MUM", delay: 0.7 },
    { x: 560, y: 160, label: "SYD", delay: 0.9 },
  ];

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6],
    [1, 6], [7, 0], [2, 8], [8, 3], [4, 9], [3, 9],
    [6, 8], [7, 5],
  ];

  return (
    <div className="relative w-full max-w-[640px] mx-auto">
      <svg
        viewBox="0 0 640 280"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* connections — flat solid strokes */}
        {connections.map(([from, to], i) => (
          <line
            key={`conn-${i}`}
            x1={nodes[from].x}
            y1={nodes[from].y}
            x2={nodes[to].x}
            y2={nodes[to].y}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
        ))}

        {/* nodes */}
        {nodes.map((node, i) => (
          <g key={`node-${i}`}>
            {/* core dot */}
            <circle
              cx={node.x}
              cy={node.y}
              r="4.5"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="2"
            />
            {/* label */}
            <text
              x={node.x}
              y={node.y - 10}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="8"
              fontWeight="bold"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Live indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
          Live Network
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────── main section ─────────────────────── */

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  change: string;
  changeUp: boolean;
  sparkData: number[];
  sparkColor: string;
}

const LiveStatsSection: React.FC = () => {
  const [sectionRef, sectionInView] = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const stats: StatCard[] = [
    {
      icon: <FaShippingFast className="text-blue-600" size={20} />,
      label: "Shipments Tracked",
      value: 12847,
      suffix: "",
      change: "+12.4%",
      changeUp: true,
      sparkData: [30, 45, 38, 52, 48, 62, 55, 68, 72, 78, 85, 91],
      sparkColor: "#3b82f6",
    },
    {
      icon: <FaGlobeAmericas className="text-emerald-600" size={20} />,
      label: "Countries Connected",
      value: 142,
      suffix: "",
      change: "+8 new",
      changeUp: true,
      sparkData: [95, 98, 100, 105, 108, 112, 118, 125, 130, 135, 138, 142],
      sparkColor: "#10b981",
    },
    {
      icon: <FaChartLine className="text-blue-600" size={20} />,
      label: "Cost Saved",
      value: 2.4,
      suffix: "M",
      prefix: "$",
      decimals: 1,
      change: "+18.2%",
      changeUp: true,
      sparkData: [0.8, 1.0, 0.9, 1.2, 1.4, 1.6, 1.5, 1.8, 2.0, 2.1, 2.3, 2.4],
      sparkColor: "#3b82f6",
    },
    {
      icon: <FaBolt className="text-amber-500" size={20} />,
      label: "Avg Delivery Speed",
      value: 96.8,
      suffix: "%",
      decimals: 1,
      change: "+3.1%",
      changeUp: true,
      sparkData: [88, 89, 91, 90, 92, 93, 94, 93, 95, 96, 96, 97],
      sparkColor: "#f59e0b",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-20 sm:py-32 px-4 sm:px-6 z-10 overflow-hidden"
      id="live-stats"
    >
      {/* Removed: background decorations */}

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={sectionInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
            </span>
            Real-Time Intelligence
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Supply Chain{" "}
            <span className="text-blue-600">
              Network
            </span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Monitor your logistics network with real-time data and analytics
          </p>
        </motion.div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 40 }}
              animate={sectionInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: index * 0.1 + 0.2,
                ease: "easeOut",
              }}
              whileHover={{
                y: -6,
                transition: { duration: 0.2 },
              }}
              className="group relative bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
            >

              <div className="relative">
                {/* Icon + Change */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border"
                    style={{
                      backgroundColor: `${stat.sparkColor}10`,
                      borderColor: `${stat.sparkColor}20`,
                    }}
                  >
                    {stat.icon}
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      stat.changeUp
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-red-50 text-red-700 border border-red-100"
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>

                {/* Value */}
                <div className="text-3xl font-extrabold text-gray-900 mb-1 tabular-nums">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    decimals={stat.decimals}
                  />
                </div>

                {/* Label */}
                <p className="text-sm text-gray-500 font-medium mb-4">
                  {stat.label}
                </p>

                {/* Sparkline */}
                <Sparkline
                  data={stat.sparkData}
                  color={stat.sparkColor}
                  width={160}
                  height={32}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Row — Network Map + Sustainability Ring */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Network Map Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={sectionInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="lg:col-span-2 relative bg-white  border border-gray-200/60 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Global Network
                </h3>
                <p className="text-sm text-gray-500">
                  Active routes across 10 major hubs
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Hub</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-500">In Transit</span>
                </div>
              </div>
            </div>
            <GlobalNetworkMap />
          </motion.div>

          {/* Right column — Sustainability + Security */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={sectionInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col gap-6"
          >
            {/* Sustainability Card */}
            <div className="relative bg-white  border border-gray-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex-1 flex flex-col items-center justify-center overflow-hidden group">
              {/* hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-emerald-50/50 rounded-2xl" />
              <div className="relative flex flex-col items-center">
                <div className="flex items-center gap-2 mb-4">
                  <FaLeaf className="text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Sustainability
                  </h3>
                </div>
                <ProgressRing percent={87} size={130} strokeWidth={10} />
                <p className="text-xs text-gray-500 mt-3 text-center max-w-[180px]">
                  Carbon-neutral delivery target progress
                </p>
              </div>
            </div>

            {/* Security / Compliance mini card */}
            <div className="relative bg-blue-600 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">

              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-white  rounded-xl flex items-center justify-center border border-white/10">
                  <FaShieldAlt className="text-white text-lg" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    <AnimatedCounter target={99} suffix="%" />{" "}
                  </h3>
                  <p className="text-blue-100 text-sm font-medium">
                    Compliance Rate
                  </p>
                </div>
              </div>
              <div className="relative mt-4 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: "99%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 1, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] text-blue-200 font-semibold">
                  VERIFIED
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LiveStatsSection;
