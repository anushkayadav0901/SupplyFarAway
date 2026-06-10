import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaNewspaper,
  FaSearch,
  FaCalendarAlt,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import Header from "../../components/Header";
import Toast from "./../../components/Toast";
import { trpc } from "../../lib/trpc";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  IconButton,
  Collapse,
  Button,
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";

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
    error: newsError,
  } = trpc.inventory.getNews.useQuery({
    search: searchQuery || undefined,
    page: activeDate + 1,
    searchMode,
  });

  // Handle news fetch errors
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
        icon: <FaCalendarAlt />,
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

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const Row: React.FC<RowProps> = ({
    article,
    expandedRows,
    rowSummaries,
    rowLoading,
    onRowToggle,
  }) => {
    const open = expandedRows[article.link] || false;
    const summaryData = rowSummaries[article.link] || {};
    const isRowLoading = rowLoading[article.link] || false;

    return (
      <>
        <TableRow className="hover:bg-gray-50 transition-colors duration-150">
          <TableCell>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => onRowToggle(article)}
            >
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          </TableCell>
          <TableCell>{article.title}</TableCell>
          <TableCell>{article.source}</TableCell>
          <TableCell>{new Date(article.date).toLocaleDateString()}</TableCell>
          <TableCell>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Read More
            </a>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  margin: 2,
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                {isRowLoading ? (
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">
                      Summary
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {summaryData.summary || "No summary available"}
                    </p>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">
                      Suggestions
                    </h3>
                    <p className="text-sm text-gray-600">
                      {summaryData.suggestions || "No suggestions available"}
                    </p>
                  </>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      <Header title="News" />
      {loading ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <FaNewspaper /> News
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Showing news for {getDateDisplayText()}
            </p>

            <div className="mb-6">
              <Button
                variant="outlined"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="w-full sm:w-auto bg-white text-[#00467F] border-[#A5CC82] hover:bg-[#F0F8F4] flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-md transition duration-200"
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  minWidth: { xs: "100%", sm: "200px" },
                  fontSize: { xs: "0.75rem", sm: "0.875rem" },
                }}
              >
                <FaSearch />
                Manual Search
                {isSearchOpen ? <FaChevronUp /> : <FaChevronDown />}
              </Button>
              <Collapse in={isSearchOpen} timeout="auto" unmountOnExit>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <div className="relative w-full max-w-md flex-1">
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                    <input
                      type="text"
                      id="search"
                      value={tempSearchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTempSearchQuery(e.target.value)
                      }
                      placeholder=" "
                      className="peer w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 hover:border-gray-300"
                    />
                    <label
                      htmlFor="search"
                      className="absolute left-12 -top-2.5 bg-white px-2 py-0.5 rounded-lg text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-12 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-12 peer-focus:bg-white peer-focus:text-blue-600 z-10"
                    >
                      Search News (e.g., "China-US tariff conflict")
                    </label>
                  </div>
                  <Button
                    variant={
                      searchMode === "summarized" ? "contained" : "outlined"
                    }
                    onClick={handleSearchModeToggle}
                    className={`
                      ${
                        searchMode === "summarized"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-blue-600 border-blue-500 hover:bg-blue-50"
                      }
                      flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2
                    `}
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                      boxShadow:
                        searchMode === "summarized"
                          ? "0 4px 6px rgba(0,0,0,0.1)"
                          : "none",
                      height: "50px",
                      minWidth: { xs: "100px", sm: "120px" },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    }}
                  >
                    {searchMode === "direct"
                      ? "Direct Search"
                      : "Summarized Search"}
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSearch}
                    startIcon={<FaSearch />}
                    sx={{
                      height: "50px",
                      borderRadius: "12px",
                      minWidth: { xs: "100px", sm: "120px" },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    }}
                  >
                    Search
                  </Button>
                </div>
              </Collapse>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 justify-center max-w-3xl w-full">
              {getDateTabs().map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeDate === tab.key ? "contained" : "outlined"}
                  onClick={() => handleDateClick(tab.key)}
                  className={`
                    ${
                      activeDate === tab.key
                        ? "bg-[#00467F] text-white"
                        : "bg-white text-[#00467F] border border-[#A5CC82] hover:bg-[#F0F8F4]"
                    }
                    flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-md transition duration-200
                  `}
                  sx={{
                    borderRadius: "8px",
                    textTransform: "none",
                    boxShadow:
                      activeDate === tab.key
                        ? "0 4px 6px rgba(0,0,0,0.1)"
                        : "none",
                    minWidth: { xs: "100px", sm: "120px" },
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>

            <TableContainer
              component={Paper}
              sx={{ boxShadow: "none", border: "1px solid rgba(0, 0, 0, 0.1)", overflowX: "auto" }}
            >
              <Table aria-label="news table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                    <TableCell />
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Title
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Source
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Date
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Link
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : news.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <Card
                          sx={{
                            maxWidth: "500px",
                            margin: "16px auto",
                            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                          }}
                        >
                          <CardContent>
                            <Typography
                              variant="h6"
                              color="textSecondary"
                              align="center"
                            >
                              No News Articles Found
                            </Typography>
                            <Typography
                              variant="body2"
                              color="textSecondary"
                              align="center"
                            >
                              No news articles found for {getDateDisplayText()}.
                              Try adjusting your search query or date.
                            </Typography>
                          </CardContent>
                        </Card>
                      </TableCell>
                    </TableRow>
                  ) : (
                    news.map((article) => (
                      <Row
                        key={article.link}
                        article={article}
                        expandedRows={expandedRows}
                        rowSummaries={rowSummaries}
                        rowLoading={rowLoading}
                        onRowToggle={handleRowToggle}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </motion.div>
      )}
      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default News;
