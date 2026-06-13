import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Navigation,
  ShieldAlert,
  Truck,
  Boxes,
  Sparkles,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import FeatureGroupGrid from "../../components/FeatureGroupGrid";

function Dashboard() {
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = React.useState(false);

  const { isError } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
    enabled: !!localStorage.getItem("token"),
  });

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
    else if (isError) navigate("/");
  }, [navigate, isError]);

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      <GridBackdrop />

      <NavBar onOpen={() => setMobileNav(true)} navigate={navigate} />
      {mobileNav && <MobileNav onClose={() => setMobileNav(false)} navigate={navigate} />}

      <Hero navigate={navigate} />
      <TeaserGrid navigate={navigate} />

      <section className="relative pb-24">
        <FeatureGroupGrid />
      </section>

      <Footer navigate={navigate} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subtle grid background — sits behind everything, no animations
// ─────────────────────────────────────────────────────────────
function GridBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <svg className="w-full h-full text-slate-300/40">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-white to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pill nav header
// ─────────────────────────────────────────────────────────────
type NavigateFn = ReturnType<typeof useNavigate>;

function NavBar({ onOpen, navigate }: { onOpen: () => void; navigate: NavigateFn }) {
  return (
    <header className="relative z-20 px-4 pt-6">
      <nav className="mx-auto max-w-6xl bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-between pl-5 pr-3 py-2.5">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="SupplyFarAway home"
        >
          <span className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xs tracking-tight">
            SF
          </span>
          <span className="font-bold text-slate-900 tracking-tight text-base hidden sm:inline">
            SupplyFarAway
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          <NavLink onClick={() => navigate("/inspect")} icon={<ShieldCheck size={15} />}>Inspect</NavLink>
          <NavLink onClick={() => navigate("/routes")} icon={<Navigation size={15} />}>Routes</NavLink>
          <NavLink onClick={() => navigate("/risk")} icon={<ShieldAlert size={15} />}>Risk</NavLink>
          <NavLink onClick={() => navigate("/fleet")} icon={<Truck size={15} />}>Fleet</NavLink>
          <NavLink onClick={() => navigate("/docs")}>Docs</NavLink>
          <NavLink onClick={() => navigate("/news")}>News</NavLink>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/anushkayadav0901/SupplyFarAway"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            className="hidden sm:inline-flex w-9 h-9 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <GitHubGlyph />
          </a>
          <button
            onClick={() => navigate("/inventory")}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Open Inventory
          </button>
          <button
            onClick={onOpen}
            aria-label="Open navigation menu"
            className="md:hidden w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <Menu size={18} className="text-slate-700" />
          </button>
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  onClick,
  children,
  icon,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-slate-600 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-full hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {icon}
      {children}
    </button>
  );
}

