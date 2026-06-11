import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaChevronRight,
  FaExternalLinkAlt,
  FaLightbulb,
  FaChevronLeft,
  FaBars,
  FaTimes,
  FaDownload,
} from "react-icons/fa";
import { navigationStructure } from "../../constants/docs_constants";
import { useNavigate } from "react-router-dom";
import ProfileCards from "./ProfileCards";
import { trpc } from "../../lib/trpc";

interface DownloadItem {
  url: string;
  filename: string;
  name: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  content?: string;
  linkId?: string;
  downloads?: DownloadItem[];
  examples?: string[];
}

interface SectionWithCategory {
  id: string;
  title: string;
  description: string;
  category: string;
  [key: string]: unknown;
}

interface ContentRendererProps {
  activeCategory: string;
  activeSection: string;
  currentSectionIndex: number;
  allSections: SectionWithCategory[];
  onNavigateNext: () => void;
  onNavigatePrevious: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({
  activeCategory,
  activeSection,
  currentSectionIndex,
  allSections,
  onNavigateNext,
  onNavigatePrevious,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch user via tRPC (replaces axios.get /protectedRoute)
  const { data: meData, isError: isMeError } = trpc.auth.getMe.useQuery(
    undefined,
    { retry: false }
  );

  // Redirect to "/" if not authenticated
  useEffect(() => {
    if (isMeError) {
      navigate("/");
    }
  }, [isMeError, navigate]);

  // Scroll to top when activeCategory or activeSection changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    }
  }, [activeCategory, activeSection]);

  const currentSection = (
    navigationStructure[activeCategory as keyof typeof navigationStructure]
      ?.sections as Section[] | undefined
  )?.find((section) => section.id === activeSection);

  if (!currentSection) return null;

  const handleNavigate = () => {
    if (!currentSection.linkId) return;

    if (!meData?.user) {
      navigate("/");
      return;
    }

    const userId = String(meData.user.id);
    const url = currentSection.linkId.includes(":userId")
      ? currentSection.linkId.replace(":userId", userId)
      : currentSection.linkId;
    navigate(url);
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  };

