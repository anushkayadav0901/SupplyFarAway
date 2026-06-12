import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Phone, RefreshCcw, Trash2, Truck, User } from "lucide-react";

import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

interface TruckForm {
  plate: string;
  capacityKg: string;
  baseCity: string;
  driverName: string;
  phone: string;
}

const emptyForm: TruckForm = {
  plate: "",
  capacityKg: "",
  baseCity: "",
  driverName: "",
  phone: "",
};

// ---------------------------------------------------------------------------
// CapacityRing — circular SVG progress 0-100%
// ---------------------------------------------------------------------------

function CapacityRing({ pct, capacityKg }: { pct: number; capacityKg: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const color =
    pct >= 85 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#10b981";
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
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
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-base font-bold text-slate-800 leading-none">
          {Math.round(pct)}%
        </p>
        <p className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
          {capacityKg.toLocaleString()} kg
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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
  if (typeof raw === "string") return raw;
  return raw.toString();
}

export default function TruckRegistry() {
  const [form, setForm] = useState<TruckForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const utils = trpc.useUtils();

  const registerMutation = trpc.trucks.register.useMutation({
    onSuccess: () => {
      toast.success("Truck registered.");
      setForm(emptyForm);
      utils.trucks.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to register truck.");
    },
  });

  const removeMutation = trpc.trucks.remove.useMutation({
    onSuccess: () => {
      toast.success("Truck removed.");
      utils.trucks.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to remove truck.");
    },
  });

  const trucksQuery = trpc.trucks.list.useQuery();
  const trucks = (trucksQuery.data as unknown as TruckLike[] | undefined) ?? [];

  // Compute a stable pseudo-utilization per truck (no real-time usage data yet).
  // Hash the truck id so the value is consistent across renders.
  const utilizationById = useMemo(() => {
    const m = new Map<string, number>();
    trucks.forEach((t) => {
      const id = getTruckId(t);
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      const pct = 20 + (h % 75);
      m.set(id, pct);
    });
    return m;
  }, [trucks]);

  const totalCapacity = trucks.reduce((sum, t) => sum + t.capacityKg, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      setSubmitting(false);
    }
  };

  const handleRemove = (truckId: string) => {
    if (!confirm("Remove this truck from the registry?")) return;
    removeMutation.mutate({ truckId });
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Truck Registry" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <SummaryTile
                label="Active trucks"
                value={trucks.length}
                accent="blue"
              />
              <SummaryTile
                label="Total capacity"
                value={totalCapacity}
                suffix=" kg"
                accent="emerald"
              />
              <SummaryTile
                label="Bases covered"
                value={new Set(trucks.map((t) => t.baseCity)).size}
                accent="amber"
              />
            </div>

            {/* Registration Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6">
                Register a Truck
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingInput
                    id="plate"
                    name="plate"
                    label="License Plate *"
                    value={form.plate}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    id="capacityKg"
                    name="capacityKg"
                    type="number"
                    label="Capacity (kg) *"
                    value={form.capacityKg}
                    onChange={handleChange}
                    required
                    min="1"
                    step="0.1"
                  />
                  <FloatingInput
                    id="baseCity"
                    name="baseCity"
                    label="Base City *"
                    value={form.baseCity}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    id="driverName"
                    name="driverName"
                    label="Driver Name *"
                    value={form.driverName}
                    onChange={handleChange}
                    required
                  />
                  <div className="sm:col-span-2">
                    <FloatingInput
                      id="phone"
                      name="phone"
                      type="tel"
                      label="Phone (optional)"
                      value={form.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={submitting}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 disabled:cursor-not-allowed min-w-[180px] flex items-center justify-center gap-3"
                  >
                    {submitting ? (
                      <>
                        Registering…
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </>
                    ) : (
                      <>
                        <Truck className="w-5 h-5" />
                        Register Truck
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Registered Trucks Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
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
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {trucksQuery.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CardSkeleton height={130} />
                  <CardSkeleton height={130} />
                  <CardSkeleton height={130} />
                  <CardSkeleton height={130} />
                </div>
              ) : trucksQuery.error ? (
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
                <div className="text-center py-14">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Truck className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-slate-700 font-semibold text-lg">
                    No trucks registered yet
                  </p>
                  <p className="text-slate-500 mt-1 text-sm">
                    Add your first truck to populate the registry and start
                    moving freight.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence initial>
                    {trucks.map((truck) => {
                      const id = getTruckId(truck);
                      const pct = utilizationById.get(id) ?? 50;
                      return (
                        <motion.div
                          key={id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.18 }}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-colors"
                        >
                          <CapacityRing
                            pct={pct}
                            capacityKg={truck.capacityKg}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm tracking-wide truncate">
                                {truck.plate}
                              </span>
                              <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
                              <span className="text-xs text-slate-500 truncate">
                                {truck.baseCity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                              <User className="w-3 h-3" />
                              {truck.driverName}
                            </p>
                            {truck.phone && (
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                <Phone className="w-3 h-3" />
                                {truck.phone}
                              </p>
                            )}
                            {truck.createdAt && (
                              <p className="text-[10px] text-slate-400 mt-1.5">
                                Registered{" "}
                                {new Date(
                                  truck.createdAt as unknown as string
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemove(id)}
                            disabled={removeMutation.isPending}
                            aria-label={`Remove truck ${truck.plate}`}
                            className="self-start p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
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
        className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-slate-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
      >
        {label}
      </label>
    </div>
  );
}

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
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentBg} flex items-center justify-center text-white shadow-md`}
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