function MobileNav({ onClose, navigate }: { onClose: () => void; navigate: NavigateFn }) {
  const go = (path: string) => () => {
    onClose();
    navigate(path);
  };
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute top-6 left-4 right-4 bg-white border border-slate-200 rounded-3xl shadow-sm p-4"
      >
        <div className="flex items-center justify-between mb-3 px-2">
          <span className="font-bold text-slate-900">Menu</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <X size={18} className="text-slate-700" />
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {[
            { label: "Inspect", path: "/inspect", icon: <ShieldCheck size={16} /> },
            { label: "Routes", path: "/routes", icon: <Navigation size={16} /> },
            { label: "Risk", path: "/risk", icon: <ShieldAlert size={16} /> },
            { label: "Fleet", path: "/fleet", icon: <Truck size={16} /> },
            { label: "Compliance", path: "/compliance", icon: <ShieldCheck size={16} /> },
            { label: "Inventory", path: "/inventory", icon: <Boxes size={16} /> },
            { label: "Docs", path: "/docs" },
            { label: "News", path: "/news" },
          ].map((item) => (
            <li key={item.path}>
              <button
                onClick={go(item.path)}
                className="w-full text-left px-4 py-3 rounded-2xl text-slate-800 hover:bg-slate-100 inline-flex items-center gap-3 text-sm font-medium"
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Centered hero with announcement chip + mixed typography
// ─────────────────────────────────────────────────────────────
function Hero({ navigate }: { navigate: NavigateFn }) {
  return (
    <section className="relative max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 text-center">
      <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 ring-1 ring-blue-100 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold">
        <Sparkles size={14} />
        <span>Powered by Gemini 2.5 on Vertex AI</span>
      </div>

      <h1 className="mt-8 font-bold tracking-tight text-slate-900 leading-[1.02]">
        <span className="block text-5xl sm:text-6xl md:text-7xl">End-to-end</span>
        <span className="relative inline-flex items-center justify-center gap-3 sm:gap-5 my-1 sm:my-2">
          <DecorIcon className="hidden sm:inline-flex"><Truck size={22} /></DecorIcon>
          <span
            className="text-5xl sm:text-6xl md:text-7xl text-transparent"
            style={{ WebkitTextStroke: "1.5px rgb(37, 99, 235)" }}
          >
            logistics
          </span>
          <DecorIcon className="hidden sm:inline-flex"><Boxes size={22} /></DecorIcon>
        </span>
        <span className="block text-5xl sm:text-6xl md:text-7xl text-blue-600">intelligence</span>
      </h1>

      <p className="mt-8 max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
        Route optimization, compliance checks, and shipment verification — every step visible, every decision explainable.
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
          onClick={() => navigate("/compliance")}
          className="text-blue-700 hover:bg-blue-50 border-2 border-blue-200 hover:border-blue-300 font-semibold text-sm sm:text-base px-7 py-3 rounded-full inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Try compliance check
        </button>
      </div>
    </section>
  );
}

function DecorIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-blue-200 bg-white items-center justify-center text-blue-500 shadow-sm ${className}`}
    >
      <span className="flex w-full h-full items-center justify-center">{children}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Three high-signal teaser cards under the hero
// ─────────────────────────────────────────────────────────────
function TeaserGrid({ navigate }: { navigate: NavigateFn }) {
  const cards = [
    {
      onClick: () => navigate("/inspect"),
      icon: <ShieldCheck size={22} />,
      title: "Physical Inspection",
      desc: "Camera count, weight, RFID, damage diff — all four checks on one shipment, in real time.",
    },
    {
      onClick: () => navigate("/routes"),
      icon: <Navigation size={22} />,
      title: "Route Planning",
      desc: "Origin → destination. Cost, time, carbon and the live map overlay return in one call.",
    },
    {
      onClick: () => navigate("/risk"),
      icon: <ShieldAlert size={22} />,
      title: "Risk Center",
      desc: "Trust gauge, anomaly scans, and an expandable audit trail per shipment.",
    },
  ];

  return (
    <section className="relative max-w-6xl mx-auto px-6 pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={c.onClick}
            className="group text-left bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              {c.icon}
            </div>
            <h3 className="font-bold text-slate-900 text-lg">{c.title}</h3>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{c.desc}</p>
            <div className="mt-4 text-blue-700 text-sm font-semibold inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────
function Footer({ navigate }: { navigate: NavigateFn }) {
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
          <button onClick={() => navigate("/docs")} className="hover:text-slate-900">Docs</button>
          <button onClick={() => navigate("/news")} className="hover:text-slate-900">News</button>
          <a
            href="https://github.com/anushkayadav0901/SupplyFarAway"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900 inline-flex items-center gap-1.5"
          >
            <GitHubGlyph size={14} /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

function GitHubGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.02c-3.2.69-3.87-1.37-3.87-1.37-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.05 11.05 0 015.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.73.8 1.18 1.83 1.18 3.09 0 4.44-2.7 5.41-5.27 5.69.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.55 4.57-1.52 7.86-5.83 7.86-10.91C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export default Dashboard;
