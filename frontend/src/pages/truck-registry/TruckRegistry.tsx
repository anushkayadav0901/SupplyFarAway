import { useState } from "react";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";
import { toast } from "react-toastify";

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

export default function TruckRegistry() {
  const [form, setForm] = useState<TruckForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const utils = trpc.useUtils();

  const registerMutation = trpc.trucks.register.useMutation({
    onSuccess: () => {
      toast.success("Truck registered successfully!");
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

  const { data: trucks, isLoading } = trpc.trucks.list.useQuery();

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Register a Truck</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Plate */}
              <div className="relative">
                <input
                  type="text"
                  id="plate"
                  name="plate"
                  value={form.plate}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="peer w-full px-4 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
                <label
                  htmlFor="plate"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  License Plate *
                </label>
              </div>

              {/* Capacity */}
              <div className="relative">
                <input
                  type="number"
                  id="capacityKg"
                  name="capacityKg"
                  value={form.capacityKg}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  min="1"
                  step="0.1"
                  className="peer w-full px-4 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
                <label
                  htmlFor="capacityKg"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  Capacity (kg) *
                </label>
              </div>

              {/* Base City */}
              <div className="relative">
                <input
                  type="text"
                  id="baseCity"
                  name="baseCity"
                  value={form.baseCity}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="peer w-full px-4 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
                <label
                  htmlFor="baseCity"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  Base City *
                </label>
              </div>

              {/* Driver Name */}
              <div className="relative">
                <input
                  type="text"
                  id="driverName"
                  name="driverName"
                  value={form.driverName}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="peer w-full px-4 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
                <label
                  htmlFor="driverName"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  Driver Name *
                </label>
              </div>

              {/* Phone */}
              <div className="relative sm:col-span-2">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder=" "
                  className="peer w-full px-4 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-800 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
                <label
                  htmlFor="phone"
                  className="absolute left-4 -top-2.5 bg-white px-2 py-0.5 rounded text-sm font-medium text-gray-600 transition-colors duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:left-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-500 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:bg-white peer-focus:text-blue-600"
                >
                  Phone (optional)
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-sm transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed min-w-[180px] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <>
                    Registering...
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </>
                ) : (
                  "Register Truck"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Registered Trucks List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            My Trucks
            {trucks && trucks.length > 0 && (
              <span className="ml-2 text-sm font-medium text-slate-500">
                ({trucks.length})
              </span>
            )}
          </h2>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="text-slate-500 font-medium">Loading trucks...</p>
            </div>
          ) : !trucks || trucks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                  />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold text-lg">No trucks registered yet</p>
              <p className="text-slate-400 mt-1 text-sm">
                Use the form above to add your first truck.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trucks.map((truck) => (
                <div
                  key={String(truck._id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all duration-150 bg-slate-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 text-base">
                          {truck.plate}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          {truck.capacityKg.toLocaleString()} kg
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-0.5">
                        <p>
                          <span className="font-medium">Driver:</span>{" "}
                          {truck.driverName}
                        </p>
                        <p>
                          <span className="font-medium">Base City:</span>{" "}
                          {truck.baseCity}
                        </p>
                        {truck.phone && (
                          <p>
                            <span className="font-medium">Phone:</span>{" "}
                            {truck.phone}
                          </p>
                        )}
                      </div>
                      {truck.createdAt && (
                        <p className="text-xs text-slate-400 mt-1">
                          Registered{" "}
                          {new Date(truck.createdAt as unknown as string).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(String(truck._id))}
                    disabled={removeMutation.isPending}
                    aria-label={`Remove truck ${truck.plate}`}
                    className="self-start sm:self-center px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 whitespace-nowrap"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
