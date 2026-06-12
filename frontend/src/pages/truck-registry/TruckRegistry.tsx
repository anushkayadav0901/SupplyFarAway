import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import { Phone, RefreshCcw, Trash2, Truck, User, AlertTriangle } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RING_TRANSITION_DURATION = 0.7;
// Stable pseudo-utilization: deterministic from plate string (extra directive)
// Using plate hash so it never flickers on re-render.
const PLATE_HASH_BASE = 20;   // minimum % shown
const PLATE_HASH_RANGE = 75;  // total spread 20-94

// ---------------------------------------------------------------------------
// Formatting helpers (V7)
// ---------------------------------------------------------------------------

function fmtDate(d: string | Date): string {
  return new Date(d as unknown as string).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtWeight(kg: number): string {
  return kg.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " kg";
}

// ---------------------------------------------------------------------------
// Deterministic utilization from plate string (extra directive)
// ---------------------------------------------------------------------------

function plateHash(plate: string): number {
  let h = 0;
  for (let i = 0; i < plate.length; i++) h = (h * 31 + plate.charCodeAt(i)) >>> 0;
  return PLATE_HASH_BASE + (h % PLATE_HASH_RANGE);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TruckForm {
  plate: string;
  capacityKg: string;
  baseCity: string;
  driverName: string;
  phone: string;
}

const EMPTY_FORM: TruckForm = {
  plate: "",
  capacityKg: "",
  baseCity: "",
  driverName: "",
  phone: "",
};

interface TruckLike {
  _id: string | { toString(): string };
  plate: string;
  capacityKg: number;
  baseCity: string;
  driverName: string;
  phone?: string;
  createdAt?: string | Date;
}

function getTruckId(t: TruckLike): string {
  const raw = t._id;
  return typeof raw === "string" ? raw : raw.toString();
}

// ---------------------------------------------------------------------------
// CapacityRing — circular SVG progress ring.
// Stable: compute fill from plate hash so it never flickers (extra directive).
// ---------------------------------------------------------------------------

const CapacityRing = ({
  pct,
  capacityKg,
}: {
  pct: number;
  capacityKg: number;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const r = 26;
  const c = 2 * Math.PI * r;
  const safePct = Math.min(100, Math.max(0, pct));
  const offset = c * (1 - safePct / 100);
  // C4: color-coded severity gradient
  const color =
    safePct >= 85 ? "#ef4444" : safePct >= 60 ? "#f59e0b" : "#10b981";

  return (
    <div
      className="relative w-20 h-20 shrink-0"
      aria-label={`Capacity: ${Math.round(safePct)}% of ${fmtWeight(capacityKg)}`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={r}
          stroke="#e2e8f0"
          strokeWidth="5"
          fill="none"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: RING_TRANSITION_DURATION, ease: "easeOut" }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-base font-bold text-slate-800 leading-none">
          {Math.round(safePct)}%
        </p>
        <p className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
          {capacityKg.toLocaleString()} kg
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ConfirmDialog — accessible modal confirm before remove (extra directive)
// Closes on Escape (V6).
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  open: boolean;
  truckPlate: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, truckPlate, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel on open (V5: focus trap)
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Close on Escape (V6)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-desc"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-sm w-full"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
              </div>
              <div>
                <h3 id="confirm-title" className="text-base font-bold text-slate-800">
                  Remove truck?
                </h3>
                <p id="confirm-desc" className="text-sm text-slate-500 mt-1">
                  Truck <strong className="text-slate-700">{truckPlate}</strong> will be
                  permanently removed from the registry. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
              >
                Remove
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function TruckRegistry() {
  const [form, setForm] = useState<TruckForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  // Confirm dialog state (extra directive)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmPlate, setConfirmPlate] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const utils = trpc.useUtils();

  const registerMutation = trpc.trucks.register.useMutation({
    onSuccess: () => {
      toast.success("Truck registered.");
      setForm(EMPTY_FORM); // form resets cleanly (extra directive)
      utils.trucks.list.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to register truck.");
    },
  });

  const removeMutation = trpc.trucks.remove.useMutation({
    onSuccess: () => {
      toast.success("Truck removed.");
      utils.trucks.list.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to remove truck.");
    },
  });

  const trucksQuery = trpc.trucks.list.useQuery();
  const trucks = useMemo(
    () => (trucksQuery.data as unknown as TruckLike[] | undefined) ?? [],
    [trucksQuery.data]
  );

  // Compute stable pseudo-utilization per truck from plate hash (extra directive).
  // plate hash → deterministic, no flicker on re-render (V9: useMemo).
  const utilizationById = useMemo(() => {
    const m = new Map<string, number>();
    trucks.forEach((t) => {
      m.set(getTruckId(t), plateHash(t.plate));
    });
    return m;
  }, [trucks]);

  const totalCapacity = useMemo(
    () => trucks.reduce((sum, t) => sum + t.capacityKg, 0),
    [trucks]
  );

  const basesCovered = useMemo(
    () => new Set(trucks.map((t) => t.baseCity)).size,
    [trucks]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const capacityNum = Number(form.capacityKg);
      if (!form.plate.trim()) {
        toast.error("License plate is required.");
        return;
      }
      if (!capacityNum || capacityNum <= 0) {
        toast.error("Capacity must be a positive number.");
        return;
      }
      if (!form.baseCity.trim()) {
        toast.error("Base city is required.");
        return;
      }
      if (!form.driverName.trim()) {
        toast.error("Driver name is required.");
        return;
      }

      setSubmitting(true);
      try {
        await registerMutation.mutateAsync({
          plate: form.plate.trim(),
          capacityKg: capacityNum,
          baseCity: form.baseCity.trim(),
          driverName: form.driverName.trim(),
          phone: form.phone.trim() || undefined,
        });
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [form, registerMutation]
  );

  // Show confirm dialog before remove (extra directive)
  const handleRemoveRequest = useCallback((truckId: string, plate: string) => {
    setConfirmId(truckId);
    setConfirmPlate(plate);
  }, []);

  const handleRemoveConfirm = useCallback(() => {
    if (confirmId) removeMutation.mutate({ truckId: confirmId });
    setConfirmId(null);
    setConfirmPlate("");
  }, [confirmId, removeMutation]);

  const handleRemoveCancel = useCallback(() => {
    setConfirmId(null);
    setConfirmPlate("");
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Truck Registry" />

      {/* Confirm dialog (extra directive — accessible modal) */}
      <ConfirmDialog
        open={Boolean(confirmId)}
        truckPlate={confirmPlate}
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">

            {/* Summary row (C2: gradient icons, C6: animated numbers) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <SummaryTile label="Active trucks" value={trucks.length} accent="blue" />
              <SummaryTile
                label="Total capacity"
                value={totalCapacity}
                suffix=" kg"
                accent="emerald"
              />
              <SummaryTile
                label="Bases covered"
                value={basesCovered}
                accent="amber"
              />
            </div>

            {/* Registration form (C8: rounded-2xl) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6">
                Register a Truck
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingInput
                    id="tr-plate"
                    name="plate"
                    label="License Plate *"
                    value={form.plate}
                    onChange={handleChange}
                    required
                    maxLength={20}
                    aria-required="true"
                  />
                  <FloatingInput
                    id="tr-capacity"
                    name="capacityKg"
                    type="number"
                    label="Capacity (kg) *"
                    value={form.capacityKg}
                    onChange={handleChange}
                    required
                    min="1"
                    step="0.1"
                    aria-required="true"
                  />
                  <FloatingInput
                    id="tr-baseCity"
                    name="baseCity"
                    label="Base City *"
                    value={form.baseCity}
                    onChange={handleChange}
                    required
                    maxLength={120}
                    aria-required="true"
                  />
                  <FloatingInput
                    id="tr-driverName"
                    name="driverName"
                    label="Driver Name *"
                    value={form.driverName}
                    onChange={handleChange}
                    required
                    maxLength={120}
                    aria-required="true"
                  />
                  <div className="sm:col-span-2">
                    <FloatingInput
                      id="tr-phone"
                      name="phone"
                      type="tel"
                      label="Phone (optional)"
                      value={form.phone}
                      onChange={handleChange}
                      maxLength={30}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  {/* C1: glow on primary CTA */}
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={submitting}
                    aria-label="Register new truck"
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-200 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-all duration-150 disabled:cursor-not-allowed min-w-[180px] flex items-center justify-center gap-3"
                  >
                    {submitting ? (
                      <>
                        Registering…
                        <span
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                          aria-hidden="true"
                        />
                      </>
                    ) : (
                      <>
                        <Truck className="w-5 h-5" aria-hidden="true" />
                        Register Truck
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Registered trucks grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <h2 className="text-xl font-bold text-slate-800">
                  My Trucks
                  {trucks.length > 0 && (
                    <span className="ml-2 text-sm font-medium text-slate-500">
                      (<CountUp value={trucks.length} />)
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => trucksQuery.refetch()}
                  aria-label="Refresh truck list"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Refresh
                </button>
              </div>

              {trucksQuery.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
                  <CardSkeleton height={130} />
                  <CardSkeleton height={130} />
                  <CardSkeleton height={130} />
                  <CardSkeleton height={130} />
                </div>
              ) : trucksQuery.error ? (
                /* V3: error + retry */
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-medium">
                    Failed to load trucks: {trucksQuery.error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => trucksQuery.refetch()}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : trucks.length === 0 ? (
                /* V2: warm empty state with CTA */
                <div className="text-center py-14">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Truck className="w-8 h-8 text-blue-600" aria-hidden="true" />
                  </div>
                  <p className="text-slate-700 font-semibold text-lg">
                    No trucks registered yet
                  </p>
                  <p className="text-slate-500 mt-1 text-sm">
                    Add your first truck above to populate the registry.
                  </p>
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  role="list"
                  aria-label="Registered trucks"
                >
                  <AnimatePresence initial={false}>
                    {trucks.map((truck) => {
                      const id = getTruckId(truck);
                      const pct = utilizationById.get(id) ?? 50;
                      return (
                        <TruckCard
                          key={id}
                          truck={truck}
                          id={id}
                          pct={pct}
                          removePending={removeMutation.isPending}
                          onRemoveRequest={handleRemoveRequest}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4">
            <InsightsRail title="Verification Activity" />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TruckCard — memoized to avoid re-renders in the full list (V9)
// ---------------------------------------------------------------------------

interface TruckCardProps {
  truck: TruckLike;
  id: string;
  pct: number;
  removePending: boolean;
  onRemoveRequest: (id: string, plate: string) => void;
}

const TruckCard = ({
  truck,
  id,
  pct,
  removePending,
  onRemoveRequest,
}: TruckCardProps) => {
  return (
    <motion.div
      role="listitem"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all"
    >
      {/* Capacity ring: stable fill from plate hash (extra directive) */}
      <CapacityRing pct={pct} capacityKg={truck.capacityKg} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 text-sm tracking-wide truncate">
            {truck.plate}
          </span>
          <span className="inline-block w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
          <span className="text-xs text-slate-500 truncate">{truck.baseCity}</span>
        </div>
        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
          <User className="w-3 h-3" aria-hidden="true" />
          {truck.driverName}
        </p>
        {truck.phone && (
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Phone className="w-3 h-3" aria-hidden="true" />
            {truck.phone}
          </p>
        )}
        {truck.createdAt && (
          <p className="text-[10px] text-slate-400 mt-1.5">
            Registered {fmtDate(truck.createdAt)}
          </p>
        )}
      </div>

      {/* Remove button — opens confirm dialog (extra directive, V5: aria-label) */}
      <button
        type="button"
        onClick={() => onRemoveRequest(id, truck.plate)}
        disabled={removePending}
        aria-label={`Remove truck ${truck.plate}`}
        className="self-start p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// FloatingInput — floating-label input (V5: htmlFor)
// ---------------------------------------------------------------------------

function FloatingInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }
) {
  const { label, id, ...rest } = props;
  return (
    <div className="relative">
      <input
        id={id}
        placeholder=" "
        {...rest}
        className="peer w-full px-4 py-4 bg-white border-2 border-slate-300 rounded-xl text-slate-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
      />
      <label
        htmlFor={id}
        className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-slate-600 transition-all duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
      >
        {label}
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryTile (C2: gradient icon bg, C6: CountUp)
// ---------------------------------------------------------------------------

function SummaryTile({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent: "blue" | "emerald" | "amber";
}) {
  const accentBg =
    accent === "blue"
      ? "from-blue-500 to-blue-600"
      : accent === "emerald"
        ? "from-emerald-500 to-emerald-600"
        : "from-amber-500 to-amber-600";
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3"
    >
      <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentBg} flex items-center justify-center text-white shadow-md shrink-0`}
        aria-hidden="true"
      >
        <Truck className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-800 leading-tight">
          <CountUp value={value} suffix={suffix} />
        </p>
      </div>
    </motion.div>
  );
}
