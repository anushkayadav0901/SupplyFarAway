import React, { useState, useEffect } from "react";
import { Newspaper, Search, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import Toast from "./../../components/Toast";
import { trpc } from "../../lib/trpc";

interface Article {
  title: string;
  link: string;
  summary: string;
  date: string;
  source: string;
}

interface SummaryData {
  summary: string;
  suggestions: string;
}

interface DateTab {
  key: number;
  label: string;
  icon: React.ReactNode;
}

interface RowProps {
  article: Article;
  expandedRows: Record<string, boolean>;
  rowSummaries: Record<string, SummaryData>;
  rowLoading: Record<string, boolean>;
  onRowToggle: (article: Article) => void;
}

// Hoisted outside the News component so React doesn't unmount/remount each
// row on every parent render (which used to discard Collapse animation state
// and re-trigger summarization requests).
const NewsRow: React.FC<RowProps> = ({
  article,
  expandedRows,
  rowSummaries,
  rowLoading,
  onRowToggle,
}) => {
  const open = expandedRows[article.link] || false;
  const summaryData = rowSummaries[article.link] || ({} as SummaryData);
  const isRowLoading = rowLoading[article.link] || false;

  return (
    <>
      <tr className="hover:bg-slate-50 border-b border-slate-100">
        <td className="px-3 py-2 w-10">
          <button
            aria-label={
              open ? "Collapse article details" : "Expand article details"
            }
            onClick={() => onRowToggle(article)}
            className="p-1 rounded text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
        <td className="px-3 py-2 text-sm text-slate-800">{article.title}</td>
        <td className="px-3 py-2 text-sm text-slate-600">{article.source || "Unknown source"}</td>
        <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">{new Date(article.date).toLocaleDateString()}</td>
        <td className="px-3 py-2 text-sm">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
            aria-label={`Read full article: ${article.title}`}
          >
            Read More
          </a>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100">
          <td colSpan={5} className="px-3 py-0">
            <div className="mx-2 my-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
              {isRowLoading ? (
                <div
                  className="flex justify-center items-center py-4"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">
                    Summary
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    {summaryData.summary || "No summary available"}
                  </p>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">
                    Suggestions
                  </h3>
                  <p className="text-sm text-slate-600">
                    {summaryData.suggestions || "No suggestions available"}
                  </p>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const News: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tempSearchQuery, setTempSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<"direct" | "summarized">(
    "direct"
  );
  const [toastProps, setToastProps] = useState<{
    type: string;
    message: string;
  }>({ type: "", message: "" });
  const [activeDate, setActiveDate] = useState<number>(0);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [rowSummaries, setRowSummaries] = useState<
    Record<string, SummaryData>
  >({});
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // tRPC query for news — replaces axios.get /api/news
  const {
    data: newsData,
    isLoading: loading,
    isFetching: tableLoading,
    isError: newsIsError,
    error: newsError,
    refetch: refetchNews,
  } = trpc.inventory.getNews.useQuery({
    search: searchQuery || undefined,
    page: activeDate + 1,
    searchMode,
  });

  // Handle news fetch errors via toast
  useEffect(() => {
    if (newsError) {
      setToastProps({
        type: "error",
        message: newsError.message || "Failed to fetch news.",
      });
    }
  }, [newsError]);

  const news: Article[] = newsData?.articles ?? [];
  const query: string = newsData?.query ?? "";
  const fromDate: string = newsData?.fromDate ?? "";
  const toDate: string = newsData?.toDate ?? "";

  // tRPC mutation for article summarization — replaces axios.post /api/summarize
  const summarizeMutation = trpc.inventory.summarizeArticle.useMutation();

  // Generate date tabs for yesterday and past 3 days
  const getDateTabs = (): DateTab[] => {
    const today = new Date();
    return Array.from({ length: 4 }, (_, index) => {
      const targetDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - (index + 1)
        )
      );
      const label =
        index === 0
          ? "Yesterday"
          : targetDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
      return {
        key: index,
        label,
        icon: <Calendar size={12} />,
      };
    });
  };

  const handleSearch = (): void => {
    setSearchQuery(tempSearchQuery);
    setActiveDate(0);
    setIsSearchOpen(false);
    // Query will automatically re-run due to state change
  };

  const handleDateClick = (index: number): void => {
    setActiveDate(index);
    // Query will automatically re-run due to activeDate state change
  };

  const handleSearchModeToggle = (): void => {
    const newMode: "direct" | "summarized" =
      searchMode === "direct" ? "summarized" : "direct";
    setSearchMode(newMode);
  };

  const handleRowToggle = async (article: Article): Promise<void> => {
    const isExpanded = expandedRows[article.link];
    setExpandedRows((prev) => ({
      ...prev,
      [article.link]: !isExpanded,
    }));

    if (!isExpanded && !rowSummaries[article.link]) {
      setRowLoading((prev) => ({ ...prev, [article.link]: true }));
      try {
        const result = await summarizeMutation.mutateAsync({
          content: `${article.title}\n${article.summary}`,
          url: article.link,
        });
        setRowSummaries((prev) => ({
          ...prev,
          [article.link]: {
            summary: result.summary,
            suggestions: result.suggestions,
          },
        }));
      } catch (error) {
        console.error("Error summarizing article:", error);
        setToastProps({
          type: "error",
          message: "Failed to summarize article.",
        });
      } finally {
        setRowLoading((prev) => ({ ...prev, [article.link]: false }));
      }
    }
  };

  const getDateDisplayText = (): string => {
    const today = new Date();
    const targetDate = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - (activeDate + 1)
      )
    );
    const daysDiff = Math.floor(
      (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff === 1) return "yesterday";
    return targetDate.toLocaleDateString();
  };

  const handleClearSearch = (): void => {
    setSearchQuery("");
    setTempSearchQuery("");
    setActiveDate(0);
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <Newspaper size={18} /> News
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Showing news for {getDateDisplayText()}
          </p>

          <div className="mb-6">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 w-full sm:w-auto"
            >
              <Search size={14} />
              Manual Search
              {isSearchOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isSearchOpen && (
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative w-full max-w-md flex-1">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <input
                    type="text"
                    id="search"
                    value={tempSearchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTempSearchQuery(e.target.value)
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder=" "
                    className="peer w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-slate-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300"
                  />
                  <label
                    htmlFor="search"
                    className="absolute left-12 -top-2.5 bg-white px-2 py-0.5 rounded-lg text-sm font-medium text-slate-600 peer-placeholder-shown:top-4 peer-placeholder-shown:left-12 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-focus:-top-2.5 peer-focus:left-12 peer-focus:bg-white peer-focus:text-blue-600 z-10"
                  >
                    Search News (e.g., "China-US tariff conflict")
                  </label>
                </div>
                <button
                  onClick={handleSearchModeToggle}
                  className={`h-[50px] px-4 rounded-lg text-sm font-medium border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[100px] sm:min-w-[120px] ${
                    searchMode === "summarized"
                      ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                      : "text-blue-600 border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  {searchMode === "direct"
                    ? "Direct Search"
                    : "Summarized Search"}
                </button>
                <button
                  onClick={handleSearch}
                  className="h-[50px] px-4 flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 min-w-[100px] sm:min-w-[120px] justify-center"
                >
                  <Search size={14} />
                  Search
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 justify-center max-w-3xl w-full">
            {getDateTabs().map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleDateClick(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[100px] sm:min-w-[120px] justify-center ${
                  activeDate === tab.key
                    ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                    : "text-blue-600 border-blue-200 hover:bg-blue-50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left" aria-label="news table">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-3 py-3 w-10" />
                  <th className="px-3 py-3 text-sm font-semibold text-slate-800">Title</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-800">Source</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-800">Date</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-800">Link</th>
                </tr>
              </thead>
              <tbody>
                {newsIsError ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-red-600 font-medium">Failed to load news articles.</p>
                        <button
                          onClick={() => void refetchNews()}
                          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : loading || tableLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-2"><div className="w-6 h-6 rounded bg-slate-200" /></td>
                      <td className="px-3 py-2"><div className="h-4 bg-slate-200 rounded w-3/4" /></td>
                      <td className="px-3 py-2"><div className="h-4 bg-slate-200 rounded w-1/2" /></td>
                      <td className="px-3 py-2"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                      <td className="px-3 py-2"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    </tr>
                  ))
                ) : news.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <div className="max-w-md mx-auto border border-slate-200 rounded-lg p-6">
                        <h3 className="text-base font-semibold text-slate-500 text-center mb-1">
                          No News Articles Found
                        </h3>
                        <p className="text-sm text-slate-500 text-center mb-4">
                          No news articles found for {getDateDisplayText()}.
                          Try adjusting your search query or date.
                        </p>
                        {searchQuery && (
                          <div className="flex justify-center">
                            <button
                              onClick={handleClearSearch}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              Clear Search
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  news.map((article) => (
                    <NewsRow
                      key={article.link}
                      article={article}
                      expandedRows={expandedRows}
                      rowSummaries={rowSummaries}
                      rowLoading={rowLoading}
                      onRowToggle={handleRowToggle}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default News;
