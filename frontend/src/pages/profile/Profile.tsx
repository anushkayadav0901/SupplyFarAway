import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaLeaf,
  FaUser,
  FaSearch,
} from "react-icons/fa";
import Toast from "./../../components/Toast";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

// MUI Imports
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Box from "@mui/material/Box";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

interface ToastProps {
  type: string;
  message: string;
}

interface BadgeState {
  tier: string;
  score: number | string;
  details: Record<string, unknown>;
}

interface TabCounts {
  all: number;
  "yet-to-be-checked": number;
  "non-compliant": number;
  compliant: number;
  "ready-for-shipment": number;
}

interface RowProps {
  draft: any;
}

const Row: React.FC<RowProps> = ({ draft }) => {
  const [open, setOpen] = useState<boolean>(false);

  const complianceStatus = !draft.statuses?.compliance
    ? "notDone"
    : draft.statuses.compliance === "compliant"
    ? "compliant"
    : draft.statuses.compliance === "notDone"
    ? "notDone"
    : "nonCompliant";

  const routeStatus = !draft.statuses?.routeOptimization
    ? "notDone"
    : draft.statuses.routeOptimization === "done"
    ? "done"
    : "notDone";

  return (
    <>
      <TableRow
        sx={{ "& > *": { borderBottom: "unset" } }}
        className="hover:bg-gray-50 transition-colors duration-150"
      >
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {draft.formData?.ShipmentDetails?.["Product Description"] || "N/A"}
        </TableCell>
        <TableCell>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              complianceStatus === "compliant"
                ? "bg-green-100 text-green-800"
                : complianceStatus === "nonCompliant"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {complianceStatus === "compliant"
              ? "Compliant"
              : complianceStatus === "nonCompliant"
              ? "Noncompliant"
              : "Not Done"}
          </span>
        </TableCell>
        <TableCell>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              routeStatus === "done"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {routeStatus === "done" ? "Done" : "Not Done"}
          </span>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box
              sx={{
                margin: 2,
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Draft Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Route:</span>{" "}
                  {draft.formData?.ShipmentDetails?.["Origin Country"]} to{" "}
                  {draft.formData?.ShipmentDetails?.["Destination Country"]}
                </p>
                <p>
                  <span className="font-medium">HS Code:</span>{" "}
                  {draft.formData?.ShipmentDetails?.["HS Code"] || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Quantity:</span>{" "}
                  {draft.formData?.ShipmentDetails?.Quantity || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Gross Weight:</span>{" "}
                  {draft.formData?.ShipmentDetails?.["Gross Weight"] || "N/A"}{" "}
                  kg
                </p>
                <p>
                  <span className="font-medium">Shipper:</span>{" "}
                  {draft.formData?.PartiesAndIdentifiers?.[
                    "Shipper/Exporter"
                  ] || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Consignee:</span>{" "}
                  {draft.formData?.PartiesAndIdentifiers?.[
                    "Consignee/Importer"
                  ] || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Timestamp:</span>{" "}
                  {new Date(draft.timestamp).toLocaleDateString()}
                </p>
              </div>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [badge, setBadge] = useState<BadgeState>({ tier: "Bronze", score: 0, details: {} });
  const [filteredDrafts, setFilteredDrafts] = useState<any[]>([]);
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    all: 0,
    "yet-to-be-checked": 0,
    "non-compliant": 0,
    compliant: 0,
    "ready-for-shipment": 0,
  });
  const [status, showBadge] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("2025-06-01");
  const [endDate, setEndDate] = useState<string>("2025-06-30");
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });

  // tRPC queries
  const { data: meData, isLoading: meLoading, isError: meError } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
    enabled: !!localStorage.getItem("token"),
  });

  const { data: draftsData, isLoading: draftsLoading } = trpc.inventory.getDrafts.useQuery(
    {},
    {
      retry: false,
      enabled: !!localStorage.getItem("token"),
    }
  );

  const loading = meLoading || draftsLoading;
  const user = meData?.user;
  const rawDrafts: any[] = draftsData?.drafts ?? [];

  // Redirect if not logged in or error
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
    }
    if (meError) {
      navigate("/");
    }
  }, [navigate, meError]);

  // Process drafts when they change
  useEffect(() => {
    if (!rawDrafts.length) return;

    const tabValues = ["yet-to-be-checked", "compliant", "non-compliant", "ready-for-shipment"];

    const standardizedDrafts = rawDrafts.map((draft) => ({
      ...draft,
      statuses: {
        ...draft.statuses,
        compliance:
          draft.statuses?.compliance === "Ready" ||
          draft.statuses?.compliance === "Compliant"
            ? "compliant"
            : draft.statuses?.compliance,
      },
    }));

    const uniqueDrafts = Array.from(
      new Map(
        standardizedDrafts.map((draft) => [draft._id.toString(), draft])
      ).values()
    );

    const counts: TabCounts = {
      all: uniqueDrafts.length,
      "yet-to-be-checked": 0,
      "non-compliant": 0,
      compliant: 0,
      "ready-for-shipment": 0,
    };

    uniqueDrafts.forEach((draft) => {
      const compliance = draft.statuses?.compliance;
      const routeOpt = draft.statuses?.routeOptimization;
      if (
        compliance === "notDone" &&
        (routeOpt === "notDone" || routeOpt === "done")
      ) {
        counts["yet-to-be-checked"]++;
      } else if (compliance === "nonCompliant" && routeOpt === "notDone") {
        counts["non-compliant"]++;
      } else if (compliance === "compliant" && routeOpt === "notDone") {
        counts.compliant++;
      } else if (compliance === "compliant" && routeOpt === "done") {
        counts["ready-for-shipment"]++;
      }
    });

    uniqueDrafts.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    setFilteredDrafts(uniqueDrafts);
    setTabCounts(counts);

    // Calculate badge
    const compliantAndDoneDrafts = uniqueDrafts.filter(
      (draft) =>
        draft.statuses?.compliance === "compliant" &&
        draft.statuses?.routeOptimization === "done"
    );

    if (compliantAndDoneDrafts.length === 0) {
      showBadge(false);
      return;
    }

    const totalCarbonScore = compliantAndDoneDrafts.reduce(
      (sum: number, draft: any) =>
        sum + (parseFloat(draft.routeData?.totalCarbonScore) || 0),
      0
    );
    const meanCarbonScore = totalCarbonScore / compliantAndDoneDrafts.length;
    const carbonEfficiency = 100 - meanCarbonScore;

    let tier = "Eco Learner";
    if (carbonEfficiency >= 90) tier = "Eco Champion";
    else if (carbonEfficiency >= 75) tier = "Green Advocate";
    else if (carbonEfficiency >= 50) tier = "Sustainable Starter";

    setBadge({
      tier,
      score: carbonEfficiency.toFixed(1),
      details: {
        carbonEfficiency: carbonEfficiency.toFixed(1),
      },
    });
    showBadge(true);
  }, [rawDrafts]);

  // Filter drafts by search and date
  useEffect(() => {
    let filtered = rawDrafts.map((draft) => ({
      ...draft,
      statuses: {
        ...draft.statuses,
        compliance:
          draft.statuses?.compliance === "Ready" ||
          draft.statuses?.compliance === "Compliant"
            ? "compliant"
            : draft.statuses?.compliance,
      },
    }));

    filtered = filtered.filter((draft) => {
      const productDescription =
        draft.formData?.ShipmentDetails?.[
          "Product Description"
        ]?.toLowerCase() || "";
      const hsCode =
        draft.formData?.ShipmentDetails?.["HS Code"]?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      return productDescription.includes(query) || hsCode.includes(query);
    });

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filtered = filtered.filter((draft) => {
        const draftDate = new Date(draft.timestamp);
        return draftDate >= start && draftDate <= end;
      });
    }

    setFilteredDrafts(filtered);
  }, [searchQuery, startDate, endDate, rawDrafts]);

  const handleLogout = (): void => {
    setToastProps({
      type: "success",
      message: "You have successfully logged out!",
    });
    setTimeout(() => {
      navigate("/");
      localStorage.removeItem("token");
    }, 2000);
  };

  const handleNavigation = (path: string): void => {
    navigate(`/${path}/${userId}`);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      <Header title="Profile" />
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
          {/* User Info Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  {user?.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover shadow-lg"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder-image.jpg";
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                      <FaUser className="text-4xl text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {user?.firstName} {user?.lastName}
                  </h1>
                  <p className="text-gray-600 text-lg mb-1">
                    {user?.emailAddress}
                  </p>
                  {status && (
                    <div className="group relative inline-flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          badge.tier === "Eco Champion"
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-700 text-white"
                            : badge.tier === "Green Advocate"
                            ? "bg-gradient-to-r from-lime-400 to-lime-600 text-lime-900"
                            : badge.tier === "Sustainable Starter"
                            ? "bg-gradient-to-r from-yellow-300 to-lime-400 text-lime-800"
                            : "bg-gradient-to-r from-gray-300 to-green-300 text-green-800"
                        }`}
                      >
                        <FaLeaf className="mr-1" /> {badge.tier}
                      </span>
                      <div
                        className="
                          absolute hidden group-hover:block
                          sm:left-full sm:top-0 sm:ml-2
                          left-0 -top-24
                          w-64 bg-green-800 text-white text-sm rounded-lg p-4 shadow-lg z-10
                        "
                      >
                        <p className="font-semibold mb-2">
                          Your Carbon Efficiency:
                        </p>
                        <p>Score: {badge.details.carbonEfficiency as string}%</p>
                        <p className="mt-2 italic">
                          {badge.tier === "Eco Champion"
                            ? "You're an Eco Champion! Your routes are incredibly sustainable—keep leading the way for a greener planet!"
                            : badge.tier === "Green Advocate"
                            ? "Great work, Green Advocate! Optimize more routes to lower your carbon footprint even further!"
                            : badge.tier === "Sustainable Starter"
                            ? "Nice start, Sustainable Starter! Try consolidating shipments or choosing greener transport modes to improve!"
                            : "You're an Eco Learner! Focus on reducing emissions by optimizing routes and using eco-friendly transport!"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors duration-150 shadow-sm"
              >
                <FaSignOutAlt className="text-sm" /> Logout
              </motion.button>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigation("manage-account")}
              className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-4 rounded-xl shadow-sm transition-colors duration-150"
            >
              Manage Account
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigation("history")}
              className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-4 rounded-xl shadow-sm transition-colors duration-150"
            >
              History
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigation("analysis")}
              className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-4 rounded-xl shadow-sm transition-colors duration-150"
            >
              Analysis
            </motion.button>
          </div>

          {/* Drafts Table Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Drafts Overview
            </h2>
            {/* Summary Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">All Drafts</p>
                <p className="text-lg font-semibold text-gray-800">
                  {tabCounts.all}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">Yet to be Checked</p>
                <p className="text-lg font-semibold text-gray-800">
                  {tabCounts["yet-to-be-checked"]}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">Non-Compliant</p>
                <p className="text-lg font-semibold text-gray-800">
                  {tabCounts["non-compliant"]}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">Compliant</p>
                <p className="text-lg font-semibold text-gray-800">
                  {tabCounts.compliant}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">Ready for Shipment</p>
                <p className="text-lg font-semibold text-gray-800">
                  {tabCounts["ready-for-shipment"]}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Creative Search Bar */}
              <div className="relative w-full max-w-md flex-1">
                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder=" "
                  className="peer w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-300 rounded-2xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
                <label
                  htmlFor="search"
                  className="absolute left-12 -top-2.5 bg-white px-2 py-0.5 rounded-lg text-sm font-medium text-gray-600 transition-[top,color] duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-12 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-12 peer-focus:bg-white peer-focus:text-blue-600 z-10"
                >
                  Search by Product or HS Code
                </label>
              </div>

              {/* Date Filters */}
              <div className="flex gap-2 flex-1">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Collapsible Table */}
            <TableContainer
              component={Paper}
              sx={{ overflowX: "auto", boxShadow: "none", border: "1px solid rgba(0, 0, 0, 0.1)" }}
            >
              <Table aria-label="collapsible table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                    <TableCell />
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Description
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Compliance
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#1f2937" }}>
                      Route Optimization
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDrafts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-gray-500"
                      >
                        No drafts found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDrafts.map((draft) => (
                      <Row key={draft._id} draft={draft} />
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

export default Profile;
