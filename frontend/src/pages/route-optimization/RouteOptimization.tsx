import React, { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import { FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import MapIcon from "@mui/icons-material/Map";
import SaveIcon from "@mui/icons-material/Save";
import Co2Icon from "@mui/icons-material/Co2";
import RouteIcon from "@mui/icons-material/Route";
import TimerIcon from "@mui/icons-material/Timer";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useLocation } from "react-router-dom";
import RouteResultsSkeleton from "../../components/Skeleton/RouteResultsSkeleton";
import Toast from "./../../components/Toast";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PackageData {
  quantity: string;
  weight: string;
  height: string;
  length: string;
  width: string;
}

interface RouteDirection {
  id: string;
  waypoints: string[];
  state: "land" | "sea" | "air";
  distance?: number;
}

interface Route {
  routeDirections: RouteDirection[];
  totalDistance: number;
  totalCost: number;
  totalTime: number;
  totalTimeDaysRange: string;
  totalCarbonScore: number;
  tag: string | null;
  distanceByLeg: number[];
}

interface ToastProps {
  type: string;
  message: string;
}

interface SelectedRoute {
  route: Route;
  index: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RouteOptimization: React.FC = () => {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [packageData, setPackageData] = useState<PackageData>({
    quantity: "",
    weight: "",
    height: "",
    length: "",
    width: "",
  });
  const [openPackageDialog, setOpenPackageDialog] = useState<boolean>(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [displayedRoutes, setDisplayedRoutes] = useState<Route[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [mapLoading, setMapLoading] = useState<number | null>(null);
  const [carbonLoading, setCarbonLoading] = useState<number | null>(null);
  const [chooseRouteLoading, setChooseRouteLoading] = useState<number | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [isManualEntry, setIsManualEntry] = useState<boolean>(true);
  const [openCarbonWarning, setOpenCarbonWarning] = useState<boolean>(false);
  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute | null>(null);
  const [carbonWarningSeverity, setCarbonWarningSeverity] = useState<string>("");
  const token = localStorage.getItem("token");
  const [toastProps, setToastProps] = useState<ToastProps>({ type: "", message: "" });
  const [saveLoading, setSaveLoading] = useState<number | null>(null);
  const [Description, setDescriptionFlag] = useState<boolean>(true);
  const [chosenRoute, setChosenRoute] = useState<number | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // tRPC mutations / queries
  const generateRoutesMutation = trpc.logistics.generateRoutes.useMutation();
  const processRoutesMutation = trpc.logistics.processRoutes.useMutation();
  const calculateCarbonMutation = trpc.logistics.calculateCarbonFootprint.useMutation();
  const chooseRouteMutation = trpc.logistics.chooseRoute.useMutation();
  const saveRouteMutation = trpc.logistics.saveRoute.useMutation();
  const utils = trpc.useUtils();

  const fetchDraftFromServer = async (draftId: string): Promise<void> => {
    try {
      if (!token) {
        setToastProps({ type: "error", message: "Please log in." });
        navigate("/");
        return;
      }

      const result = await utils.inventory.getDraftById.fetch({ id: draftId });
      const draft = result?.draft;
      if (!draft || !(draft as any).formData?.ShipmentDetails) {
        throw new Error("Invalid draft data received");
      }
      const fd = (draft as any).formData;

      setFrom(fd.ShipmentDetails?.["Origin Country"] || "");
      setTo(fd.ShipmentDetails?.["Destination Country"] || "");
      setDescription(fd.ShipmentDetails?.["Product Description"] || "");
      setPackageData({
        ...(fd.ShipmentDetails?.Package || {
          quantity: "",
          height: "",
          length: "",
          width: "",
        }),
        weight: fd.ShipmentDetails?.["Gross Weight"] || "",
      });

      setIsManualEntry(false);
      setSelectedDraftId((draft as any)._id?.toString() ?? draftId);
    } catch (error: unknown) {
      console.error("Error fetching draft:", error);
      const errorMessage =
        (error as any)?.message || "Failed to fetch draft.";
      setToastProps({ type: "error", message: errorMessage });
      navigate("/inventory-management");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDraft = async () => {
      let draftId = localStorage.getItem("routeDraftId");
      if (!draftId) {
        const params = new URLSearchParams(location.search);
        draftId = params.get("draftId");
      }

      if (draftId) {
        await fetchDraftFromServer(draftId);
      }
    };

    fetchDraft();
  }, [location, navigate]);

  const getTopThreeRoutes = (routeList: Route[], metric: keyof Route): Route[] => {
    return [...routeList]
      .sort((a, b) => (a[metric] as number) - (b[metric] as number))
      .slice(0, 3);
  };

  const handlePackageDialogOpen = () => setOpenPackageDialog(true);
  const handlePackageDialogClose = () => setOpenPackageDialog(false);

  const handlePackageChange = (field: keyof PackageData, value: string) => {
    setPackageData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDescriptionFlag(false);
    if (!token) {
      setToastProps({
        type: "error",
        message: "Please log in to optimize routes.",
      });
      navigate("/");
      return;
    }
    if (
      !from ||
      !to ||
      !description ||
      !packageData.quantity ||
      !packageData.weight ||
      !packageData.height ||
      !packageData.length ||
      !packageData.width ||
      isNaN(parseFloat(packageData.quantity)) ||
      isNaN(parseFloat(packageData.weight)) ||
      isNaN(parseFloat(packageData.height)) ||
      isNaN(parseFloat(packageData.length)) ||
      isNaN(parseFloat(packageData.width)) ||
      parseFloat(packageData.quantity) <= 0 ||
      parseFloat(packageData.weight) <= 0 ||
      parseFloat(packageData.height) <= 0 ||
      parseFloat(packageData.length) <= 0 ||
      parseFloat(packageData.width) <= 0
    ) {
      setToastProps({
        type: "error",
        message:
          "Please fill in all fields: From, To, Description, and Package details (all values must be positive numbers).",
      });
      return;
    }
    setLoading(true);
    setShowResults(false);
    try {
      const data = await generateRoutesMutation.mutateAsync({
        from: from.trim(),
        to: to.trim(),
        package: {
          quantity: parseFloat(packageData.quantity),
          weight: parseFloat(packageData.weight),
          height: parseFloat(packageData.height),
          length: parseFloat(packageData.length),
          width: parseFloat(packageData.width),
        },
        description: description.trim(),
        draftId: selectedDraftId || undefined,
      });

      if (!Array.isArray(data))
        throw new Error("Expected routes array from the backend.");

      const typedData = data as Route[];
      setRoutes(typedData);
      const popularRoutes = typedData
        .filter((route) => route.tag === "popular")
        .slice(0, 3);
      setDisplayedRoutes(popularRoutes);
      setActiveFilter("popular");
      setShowResults(true);
    } catch (error: unknown) {
      console.error("Error fetching routes:", error);
      setToastProps({
        type: "error",
        message: (error as any)?.message || "Failed to fetch routes",
      });
      setTimeout(
        () => setToastProps({ type: "info", message: "Please try again." }),
        2000
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = (filter: string) => {
    setActiveFilter(filter);
    switch (filter) {
      case "popular":
        setDisplayedRoutes(
          routes.filter((route) => route.tag === "popular").slice(0, 3)
        );
        break;
      case "cost":
        setDisplayedRoutes(getTopThreeRoutes(routes, "totalCost"));
        break;
      case "time":
        setDisplayedRoutes(getTopThreeRoutes(routes, "totalTime"));
        break;
      case "carbon":
        setDisplayedRoutes(getTopThreeRoutes(routes, "totalCarbonScore"));
        break;
      default:
        setDisplayedRoutes(
          routes.filter((route) => route.tag === "popular").slice(0, 3)
        );
        break;
    }
  };

  const getCarbonDisplay = (score: number): React.ReactElement => {
    const color =
      score < 33
        ? "text-green-600"
        : score < 66
        ? "text-yellow-600"
        : "text-red-600";
    const arrow =
      score < 50 ? (
        <ArrowDownwardIcon fontSize="small" />
      ) : (
        <ArrowUpwardIcon fontSize="small" />
      );
    return (
      <span className={`flex items-center ${color}`}>
        {arrow}
        {score.toFixed(2)}
      </span>
    );
  };

  const handleMapClick = async (route: Route, index: number): Promise<void> => {
    setMapLoading(index);
    try {
      const routeData = route.routeDirections.map((direction) => ({
        id: direction.id,
        waypoints: direction.waypoints,
        state: direction.state as "land" | "sea" | "air",
      }));
      const response = await processRoutesMutation.mutateAsync({
        routes: routeData,
      });

      const link = document.createElement("a");
      link.href = `/map/${(response as any).draftId}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: unknown) {
      console.error("Error fetching map data:", error);
      setToastProps({ type: "error", message: "Failed to fetch map data." });
    } finally {
      setMapLoading(null);
    }
  };

  const handleCarbonClick = async (route: Route, index: number): Promise<void> => {
    setCarbonLoading(index);
    try {
      const carbonParams = {
        origin: route.routeDirections[0].waypoints[0],
        destination:
          route.routeDirections[route.routeDirections.length - 1].waypoints[1],
        distance: route.totalDistance,
        weight: parseFloat(packageData.weight),
        routeDirections: route.routeDirections.map((d) => ({
          state: d.state,
          waypoints: d.waypoints,
        })),
        distanceByLeg: route.distanceByLeg,
      };
      const response = await calculateCarbonMutation.mutateAsync(carbonParams);

      const link = document.createElement("a");
      link.href = `/carbon-footprint/${(response as any).draftId}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: unknown) {
      console.error("Error fetching carbon data:", error);
      setToastProps({
        type: "error",
        message: (error as any)?.message || "Failed to fetch carbon data.",
      });
    } finally {
      setCarbonLoading(null);
    }
  };

  const handleChooseRouteClick = async (route: Route, index: number): Promise<void> => {
    const carbonScore = route.totalCarbonScore || 0;
    if (carbonScore > 30) {
      setSelectedRoute({ route, index });
      setCarbonWarningSeverity(carbonScore > 60 ? "red" : "yellow");
      setOpenCarbonWarning(true);
      return;
    }

    await proceedWithChooseRoute(route, index);
  };

  const proceedWithChooseRoute = async (route: Route, index: number): Promise<void> => {
    setChooseRouteLoading(index);
    try {
      if (!from || !from.trim()) throw new Error("Origin (from) is required");
      if (!to || !to.trim()) throw new Error("Destination (to) is required");
      if (
        !packageData.quantity ||
        !packageData.weight ||
        !packageData.height ||
        !packageData.length ||
        !packageData.width ||
        isNaN(parseFloat(packageData.quantity)) ||
        isNaN(parseFloat(packageData.weight)) ||
        isNaN(parseFloat(packageData.height)) ||
        isNaN(parseFloat(packageData.length)) ||
        isNaN(parseFloat(packageData.width)) ||
        parseFloat(packageData.quantity) <= 0 ||
        parseFloat(packageData.weight) <= 0 ||
        parseFloat(packageData.height) <= 0 ||
        parseFloat(packageData.length) <= 0 ||
        parseFloat(packageData.width) <= 0
      )
        throw new Error("Package details must be valid positive numbers");
      if (!route || !route.routeDirections || !Array.isArray(route.routeDirections))
        throw new Error("Route data is invalid");

      let draftId = selectedDraftId;
      if (!draftId) {
        const params = new URLSearchParams(location.search);
        draftId = params.get("draftId");
      }

      const requestBody: {
        draftId?: string;
        routeData: {
          routeDirections: RouteDirection[];
          totalCost: number;
          totalTime: number;
          totalDistance: number;
          totalCarbonScore: number;
          distanceByLeg: number[];
          tag: string | null;
        };
        formData?: {
          from: string;
          to: string;
          package: { weight: number };
        };
      } = {
        draftId: draftId || undefined,
        routeData: {
          routeDirections: route.routeDirections,
          totalCost: route.totalCost,
          totalTime: route.totalTime,
          totalDistance: route.totalDistance,
          totalCarbonScore: route.totalCarbonScore,
          distanceByLeg: route.distanceByLeg,
          tag: route.tag,
        },
      };

      if (isManualEntry || !draftId) {
        requestBody.formData = {
          from: from.trim(),
          to: to.trim(),
          package: {
            weight: parseFloat(packageData.weight),
          },
        };
      }

      const response = await chooseRouteMutation.mutateAsync(requestBody);
      setToastProps({ type: "success", message: (response as any).message });
      setChosenRoute(index);
      setTimeout(() => navigate("/inventory-management"), 2000);
    } catch (error: unknown) {
      console.error("Error choosing route:", error);
      const errorMessage =
        (error as any)?.message || "Failed to choose route.";
      setToastProps({ type: "error", message: errorMessage });
    } finally {
      setChooseRouteLoading(null);
    }
  };

  const handleCarbonWarningConfirm = () => {
    setOpenCarbonWarning(false);
    if (selectedRoute) {
      proceedWithChooseRoute(selectedRoute.route, selectedRoute.index);
    }
    setSelectedRoute(null);
  };

  const handleCarbonWarningCancel = () => {
    setOpenCarbonWarning(false);
    setChooseRouteLoading(null);
    setSelectedRoute(null);
  };

  const handleSaveClick = async (route: Route, index: number): Promise<void> => {
    if (!token) {
      setToastProps({ type: "error", message: "Please log in to save routes." });
      navigate("/");
      return;
    }
    if (!from || !to || !packageData.quantity || !description) {
      setToastProps({
        type: "error",
        message: "Please fill all fields (From, To, Package, Description) before saving a route.",
      });
      return;
    }

    setSaveLoading(index);
    try {
      const formData = {
        from,
        to,
        package: {
          weight: parseFloat(packageData.weight),
        },
      };
      const routeData = route as unknown as Record<string, unknown>;

      const response = await saveRouteMutation.mutateAsync({ formData, routeData });
      setToastProps({
        type: "success",
        message: "Route saved successfully! Check your profile for history.",
      });
    } catch (error: unknown) {
      console.error("Error saving route:", error);
      const errorMessage = (error as any)?.message || "Unknown error";
      setToastProps({
        type: "error",
        message: `Failed to save route: ${errorMessage}`,
      });
    } finally {
      setSaveLoading(null);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-neutral-100 p-4 sm:p-6 flex flex-col items-center">
        <Header title="Route Optimization" />

        <div className="w-full max-w-4xl mt-6 flex flex-col gap-4 mb-6 sm:mb-8 items-center justify-center">
          <form
            onSubmit={handleSubmit}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row gap-6 w-full justify-center items-center">
              {/* From Input */}
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  id="from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                  placeholder=" "
                  disabled={showResults}
                  className="peer w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="from"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  From
                </label>
              </div>

              {/* To Input */}
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                  placeholder=" "
                  disabled={showResults}
                  className="peer w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="to"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  To
                </label>
              </div>

              {/* Description Input */}
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder=" "
                  disabled={showResults}
                  className="peer w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="description"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  Description
                </label>
              </div>

              {/* Package Input */}
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  id="package"
                  value={
                    packageData.quantity
                      ? `Package: ${packageData.quantity} unit(s)`
                      : ""
                  }
                  onClick={handlePackageDialogOpen}
                  readOnly
                  placeholder=" "
                  disabled={showResults}
                  className="peer w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="package"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  Package
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex justify-center">
              <button
                type="submit"
                disabled={loading || showResults}
                className="relative px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed min-w-[200px] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <span className="flex items-center justify-center gap-3">
                  Optimize Routes
                  {loading && (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  )}
                </span>
              </button>
            </div>
          </form>

          {/* Package Dialog */}
          <Dialog open={openPackageDialog} onClose={handlePackageDialogClose}>
            <DialogTitle>Package Details</DialogTitle>
            <DialogContent>
              <TextField
                label="Quantity (units)"
                type="number"
                value={packageData.quantity}
                onChange={(e) =>
                  handlePackageChange("quantity", e.target.value)
                }
                fullWidth
                margin="normal"
                required
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Weight (kg)"
                type="number"
                value={packageData.weight}
                onChange={(e) => handlePackageChange("weight", e.target.value)}
                fullWidth
                margin="normal"
                required
                inputProps={{ min: 0.1, step: 0.1 }}
              />
              <TextField
                label="Height (cm)"
                type="number"
                value={packageData.height}
                onChange={(e) => handlePackageChange("height", e.target.value)}
                fullWidth
                margin="normal"
                required
                inputProps={{ min: 0.1, step: 0.1 }}
              />
              <TextField
                label="Length (cm)"
                type="number"
                value={packageData.length}
                onChange={(e) => handlePackageChange("length", e.target.value)}
                fullWidth
                margin="normal"
                required
                inputProps={{ min: 0.1, step: 0.1 }}
              />
              <TextField
                label="Width (cm)"
                type="number"
                value={packageData.width}
                onChange={(e) => handlePackageChange("width", e.target.value)}
                fullWidth
                margin="normal"
                required
                inputProps={{ min: 0.1, step: 0.1 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handlePackageDialogClose}>Cancel</Button>
              <Button onClick={handlePackageDialogClose} color="primary">
                Save
              </Button>
            </DialogActions>
          </Dialog>
        </div>

        <AnimatePresence>
        {Description && (
          <motion.div
            key="route-info-panel"
            initial={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: "hidden" }}
            transition={{ duration: 0.2, ease: "easeIn" }}
            className="w-full max-w-4xl mt-8 mb-6 sm:mb-8"
          >
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0M15 17a2 2 0 104 0"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold ">Route Optimization Info</h3>
              </div>

              <div className="mb-8">
                <p className="text-gray-700 text-lg leading-relaxed">
                  Enter{" "}
                  <span className="font-semibold text-green-700">Origin</span>,{" "}
                  <span className="font-semibold text-blue-700">
                    Destination
                  </span>
                  ,{" "}
                  <span className="font-semibold text-green-700">
                    Description
                  </span>
                  , and{" "}
                  <span className="font-semibold text-blue-700">Package</span>{" "}
                  details to calculate the most efficient shipping route.
                </p>
                <p className="text-gray-600 mt-3 text-base">
                  Our system prioritizes{" "}
                  <span className="font-semibold text-green-600">
                    carbon-efficient routes
                  </span>{" "}
                  to support sustainable logistics.
                </p>
              </div>

              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Optimization Options:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:bg-white hover:shadow-sm transition-colors duration-150">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-600 text-xl">✅</span>
                      <h5 className="font-semibold text-green-700">
                        Cost-Optimized
                      </h5>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Lowest estimated shipping cost
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:bg-white hover:shadow-sm transition-colors duration-150">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-blue-600 text-xl">⏱️</span>
                      <h5 className="font-semibold text-blue-700">
                        Time-Optimized
                      </h5>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Fastest delivery route
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:bg-white hover:shadow-sm transition-colors duration-150">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-600 text-xl">🌱</span>
                      <h5 className="font-semibold text-green-700">
                        Carbon-Efficient
                      </h5>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Route with the lowest CO₂ emissions
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0 mt-1">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">
                      AI-Driven Calculations
                    </h5>
                    <p className="text-gray-600 leading-relaxed">
                      Our system uses real-time data from{" "}
                      <span className="font-semibold text-blue-600">
                        Google Maps API
                      </span>
                      , transport networks, and historical trends to provide the
                      most accurate route optimization.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <RouteResultsSkeleton />
          </motion.div>
        )}
        {showResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full flex flex-col items-center"
          >
            <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 justify-center max-w-3xl w-full">
              {[
                {
                  key: "popular",
                  label: "Popular Routes",
                  icon: <RouteIcon />,
                },
                {
                  key: "cost",
                  label: "Cost Optimized",
                  icon: <AttachMoneyIcon />,
                },
                { key: "time", label: "Time Optimized", icon: <TimerIcon /> },
                {
                  key: "carbon",
                  label: "Carbon Efficient",
                  icon: <Co2Icon />,
                  className:
                    "bg-gradient-to-r from-greenExtrapolate-400 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-600",
                },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant={
                    activeFilter === filter.key ? "contained" : "outlined"
                  }
                  onClick={() => handleFilterClick(filter.key)}
                  className={`
                    ${
                      activeFilter === filter.key
                        ? filter.className ||
                          "bg-gradient-to-r from-blue-500 to-teal-400"
                        : "bg-white text-blue-500 border-blue-500 hover:bg-blue-50"
                    }
                    flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2
                  `}
                  sx={{
                    borderRadius: "8px",
                    textTransform: "none",
                    boxShadow:
                      activeFilter === filter.key
                        ? "0 4px 6px rgba(0,0,0,0.1)"
                        : "none",
                    minWidth: "120px",
                  }}
                >
                  {filter.icon}
                  {filter.label}
                </Button>
              ))}
            </div>

            <div className="space-y-4 w-full max-w-4xl">
              {displayedRoutes.map((route, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05, ease: "easeOut" }}
                  className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <Typography
                      variant="h6"
                      className="font-semibold text-gray-800 text-base sm:text-lg"
                    >
                      Route {index + 1}
                    </Typography>
                    {route.routeDirections.map((direction) => (
                      <Typography
                        key={direction.id}
                        className="text-sm text-gray-600"
                      >
                        {direction.waypoints.join(" → ")} ({direction.state})
                      </Typography>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="flex flex-wrap justify-center gap-4 sm:gap-6 w-full">
                      <div className="flex flex-col items-center">
                        <Typography className="text-gray-700 text-sm sm:text-base">
                          {route.totalDistance} km
                        </Typography>
                        <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-200 px-2 py-1 rounded-full mt-1">
                          Distance
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Typography className="text-sm sm:text-base">
                          {getCarbonDisplay(route.totalCarbonScore)}
                        </Typography>
                        <span className="text-xs text-gray-500 flex items-center gap-1 bg-green-100 px-2 py-1 rounded-full mt-1">
                          Carbon Score
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Typography className="text-gray-700 text-sm sm:text-base">
                          ${route.totalCost.toFixed(2)}
                        </Typography>
                        <span className="text-xs text-gray-500 flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-full mt-1">
                          Cost
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Typography className="text-gray-700 text-sm sm:text-base">
                          {route.totalTimeDaysRange}
                        </Typography>
                        <span className="text-xs text-gray-500 flex items-center gap-1 bg-blue-100 px-2 py-1 rounded-full mt-1">
                          Time
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 p-2 w-full sm:w-auto justify-start sm:justify-end">
                      {/* Map button */}
                      <Button
                        onClick={() => handleMapClick(route, index)}
                        disabled={mapLoading === index}
                        aria-label={`View map for route ${index + 1}`}
                        sx={{
                          minWidth: "44px",
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          backgroundColor: "#eff6ff",
                          "&:hover": { backgroundColor: "#dbeafe" },
                          "&:focus-visible": { outline: "2px solid #3b82f6", outlineOffset: "2px" },
                        }}
                      >
                        {mapLoading === index ? (
                          <CircularProgress size={20} sx={{ color: "#2563eb" }} />
                        ) : (
                          <MapIcon sx={{ color: "#2563eb" }} />
                        )}
                      </Button>
                      {/* Carbon footprint button */}
                      <Button
                        onClick={() => handleCarbonClick(route, index)}
                        disabled={carbonLoading === index}
                        aria-label={`Calculate carbon footprint for route ${index + 1}`}
                        sx={{
                          minWidth: "44px",
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          backgroundColor: "#f0fdf4",
                          "&:hover": { backgroundColor: "#dcfce7" },
                          "&:focus-visible": { outline: "2px solid #16a34a", outlineOffset: "2px" },
                        }}
                      >
                        {carbonLoading === index ? (
                          <CircularProgress size={20} sx={{ color: "#16a34a" }} />
                        ) : (
                          <Co2Icon sx={{ color: "#16a34a" }} />
                        )}
                      </Button>
                      {/* Save button */}
                      <Button
                        onClick={() => handleSaveClick(route, index)}
                        disabled={saveLoading === index}
                        aria-label={`Save route ${index + 1}`}
                        sx={{
                          minWidth: "44px",
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          backgroundColor: "#f8fafc",
                          "&:hover": { backgroundColor: "#f1f5f9" },
                          "&:focus-visible": { outline: "2px solid #64748b", outlineOffset: "2px" },
                        }}
                      >
                        {saveLoading === index ? (
                          <CircularProgress size={20} sx={{ color: "#475569" }} />
                        ) : (
                          <SaveIcon sx={{ color: "#475569" }} />
                        )}
                      </Button>
                      {/* Choose route button — primary action, blue */}
                      <Button
                        onClick={() => handleChooseRouteClick(route, index)}
                        disabled={chooseRouteLoading === index || chosenRoute === index}
                        aria-label={chosenRoute === index ? `Route ${index + 1} chosen` : `Choose route ${index + 1}`}
                        sx={{
                          minWidth: "44px",
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          backgroundColor: chosenRoute === index ? "#dcfce7" : "#eff6ff",
                          "&:hover": { backgroundColor: chosenRoute === index ? "#bbf7d0" : "#dbeafe" },
                          "&:focus-visible": { outline: "2px solid #2563eb", outlineOffset: "2px" },
                        }}
                      >
                        {chooseRouteLoading === index ? (
                          <CircularProgress size={20} sx={{ color: "#2563eb" }} />
                        ) : (
                          <CheckCircleIcon sx={{ color: chosenRoute === index ? "#16a34a" : "#2563eb" }} />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <Dialog
        open={openCarbonWarning}
        onClose={handleCarbonWarningCancel}
        maxWidth="sm"
        fullWidth
        aria-labelledby="carbon-warning-dialog-title"
        disableEnforceFocus={false}
        disableAutoFocus={false}
      >
        <DialogTitle
          id="carbon-warning-dialog-title"
          component="div"
          sx={{
            backgroundColor:
              carbonWarningSeverity === "warning" ? "#f44336" : "#ffeb3b",
            color: carbonWarningSeverity === "warning" ? "white" : "black",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h5">Carbon Footprint Warning</Typography>
          <IconButton
            onClick={handleCarbonWarningCancel}
            aria-label="Close dialog"
          >
            <FaTimes
              color={carbonWarningSeverity === "Carbon" ? "white" : "black"}
            />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            backgroundColor:
              carbonWarningSeverity === "red" ? "#ffebee" : "#fffde7",
            padding: 3,
          }}
        >
          <Typography variant="body1" sx={{ mb: 2 }}>
            This route may not be the most carbon-efficient option. Consider
            exploring alternative routes to reduce environmental impact and
            support sustainable shipping practices.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Carbon Score: {selectedRoute?.route?.totalCarbonScore || 0}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            backgroundColor:
              carbonWarningSeverity === "red" ? "#ffebee" : "#fffde7",
            padding: 2,
          }}
        >
          <Button
            onClick={handleCarbonWarningCancel}
            variant="outlined"
            color={carbonWarningSeverity === "red" ? "error" : "warning"}
            aria-label="Cancel route selection"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCarbonWarningConfirm}
            variant="contained"
            color={carbonWarningSeverity === "red" ? "error" : "warning"}
            startIcon={<CheckCircleIcon />}
            aria-label="Proceed with route selection"
          >
            Proceed Anyway
          </Button>
        </DialogActions>
      </Dialog>
      <Toast type={toastProps.type} message={toastProps.message} />
    </>
  );
};

export default RouteOptimization;
