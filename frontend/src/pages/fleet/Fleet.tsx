import React, { useState } from "react";
import { toast } from "react-toastify";
import { Truck, Boxes, Plus, Trash2, Users, RefreshCcw } from "lucide-react";
import PageLead from "../../components/PageLead";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";
import LoadAggregation from "./LoadAggregation";

type Tab = "registry" | "loads";

function plateHash(plate: string): number {
  let h = 0;
  for (let i = 0; i < plate.length; i++) h = (h * 31 + plate.charCodeAt(i)) >>> 0;
  return 20 + (h % 75);
}

export default function Fleet() {
  const [activeTab, setActiveTab] = useState<Tab>("registry");

  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [baseCity, setBaseCity] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const utils = trpc.useUtils();

  const listTrucksQuery = trpc.trucks.list.useQuery();
  const registerTruckMutation = trpc.trucks.register.useMutation({
    onSuccess: () => {
      toast.success("Truck registered.");
      setPlate("");
      setCapacity("");
      setBaseCity("");
      setDriverName("");
      setDriverPhone("");
      utils.trucks.list.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Registration failed.");
    },
  });
  const removeTruckMutation = trpc.trucks.remove.useMutation({
    onSuccess: () => {
      toast.success("Truck removed.");
      utils.trucks.list.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove truck.");
    },
  });

  const handleRegisterTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !capacity.trim() || !baseCity.trim() || !driverName.trim()) {
      toast.error("Please fill in all required truck fields.");
      return;
    }
    await registerTruckMutation.mutateAsync({
      plate: plate.trim().toUpperCase(),
      capacityKg: parseFloat(capacity) || 1000,
      baseCity: baseCity.trim(),
      driverName: driverName.trim(),
      phone: driverPhone.trim() || undefined,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">

      <PageLead
        title="Manage your fleet"
        sub="Register trucks with plate, capacity, and base city. Match small loads sharing corridors so empty backhauls don't waste fuel."
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 pb-px">
        <button
          onClick={() => setActiveTab("registry")}
          className={`flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === "registry"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4" /> Trucks
        </button>
        <button
          onClick={() => setActiveTab("loads")}
          className={`flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === "loads"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Boxes className="w-4 h-4" /> Load Match
        </button>
      </div>

      {activeTab === "registry" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left: Register form — one card, grouped inputs */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-blue-600" /> Register Vehicle
            </h2>
            <form onSubmit={handleRegisterTruck} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">License Plate *</label>
                  <input
                    type="text"
                    placeholder="IL-902-8X"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacity (kg) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Base City *</label>
                <input
                  type="text"
                  placeholder="e.g. Chicago"
                  value={baseCity}
                  onChange={(e) => setBaseCity(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Driver Name *</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Driver Phone</label>
                  <input
                    type="text"
                    placeholder="555-0199"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={registerTruckMutation.isPending}
                className="w-full px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg"
              >
                {registerTruckMutation.isPending ? "Registering..." : "Add to Registry"}
              </button>
            </form>
          </div>

          {/* Right: Fleet directory — flat list, no card wrapper */}
          <section className="lg:col-span-7 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Fleet Directory</h2>
              <button
                onClick={() => listTrucksQuery.refetch()}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {listTrucksQuery.isLoading ? (
              <div className="space-y-3">
                <CardSkeleton height={60} />
                <CardSkeleton height={60} />
              </div>
            ) : listTrucksQuery.data && listTrucksQuery.data.length > 0 ? (
              <div>
                <div className="grid grid-cols-[1fr_auto_auto] text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 px-1">
                  <span>Vehicle / Driver</span>
                  <span className="text-right pr-8">Load</span>
                  <span />
                </div>
                {listTrucksQuery.data.map((truck) => {
                  const pct = plateHash(truck.plate);
                  const ringColor = pct >= 80 ? "text-red-500" : pct >= 60 ? "text-amber-500" : "text-emerald-500";
                  return (
                    <div key={String(truck._id)} className="grid grid-cols-[1fr_auto_auto] items-center border-b border-slate-100 last:border-0 px-1 py-3 gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{truck.plate}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono">{truck.baseCity}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <Users className="w-3 h-3" />
                          <span>{truck.driverName}</span>
                          {truck.phone && <span>· {truck.phone}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${ringColor}`}>{pct}% filled</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{truck.capacityKg} kg cap</p>
                      </div>
                      <button
                        onClick={() => removeTruckMutation.mutate({ truckId: String(truck._id) })}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <Truck className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-600">No trucks registered yet</p>
                <p className="text-sm text-slate-500 mt-1">Add your first vehicle using the form.</p>
              </div>
            )}
          </section>

        </div>
      ) : (
        <LoadAggregation asTab />
      )}
    </div>
  );
}
