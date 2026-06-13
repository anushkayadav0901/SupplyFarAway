import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Tabs,
  Tab,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  Box,
  Card,
  CardContent,
  Chip,
  Backdrop,
} from "@mui/material";
import {
  Add,
  Delete,
  LocalShipping,
  CheckCircle,
  Warning,
  Schedule,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import Toast from "../../components/Toast";
import { countryOptions } from "../../constants/constants";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Draft {
  _id: string;
  timestamp: string;
  formData?: {
    ShipmentDetails?: {
      "HS Code"?: string;
      "Product Description"?: string;
      "Origin Country"?: string;
      "Destination Country"?: string;
      "Gross Weight"?: string | number;
    };
  };
  statuses?: {
    compliance?: string;
    routeOptimization?: string;
  };
}

interface NewDraftForm {
  originCountry: string;
  destinationCountry: string;
  hsCode: string;
  productDescription: string;
  perishable: boolean;
  hazardous: boolean;
  weight: string;
}

interface FormErrors {
  originCountry?: string;
  destinationCountry?: string;
  hsCode?: string;
  productDescription?: string;
  weight?: string;
}

interface TabCounts {
  all: number;
  "yet-to-be-checked": number;
  "non-compliant": number;
  compliant: number;
  "ready-for-shipment": number;
}

interface ToastProps {
  type: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InventoryManagement: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<string>("all");
  // Reactive viewport width so the responsive tab labels actually update on
  // resize/rotation. Reading window.innerWidth straight in JSX is a one-shot
  // snapshot at mount and never re-evaluates.
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [toastProps, setToastProps] = useState<ToastProps>({
    type: "",
    message: "",
  });
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [newDraft, setNewDraft] = useState<NewDraftForm>({
    originCountry: "",
    destinationCountry: "",
    hsCode: "",
    productDescription: "",
    perishable: false,
    hazardous: false,
    weight: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
  const [deleteDraftId, setDeleteDraftId] = useState<string | null>(null);
  const [deleteEmail, setDeleteEmail] = useState<string>("");
  const [deleteEmailError, setDeleteEmailError] = useState<string>("");
  const [openExportDialog, setOpenExportDialog] = useState<boolean>(false);
  const [exportDraft, setExportDraft] = useState<any | null>(null);
  const navigate = useNavigate();

  // Fetch all tabs in parallel and combine
  const draftQueries = [
    trpc.inventory.getDrafts.useQuery({ tab: "yet-to-be-checked" }),
    trpc.inventory.getDrafts.useQuery({ tab: "compliant" }),
    trpc.inventory.getDrafts.useQuery({ tab: "non-compliant" }),
    trpc.inventory.getDrafts.useQuery({ tab: "ready-for-shipment" }),
  ];

  const loading = draftQueries.some((q) => q.isLoading);

  const allRawDrafts = draftQueries.flatMap((q) => {
    const data = q.data as { drafts?: Draft[] } | undefined;
    return data?.drafts ?? [];
  });

  const standardizedDrafts: Draft[] = allRawDrafts.map((draft) => ({
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

  const uniqueDrafts: Draft[] = Array.from(
    new Map(standardizedDrafts.map((draft) => [draft._id.toString(), draft])).values()
  );

  const tabCounts: TabCounts = {
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
      tabCounts["yet-to-be-checked"]++;
    } else if (compliance === "nonCompliant" && routeOpt === "notDone") {
      tabCounts["non-compliant"]++;
    } else if (compliance === "compliant" && routeOpt === "notDone") {
      tabCounts.compliant++;
    } else if (compliance === "compliant" && routeOpt === "done") {
      tabCounts["ready-for-shipment"]++;
    }
  });

  const createDraftMutation = trpc.inventory.createDraft.useMutation();
  const deleteDraftMutation = trpc.inventory.deleteDraft.useMutation();
  const utils = trpc.useUtils();

  const invalidateDrafts = () => {
    utils.inventory.getDrafts.invalidate();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  const getFilteredDrafts = (): Draft[] => {
    if (activeTab === "all") return uniqueDrafts;

    return uniqueDrafts.filter((draft) => {
      const compliance = draft.statuses?.compliance;
      const routeOpt = draft.statuses?.routeOptimization;
      switch (activeTab) {
        case "yet-to-be-checked":
          return (
            compliance === "notDone" &&
            (routeOpt === "notDone" || routeOpt === "done")
          );
        case "non-compliant":
          return compliance === "nonCompliant" && routeOpt === "notDone";
        case "compliant":
          return compliance === "compliant" && routeOpt === "notDone";
        case "ready-for-shipment":
          return compliance === "compliant" && routeOpt === "done";
        default:
          return false;
      }
    });
  };

  const handleActionClick = (draft: Draft) => {
    const compliance = draft.statuses?.compliance;
    const routeOpt = draft.statuses?.routeOptimization;
    if (compliance === "notDone" || compliance === "nonCompliant") {
      navigate(`/compliance?draftId=${draft._id}`);
    } else if (compliance === "compliant" && routeOpt === "notDone") {
      navigate(`/routes?draftId=${draft._id}`);
    }
  };

  const handleDeleteDraft = async (draftId: string): Promise<void> => {
    const draft = uniqueDrafts.find((d) => d._id === draftId);
    if (
      draft &&
      draft.statuses?.compliance === "compliant" &&
      draft.statuses?.routeOptimization === "done"
    ) {
      setDeleteDraftId(draftId);
      setOpenDeleteDialog(true);
      return;
    }

    await proceedWithDelete(draftId);
  };

  const proceedWithDelete = async (draftId: string): Promise<void> => {
    try {
      await deleteDraftMutation.mutateAsync({ id: draftId });
      setToastProps({
        type: "success",
        message: "Draft deleted successfully.",
      });
      invalidateDrafts();
    } catch (error: unknown) {
      console.error("Error deleting draft:", error);
      const errorMessage =
        (error as unknown as { message?: string })?.message || "Failed to delete draft.";
      setToastProps({ type: "error", message: errorMessage });
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!deleteEmail || !emailRegex.test(deleteEmail)) {
      setDeleteEmailError("Please enter a valid email address.");
      return;
    }

    try {
      const result = await utils.auth.getMe.fetch();
      const userEmail = (result as unknown as { user?: { emailAddress?: string } })?.user?.emailAddress ?? "";

      if (deleteEmail.toLowerCase() !== userEmail.toLowerCase()) {
        setDeleteEmailError("The email does not match your account email.");
        return;
      }

      if (deleteDraftId) {
        await proceedWithDelete(deleteDraftId);
      }
      setOpenDeleteDialog(false);
      setDeleteDraftId(null);
      setDeleteEmail("");
      setDeleteEmailError("");
    } catch (error: unknown) {
      console.error("Error verifying email:", error);
      const errorMessage = (error as unknown as { message?: string })?.message || "Failed to verify email.";
      setDeleteEmailError(errorMessage);
    }
  };

  const handleDeleteCancel = () => {
    setOpenDeleteDialog(false);
    setDeleteDraftId(null);
    setDeleteEmail("");
    setDeleteEmailError("");
  };

  const handleDialogOpen = () => setOpenDialog(true);

  const handleDialogClose = () => {
    setOpenDialog(false);
    setNewDraft({
      originCountry: "",
      destinationCountry: "",
      hsCode: "",
      productDescription: "",
      perishable: false,
      hazardous: false,
      weight: "",
    });
    setFormErrors({});
    setSubmitting(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const checked = type === "checkbox" ? target.checked : undefined;
    setNewDraft((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};
    if (!newDraft.originCountry)
      errors.originCountry = "Origin Country is required";
    if (!newDraft.destinationCountry)
      errors.destinationCountry = "Destination Country is required";
    if (!newDraft.hsCode) errors.hsCode = "HS Code is required";
    if (!newDraft.productDescription)
      errors.productDescription = "Product Description is required";
    if (!newDraft.weight) errors.weight = "Weight is required";
    else if (isNaN(Number(newDraft.weight)) || Number(newDraft.weight) <= 0)
      errors.weight = "Weight must be a positive number";
    return errors;
  };

  const handleCreateDraft = async (): Promise<void> => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await createDraftMutation.mutateAsync({
        originCountry: newDraft.originCountry,
        destinationCountry: newDraft.destinationCountry,
        hsCode: newDraft.hsCode,
        productDescription: newDraft.productDescription,
        perishable: newDraft.perishable,
        hazardous: newDraft.hazardous,
        weight: Number(newDraft.weight),
      });

      setToastProps({
        type: "success",
        message: "Draft created successfully!",
      });
      handleDialogClose();
      invalidateDrafts();
    } catch (error: unknown) {
      console.error("Error creating draft:", error);
      const errorMessage =
        (error as unknown as { message?: string })?.message || "Failed to create draft.";
      setToastProps({ type: "error", message: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (
    compliance: string | undefined,
    routeOpt: string | undefined
  ): React.ReactElement => {
    if (compliance === "compliant" && routeOpt === "done") {
      return <LocalShipping sx={{ color: "#10b981", fontSize: 20 }} />;
    } else if (compliance === "compliant") {
      return <CheckCircle sx={{ color: "#059669", fontSize: 20 }} />;
    } else if (compliance === "nonCompliant") {
      return <Warning sx={{ color: "#dc2626", fontSize: 20 }} />;
    } else {
      return <Schedule sx={{ color: "#f59e0b", fontSize: 20 }} />;
    }
  };

  const getStatusColor = (
    compliance: string | undefined,
    routeOpt: string | undefined
  ): string => {
    if (compliance === "compliant" && routeOpt === "done") {
      return "#10b981";
    } else if (compliance === "compliant") {
      return "#059669";
    } else if (compliance === "nonCompliant") {
      return "#dc2626";
    } else {
      return "#f59e0b";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-2 sm:p-4 md:p-6">
      <Header title="Inventory" page="profile" />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-6 md:py-8">
        {/* Tabs */}
        <Card
          sx={{
            borderRadius: 2,
            boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
            background: "#ffffff",
            mb: 4,
            overflowX: "auto",
          }}
        >
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              overflowX: "auto",
            }}
          >
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                "& .MuiTabs-flexContainer": {
                  justifyContent: { xs: "flex-start", sm: "center" },
                },
                "& .MuiTab-root": {
                  fontWeight: 600,
                  fontSize: { xs: "0.75rem", sm: "0.85rem", md: "0.95rem" },
                  textTransform: "none",
                  minHeight: { xs: 40, sm: 48 },
                  minWidth: { xs: 90, sm: 120 },
                  padding: { xs: "8px 12px", sm: "12px 16px" },
                  color: "#64748b",
                  "&.Mui-selected": {
                    color: "#0f172a",
                    background: "#f1f5f9",
                  },
                },
                "& .MuiTabs-indicator": {
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: "#2563eb",
                },
                "& .MuiTabs-scrollButtons": {
                  width: { xs: 30, sm: 40 },
                  color: "#3b82f6",
                  "&.Mui-disabled": { opacity: 0.3 },
                },
              }}
            >
              <Tab label={`All (${tabCounts.all})`} value="all" />
              <Tab
                label={
                  viewportWidth < 600
                    ? `Pending (${tabCounts["yet-to-be-checked"]})`
                    : `Yet to be Checked (${tabCounts["yet-to-be-checked"]})`
                }
                value="yet-to-be-checked"
              />
              <Tab
                label={`Non-compliant (${tabCounts["non-compliant"]})`}
                value="non-compliant"
              />
              <Tab
                label={`Compliant (${tabCounts.compliant})`}
                value="compliant"
              />
              <Tab
                label={
                  viewportWidth < 600
                    ? `Ready (${tabCounts["ready-for-shipment"]})`
                    : `Ready for Shipment (${tabCounts["ready-for-shipment"]})`
                }
                value="ready-for-shipment"
              />
            </Tabs>
          </Box>
        </Card>

        <div className="space-y-4 sm:space-y-6" style={{ minHeight: 400 }}>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-5 h-5 bg-gray-200 rounded-full" />
                    <div className="h-5 bg-gray-200 rounded w-24" />
                    <div className="h-5 bg-gray-200 rounded-full w-20 ml-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-4 bg-gray-100 rounded w-full" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : getFilteredDrafts().length === 0 ? (
            <Card
              sx={{
                borderRadius: 3,
                p: { xs: 4, sm: 6 },
                textAlign: "center",
                background: "#ffffff",
                boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: "#64748b",
                  mb: 1,
                  fontSize: { xs: "1.1rem", sm: "1.25rem" },
                }}
              >
                {activeTab === "non-compliant"
                  ? "No non-compliant drafts"
                  : activeTab === "compliant"
                  ? "No compliant drafts yet"
                  : activeTab === "ready-for-shipment"
                  ? "Nothing ready for shipment yet"
                  : "No drafts available"}
              </Typography>
              <Typography
                sx={{ color: "#94a3b8", fontSize: { xs: "0.9rem", sm: "1rem" }, mb: 3 }}
              >
                {activeTab === "yet-to-be-checked"
                  ? "Create your first draft to get started!"
                  : activeTab === "non-compliant"
                  ? "Great job — no compliance issues found."
                  : activeTab === "compliant"
                  ? "Once a draft passes compliance, it will appear here."
                  : activeTab === "ready-for-shipment"
                  ? "Compliant drafts with an optimized route will appear here."
                  : "No drafts match this category."}
              </Typography>
              {activeTab !== "yet-to-be-checked" && (
                <Button
                  variant="outlined"
                  onClick={() => setActiveTab("yet-to-be-checked")}
                  sx={{
                    borderColor: "#2563eb",
                    color: "#2563eb",
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    "&:hover": { borderColor: "#1d4ed8", color: "#1d4ed8", backgroundColor: "rgba(37,99,235,0.06)" },
                    "&:focus-visible": { outline: "2px solid #2563eb", outlineOffset: 2 },
                  }}
                >
                  View pending drafts
                </Button>
              )}
            </Card>
          ) : (
            <AnimatePresence initial={false}>
            {getFilteredDrafts().map((draft, index) => (
              <motion.div
                key={draft._id}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0 }}
                transition={{ duration: 0.15, delay: prefersReducedMotion ? 0 : Math.min(index * 0.05, 0.2) }}
              >
                <Card
                  sx={{
                    borderRadius: 3,
                    background: "#ffffff",
                    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
                    border: "1px solid #e2e8f0",
                    transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {getStatusIcon(
                            draft.statuses?.compliance,
                            draft.statuses?.routeOptimization
                          )}
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              color: "#1e293b",
                              fontSize: { xs: "1rem", sm: "1.1rem" },
                            }}
                          >
                            Draft {index + 1}
                          </Typography>
                          <Chip
                            label={
                              draft.statuses?.compliance === "compliant" &&
                              draft.statuses?.routeOptimization === "done"
                                ? "Ready for Shipment"
                                : draft.statuses?.compliance === "compliant"
                                ? "Compliant"
                                : draft.statuses?.compliance === "nonCompliant"
                                ? "Non-compliant"
                                : "Pending Review"
                            }
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(
                                draft.statuses?.compliance,
                                draft.statuses?.routeOptimization
                              ),
                              color: "white",
                              fontWeight: 600,
                              fontSize: { xs: "0.65rem", sm: "0.75rem" },
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#64748b",
                                fontWeight: 600,
                                fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              }}
                            >
                              HS Code
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#1e293b",
                                fontWeight: 500,
                                fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              }}
                            >
                              {draft.formData?.ShipmentDetails?.["HS Code"] ||
                                "N/A"}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#64748b",
                                fontWeight: 600,
                                fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              }}
                            >
                              Created
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#1e293b",
                                fontWeight: 500,
                                fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              }}
                            >
                              {new Date(draft.timestamp).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </div>

                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#64748b",
                              fontWeight: 600,
                              fontSize: { xs: "0.85rem", sm: "0.9rem" },
                            }}
                          >
                            Product Description
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#1e293b",
                              fontWeight: 500,
                              mt: 0.5,
                              fontSize: { xs: "0.85rem", sm: "0.9rem" },
                            }}
                          >
                            {draft.formData?.ShipmentDetails?.[
                              "Product Description"
                            ] || "N/A"}
                          </Typography>
                        </Box>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        {!(draft.statuses?.compliance === "compliant" &&
                          draft.statuses?.routeOptimization === "done") && (
                          <Button
                            variant="contained"
                            onClick={() => handleActionClick(draft)}
                            sx={{
                              backgroundColor: "#2563eb",
                              borderRadius: 2,
                              textTransform: "none",
                              fontWeight: 600,
                              px: { xs: 2, sm: 3 },
                              py: 1,
                              fontSize: { xs: "0.75rem", sm: "0.875rem" },
                              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                              transition: "background-color 150ms ease-out, box-shadow 150ms ease-out",
                              "&:hover": {
                                backgroundColor: "#1d4ed8",
                                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
                              },
                              "&:focus-visible": { outline: "2px solid #2563eb", outlineOffset: 2 },
                            }}
                          >
                            {draft.statuses?.compliance === "compliant" &&
                            draft.statuses?.routeOptimization === "notDone"
                              ? "Optimize Route"
                              : "Check Compliance"}
                          </Button>
                        )}

                        {draft.statuses?.compliance === "compliant" &&
                          draft.statuses?.routeOptimization === "done" && (
                            <Button
                              variant="contained"
                              onClick={() => {
                                setExportDraft(draft);
                                setOpenExportDialog(true);
                              }}
                              sx={{
                                backgroundColor: "#059669",
                                borderRadius: 2,
                                textTransform: "none",
                                fontWeight: 600,
                                px: { xs: 2, sm: 3 },
                                py: 1,
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                                transition: "background-color 150ms ease-out, box-shadow 150ms ease-out",
                                "&:hover": {
                                  backgroundColor: "#047857",
                                  boxShadow: "0 4px 12px rgba(5, 150, 105, 0.4)",
                                },
                                "&:focus-visible": { outline: "2px solid #059669", outlineOffset: 2 },
                              }}
                            >
                              Export Report
                            </Button>
                          )}

                        <IconButton
                          onClick={() => handleDeleteDraft(draft._id)}
                          aria-label={`Delete draft ${index + 1}`}
                          sx={{
                            color: "#ef4444",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            borderRadius: 2,
                            transition: "background-color 150ms ease-out",
                            "&:hover": {
                              backgroundColor: "rgba(239, 68, 68, 0.2)",
                            },
                            "&:focus-visible": {
                              outline: "2px solid #ef4444",
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            </AnimatePresence>
          )}
        </div>

        {activeTab === "yet-to-be-checked" && (
          <Button
            variant="contained"
            onClick={handleDialogOpen}
            aria-label="Create new draft"
            sx={{
              position: "fixed",
              bottom: { xs: 16, sm: 24 },
              left: { xs: 16, sm: 24 },
              borderRadius: "50%",
              width: { xs: 48, sm: 64 },
              height: { xs: 48, sm: 64 },
              minWidth: 0,
              backgroundColor: "#2563eb",
              boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
              transition: "transform 150ms ease-out, box-shadow 150ms ease-out, background-color 150ms ease-out",
              "&:hover": {
                backgroundColor: "#1d4ed8",
                transform: "scale(1.04)",
                boxShadow: "0 6px 20px rgba(37, 99, 235, 0.45)",
              },
              "&:focus-visible": {
                outline: "2px solid #2563eb",
                outlineOffset: 2,
              },
            }}
          >
            <Add sx={{ fontSize: { xs: 24, sm: 28 } }} />
          </Button>
        )}

        {/* Export Report Dialog */}
        <Dialog
          open={openExportDialog}
          onClose={() => setOpenExportDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3, p: 2 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, textAlign: "center" }}>
            Shipment Manifest Report
          </DialogTitle>
          <DialogContent>
            {exportDraft && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", color: "#334155" }}>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px border #e2e8f0", fontFamily: "monospace", fontSize: "12px" }}>
                  <p><strong>Draft ID:</strong> {exportDraft._id}</p>
                  <p><strong>Created:</strong> {new Date(exportDraft.createdAt).toLocaleString()}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Origin</p>
                    <p style={{ fontWeight: 600, color: "#1e293b" }}>{exportDraft.originCountry}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Destination</p>
                    <p style={{ fontWeight: 600, color: "#1e293b" }}>{exportDraft.destinationCountry}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Weight</p>
                    <p style={{ fontWeight: 600, color: "#1e293b" }}>{exportDraft.weight} kg</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>HS Code</p>
                    <p style={{ fontWeight: 600, color: "#1e293b" }}>{exportDraft.hsCode || "N/A"}</p>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Cargo Description</p>
                  <p style={{ color: "#1e293b" }}>{exportDraft.productDescription}</p>
                </div>
                <div style={{ padding: "12px", borderRadius: "12px", border: "1px solid #a7f3d0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 600, backgroundColor: "#ecfdf5", color: "#065f46" }}>
                  <span>Regulatory Review:</span>
                  <span style={{ textTransform: "uppercase" }}>Approved &amp; Compliant</span>
                </div>
              </div>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
            <Button
              onClick={() => {
                if (!exportDraft) return;
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportDraft, null, 2));
                const downloadAnchor = document.createElement("a");
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `shipment-report-${exportDraft._id}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Download JSON
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outlined"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Print Manifest
            </Button>
            <Button
              onClick={() => setOpenExportDialog(false)}
              variant="text"
              sx={{ textTransform: "none", fontWeight: 600, color: "#64748b" }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={handleDeleteCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle
            sx={{
              backgroundColor: "#ef4444",
              color: "white",
              fontWeight: 700,
              textAlign: "center",
              fontSize: "1.25rem",
              py: 2,
            }}
          >
            Warning: Deleting Draft
          </DialogTitle>
          <DialogContent sx={{ p: 4, mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              This choice may negatively affect your sustainability rating and
              disrupt overall analysis records.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              Please enter your email to proceed:
            </Typography>
            <TextField
              fullWidth
              label="Email"
              value={deleteEmail}
              onChange={(e) => {
                setDeleteEmail(e.target.value);
                setDeleteEmailError("");
              }}
              error={!!deleteEmailError}
              helperText={deleteEmailError}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </DialogContent>
          <DialogActions
            sx={{ p: 4, justifyContent: "space-between", gap: 2 }}
          >
            <Button
              onClick={handleDeleteCancel}
              variant="outlined"
              sx={{
                borderColor: "#64748b",
                color: "#64748b",
                borderRadius: 2,
                px: 4,
                py: 1,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Draft Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleDialogClose}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              background: "#ffffff",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              m: { xs: 1, sm: 2 },
              width: { xs: "90%", sm: "80%", md: "70%" },
            },
          }}
          BackdropProps={{
            sx: {
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            },
          }}
        >
          <DialogTitle
            sx={{
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: 700,
              textAlign: "center",
              fontSize: { xs: "1.25rem", sm: "1.5rem" },
              py: { xs: 2, sm: 3 },
            }}
          >
            Create New Draft
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 3, sm: 4 }, mt: 2 }}>
            <div className="w-full flex flex-col gap-4 items-center justify-center">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateDraft();
                }}
                className="w-full bg-white rounded-xl p-4 sm:p-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full">
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Origin Country</label>
                    <select
                      name="originCountry"
                      value={newDraft.originCountry}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 appearance-none"
                    >
                      <option value="" disabled>
                        Select Origin Country
                      </option>
                      {countryOptions.map(
                        (option: { value: string; label: string }) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                    <Typography color="error" variant="caption" sx={{ minHeight: "1.2em", display: "block" }}>
                      {formErrors.originCountry || " "}
                    </Typography>
                  </div>


                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Destination Country</label>
                    <select
                      name="destinationCountry"
                      value={newDraft.destinationCountry}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 appearance-none"
                    >
                      <option value="" disabled>
                        Select Destination
                      </option>
                      {countryOptions.map(
                        (option: { value: string; label: string }) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                    <Typography color="error" variant="caption" sx={{ minHeight: "1.2em", display: "block" }}>
                      {formErrors.destinationCountry || " "}
                    </Typography>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full mt-2">
                  <div className="w-full">
                    <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      id="weight"
                      name="weight"
                      value={newDraft.weight}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.1"
                      placeholder="e.g. 500"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                    />
                    <Typography color="error" variant="caption" sx={{ minHeight: "1.2em", display: "block" }}>
                      {formErrors.weight || " "}
                    </Typography>
                  </div>
                </div>

                <div className="w-full mt-4">
                  <label htmlFor="productDescription" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Product Description
                  </label>
                  <textarea
                    id="productDescription"
                    name="productDescription"
                    value={newDraft.productDescription}
                    onChange={handleInputChange}
                    required
                    placeholder="Describe the product (e.g. Electronic components for assembly)"
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                  />
                  <Typography color="error" variant="caption" sx={{ minHeight: "1.2em", display: "block" }}>
                    {formErrors.productDescription || " "}
                  </Typography>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="perishable"
                        checked={newDraft.perishable}
                        onChange={handleInputChange}
                        sx={{
                          color: "#3b82f6",
                          "&.Mui-checked": { color: "#3b82f6" },
                        }}
                      />
                    }
                    label="Perishable"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="hazardous"
                        checked={newDraft.hazardous}
                        onChange={handleInputChange}
                        sx={{
                          color: "#3b82f6",
                          "&.Mui-checked": { color: "#3b82f6" },
                        }}
                      />
                    }
                    label="Hazardous"
                  />
                </div>

                <div className="mt-6 sm:mt-8 flex justify-center">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="relative px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed min-w-[200px] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <span className="flex items-center justify-center gap-3">
                      {submitting ? "Creating..." : "Create Draft"}
                      {submitting && (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default InventoryManagement;