  // Download handler function
  const handleDownload = (url: string, filename: string): void => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = (
    content: string | undefined,
    sectionId: string
  ): React.ReactNode => {
    if (!content || typeof content !== "string") {
      if (sectionId === "contributors") {
        return <ProfileCards />;
      }
      return <p className="text-gray-500 italic">No content available.</p>;
    }

    return content.split("\n").map((line, index) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("# ")) {
        return (
          <h1
            key={index}
            className="text-3xl font-bold text-gray-900 mt-8 mb-4"
          >
            {trimmedLine.slice(2)}
          </h1>
        );
      } else if (trimmedLine.startsWith("## ")) {
        return (
          <h2
            key={index}
            className="text-2xl font-semibold text-gray-800 mt-6 mb-3"
          >
            {trimmedLine.slice(3)}
          </h2>
        );
      } else if (trimmedLine.startsWith("### ")) {
        return (
          <h3
            key={index}
            className="text-xl font-medium text-gray-700 mt-4 mb-2"
          >
            {trimmedLine.slice(4)}
          </h3>
        );
      } else if (trimmedLine.startsWith("- **")) {
        const match = trimmedLine.match(/- \*\*(.+?)\*\*: (.+)/);
        if (match) {
          return (
            <div key={index} className="flex items-start gap-3 mb-2">
              <span className="text-blue-500 font-bold mt-1">•</span>
              <div>
                <span className="font-semibold text-gray-900">{match[1]}:</span>
                <span className="text-gray-700 ml-1">{match[2]}</span>
              </div>
            </div>
          );
        }
      } else if (trimmedLine.startsWith("- ")) {
        return (
          <div key={index} className="flex items-start gap-3 mb-2">
            <span className="text-blue-500 font-bold mt-1">•</span>
            <span className="text-gray-700">{trimmedLine.slice(2)}</span>
          </div>
        );
      } else if (trimmedLine.match(/^\d+\./)) {
        return (
          <div key={index} className="text-gray-700 mb-2 ml-4">
            {trimmedLine}
          </div>
        );
      } else if (trimmedLine === "") {
        return <div key={index} className="mb-4"></div>;
      } else if (trimmedLine !== "") {
        return (
          <p key={index} className="text-gray-700 mb-4 leading-relaxed">
            {trimmedLine}
          </p>
        );
      }
      return null;
    });
  };

  return (
    <AnimatePresence mode="wait">
    <motion.div
      ref={contentRef}
      key={`${activeCategory}-${activeSection}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-12 bg-white shadow-lg rounded-l-3xl"
      style={{
        borderTopLeftRadius: "1.5rem",
        borderBottomLeftRadius: "1.5rem",
      }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap relative">
        <FaHome className="text-xs flex-shrink-0" />
        <FaChevronRight className="text-xs flex-shrink-0" />
        <span className="capitalize">
          {
            navigationStructure[
              activeCategory as keyof typeof navigationStructure
            ].title
          }
        </span>
        <FaChevronRight className="text-xs flex-shrink-0" />
        <span className="text-gray-900 font-medium">
          {currentSection.title}
        </span>
        <button
          onClick={onToggleSidebar}
          className="lg:hidden ml-auto p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 flex-shrink-0"
        >
          {isSidebarOpen ? <FaTimes /> : <FaBars />}
        </button>
      </nav>

      {/* Content Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
          {currentSection.title}
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
          {currentSection.description}
        </p>
      </div>

      {/* Main Content */}
      <div className="mb-12">
        {renderContent(currentSection.content, currentSection.id)}
      </div>

      {/* Downloads Section - Only show if downloads exist */}
      {currentSection.downloads && (
        <div className="bg-green-50 rounded-xl p-4 sm:p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FaDownload className="text-green-500 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900">
              Download Templates
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {currentSection.downloads.map((download, index) => (
              <button
                key={index}
                onClick={() => handleDownload(download.url, download.filename)}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-colors duration-150 transition-shadow duration-150 text-left group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <FaDownload className="text-blue-600 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {download.name}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {download.filename}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Examples Section */}
      {currentSection.examples && (
        <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FaLightbulb className="text-blue-500 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900">Examples</h3>
          </div>
          <ul className="space-y-2">
            {currentSection.examples.map((example, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-blue-500 font-bold mt-0.5 flex-shrink-0">
                  •
                </span>
                <span className="text-gray-700 text-sm sm:text-base">
                  {example}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-gray-200 gap-4">
        <button
          onClick={onNavigatePrevious}
          disabled={currentSectionIndex === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto justify-center sm:justify-start ${
            currentSectionIndex === 0
              ? "text-gray-400 cursor-not-allowed"
              : "text-blue-600 hover:bg-blue-50"
          }`}
        >
          <FaChevronLeft className="flex-shrink-0" />
          <span>Previous</span>
        </button>

        {/* Show "View on Web" only for sections with linkId */}
        {currentSection.linkId && (
          <div className="flex items-center gap-4 order-first sm:order-none">
            <button
              onClick={handleNavigate}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors text-sm bg-transparent border-none cursor-pointer"
            >
              <FaExternalLinkAlt className="text-sm flex-shrink-0" />
              <span className="hidden sm:inline">View on Web</span>
              <span className="sm:hidden">Web</span>
            </button>
          </div>
        )}

        <button
          onClick={onNavigateNext}
          disabled={currentSectionIndex === allSections.length - 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto justify-center sm:justify-end ${
            currentSectionIndex === allSections.length - 1
              ? "text-gray-400 cursor-not-allowed"
              : "text-blue-600 hover:bg-blue-50"
          }`}
        >
          <span>Next</span>
          <FaChevronRight className="flex-shrink-0" />
        </button>
      </div>
    </motion.div>
    </AnimatePresence>
  );
};

export default ContentRenderer;
