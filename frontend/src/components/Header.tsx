import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Breadcrumb, { resolvePageTitle } from "./Breadcrumb";

interface HeaderProps {
  title?: string;
  page?: string;
}

const Header = ({ title, page = "dashboard" }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const resolvedTitle =
    title && title.trim().length > 0
      ? title
      : resolvePageTitle(location.pathname) || "Supply Chain";

  return (
    <header
      className="relative max-w-7xl mx-auto bg-blue-600 text-white py-8 sm:py-12 rounded-b-3xl w-full shadow-sm"
    >
      <div className="relative px-4 sm:px-6 mb-3">
        <Breadcrumb currentLabel={title && title.trim().length > 0 ? title : undefined} />
      </div>

      <div className="relative px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Link
            to="/dashboard"
            aria-label="Go to dashboard"
            className="relative w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 hover:bg-blue-400 rounded-2xl flex items-center justify-center shadow-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600 outline-none group"
          >
            <div className="relative">
              <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
                  <path
                    d="M8 12l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          </Link>

          <h1
            className="text-xl sm:text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {resolvedTitle}
          </h1>

          <div className="hidden sm:block w-16 h-0.5 bg-white/30 ml-4 rounded-full" />
        </div>

        <div className="flex items-center space-x-2">
          {page === "compliance" && (
            <button
              onClick={() => navigate("/inventory")}
              className="border-none bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-colors duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
            >
              Inventory
            </button>
          )}
          {page === "export" && (
            <button
              onClick={() => navigate("/inventory")}
              className="border-none bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-colors duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
            >
              Inventory
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2">
            {[
              { label: "Inspection", path: "/inspect" },
              { label: "Risk Center", path: "/risk" },
              { label: "Routes", path: "/routes" },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="border-none bg-blue-500 hover:bg-blue-400 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
