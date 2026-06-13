import React, { useState, useEffect } from "react";
import { X, Search, ChevronRight, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { navigationStructure } from "../../constants/docs_constants";

interface SearchResult {
  id: string;
  title: string;
  category: string;
  categoryTitle: string;
  score: number;
}

// Enhanced search function with proper ranking
const searchDocuments = (
  query: string,
  navStructure: typeof navigationStructure
): SearchResult[] => {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];
  const searchTerm = query.toLowerCase().trim();

  Object.entries(navStructure).forEach(([categoryKey, category]) => {
    category.sections.forEach((section) => {
      const titleLower = section.title.toLowerCase();
      const categoryTitleLower = category.title.toLowerCase();

      // Calculate relevance score
      let score = 0;

      // Exact match gets highest priority
      if (titleLower === searchTerm) {
        score = 1000;
      }
      // Title starts with search term
      else if (titleLower.startsWith(searchTerm)) {
        score = 900;
      }
      // Title contains search term as whole word
      else if (
        titleLower.includes(` ${searchTerm} `) ||
        titleLower.includes(`${searchTerm} `) ||
        titleLower.includes(` ${searchTerm}`)
      ) {
        score = 800;
      }
      // Title contains search term anywhere
      else if (titleLower.includes(searchTerm)) {
        score = 700;
      }
      // Category title matches
      else if (categoryTitleLower.includes(searchTerm)) {
        score = 600;
      }

      // Bonus points for shorter titles (more relevant)
      if (score > 0) {
        score += Math.max(0, 100 - section.title.length);

        results.push({
          id: section.id,
          title: section.title,
          category: categoryKey,
          categoryTitle: category.title,
          score: score,
        });
      }
    });
  });

  // Sort by score (highest first) and then alphabetically
  return results
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.title.localeCompare(b.title);
    })
    .slice(0, 10); // Limit to top 10 results
};

// Highlight matching text in search results
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 rounded px-1">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

interface SidebarContentProps {
  activeCategory: string;
  activeSection: string;
  onNavigate: (category: string, sectionId: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
  onClose: () => void;
  expandedCategories: Record<string, boolean>;
  toggleCategory: (categoryKey: string) => void;
}

// Move SidebarContent outside the Sidebar component
const SidebarContent: React.FC<SidebarContentProps> = ({
  activeCategory,
  activeSection,
  onNavigate,
  searchQuery,
  onSearch,
  searchResults,
  onClose,
  expandedCategories,
  toggleCategory,
}) => {
  const handleNavigate = (category: string, sectionId: string): void => {
    onNavigate(category, sectionId);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sidebar Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <BookOpen size={14} className="text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Supply Chain
            </h2>
          </div>
          {/* Close Button for Mobile Only */}
          <button
            onClick={onClose}
            aria-label="Close documentation sidebar"
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSearch(e.target.value)
              }
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Search Results */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-sm z-10 max-h-64 overflow-y-auto">
              <div className="p-2 text-xs text-slate-500 border-b bg-slate-50 rounded-t-xl">
                Found {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""}
              </div>
              {searchResults.map((result, index) => (
                <button
                  key={`${result.category}-${result.id}`}
                  onClick={() => handleNavigate(result.category, result.id)}
                  className="w-full text-left p-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 last:rounded-b-xl"
                >
                  <div className="font-medium text-slate-900 text-sm">
                    {highlightMatch(result.title, searchQuery)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    in {result.categoryTitle}
                  </div>
                  {index < 3 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-blue-600">
                        {index === 0 ? "Best match" : "Top result"}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-sm z-10 p-4 text-center">
              <div className="text-sm text-slate-500">
                No results found for "{searchQuery}"
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Try different keywords or browse categories below
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {Object.entries(navigationStructure).map(([categoryKey, category]) => {
          const isExpanded = expandedCategories[categoryKey];
          const accordionId = `category-${categoryKey}-sections`;
          return (
          <div key={categoryKey} className="mb-4">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(categoryKey)}
              aria-expanded={isExpanded}
              aria-controls={accordionId}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <div className="flex items-center gap-3">
                <category.icon className="text-gray-500 text-sm flex-shrink-0" />
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  {category.title}
                </h3>
              </div>
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-400" />
              ) : (
                <ChevronUp size={14} className="text-gray-400" />
              )}
            </button>

            {/* Category Sections */}
            {isExpanded && (
              <ul
                id={accordionId}
                className="ml-4 mt-2 space-y-1"
              >
                {category.sections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() =>
                        handleNavigate(categoryKey, section.id)
                      }
                      className={`w-full text-left p-3 rounded-lg flex items-center justify-between group text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                        activeCategory === categoryKey &&
                        activeSection === section.id
                          ? "bg-blue-50 text-blue-700 font-medium border-l-4 border-blue-500"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex-1">{section.title}</span>
                      <ChevronRight size={12} className="opacity-0 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          Supply Chain Documentation v2.0
        </div>
      </div>
    </div>
  );
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategory: string;
  activeSection: string;
  onNavigate: (category: string, sectionId: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  // searchResults is computed internally; this prop is accepted but unused
  searchResults?: unknown[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeCategory,
  activeSection,
  onNavigate,
  searchQuery,
  onSearch,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    overview: true,
    docs: true,
    support: true,
  });

  // Track whether we're on a mobile viewport; re-evaluate on resize
  const [isMobile, setIsMobile] = useState<boolean>(
    () => window.innerWidth < 1024
  );

  useEffect(() => {
    const handleResize = (): void => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Generate search results with improved ranking
  const searchResults = searchDocuments(searchQuery, navigationStructure);

  const toggleCategory = (categoryKey: string): void => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  };

  // For mobile, render fixed sidebar (no animated slide)
  if (isMobile) {
    return (
      <aside
        className="fixed inset-y-0 left-0 z-50 w-80 sm:w-72 xl:w-80 bg-white border-r border-slate-200 shadow-sm overflow-hidden"
        style={{
          borderTopRightRadius: "1.5rem",
          borderBottomRightRadius: "1.5rem",
        }}
      >
        <SidebarContent
          activeCategory={activeCategory}
          activeSection={activeSection}
          onNavigate={onNavigate}
          searchQuery={searchQuery}
          onSearch={onSearch}
          searchResults={searchResults}
          onClose={onClose}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
        />
      </aside>
    );
  }

  // For desktop, render static sidebar
  return (
    <aside
      className="w-80 sm:w-72 xl:w-80 bg-white border border-slate-200 shadow-sm rounded-r-3xl overflow-hidden"
      style={{
        borderTopRightRadius: "1.5rem",
        borderBottomRightRadius: "1.5rem",
      }}
    >
      <SidebarContent
        activeCategory={activeCategory}
        activeSection={activeSection}
        onNavigate={onNavigate}
        searchQuery={searchQuery}
        onSearch={onSearch}
        searchResults={searchResults}
        onClose={onClose}
        expandedCategories={expandedCategories}
        toggleCategory={toggleCategory}
      />
    </aside>
  );
};

export default Sidebar;
