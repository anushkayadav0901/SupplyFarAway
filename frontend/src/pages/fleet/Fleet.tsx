import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Truck, Boxes, Plus, Trash2, Users, MapPin, RefreshCcw } from "lucide-react";
import Header from "../../components/Header";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

type Tab = "registry" | "loads";

function plateHash(plate: string): number {
  let h = 0;
  for (let i = 0; i < plate.length; i++) h = (h * 31 + plate.charCodeAt(i)) >>> 0;
  return 20 + (h % 75);
}

export default function Fleet() {
  const [activeTab, setActiveTab] = useState<Tab>("registry");

  // Truck Registry form states
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [baseCity, setBaseCity] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  // Load Match form states
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [loadWeight, setLoadWeight] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [loadNotes, setLoadNotes] = useState("");

  const utils = trpc.useUtils();

  // Truck queries/mutations
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

  // Load Match queries/mutations
  const offersQuery = trpc.loadMatch.listMine.useQuery({});
  const createOfferMutation = trpc.loadMatch.createOffer.useMutation({
    onSuccess: () => {
      toast.success("Load offer created.");
      setOriginCity("");
      setDestinationCity("");
      setLoadWeight("");
      setPickupDate("");
      setLoadNotes("");
      utils.loadMatch.listMine.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create load offer.");
    },
  });
  const cancelOfferMutation = trpc.loadMatch.cancel.useMutation({
    onSuccess: () => {
      toast.success("Load offer cancelled.");
      utils.loadMatch.listMine.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel load.");
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

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originCity.trim() || !destinationCity.trim() || !loadWeight.trim()) {
      toast.error("Please fill in required load details.");
      return;
    }
    await createOfferMutation.mutateAsync({
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      weightKg: parseFloat(loadWeight) || 500,
      pickupDate: pickupDate ? new Date(pickupDate) : new Date(),
      notes: loadNotes.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Fleet &amp; Load Management" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("registry")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "registry"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <Truck className="w-4 h-4" /> Truck Registry
          </button>
          <button
            onClick={() => setActiveTab("loads")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "loads"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <Boxes className="w-4 h-4" /> Load Match Corridors
          </button>
        </div>

        {activeTab === "registry" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Registry Form */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Register Vehicle
              </h3>
              <form onSubmit={handleRegisterTruck} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">License Plate *</label>
                    <input
                      type="text"
                      placeholder="IL-902-8X"
                      value={plate}
                      onChange={(e) => setPlate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity (kg) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Base City *</label>
                  <input
                    type="text"
                    placeholder="e.g. Chicago"
                    value={baseCity}
                    onChange={(e) => setBaseCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Name *</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Phone</label>
                    <input
                      type="text"
                      placeholder="555-0199"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={registerTruckMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                >
                  {registerTruckMutation.isPending ? "Registering..." : "Add to Registry"}
                </button>
              </form>
            </div>

            {/* Right side: Trucks directory */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Fleet Directory</h3>
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
                <div className="space-y-3">
                  {listTrucksQuery.data.map((truck) => {
                    const pct = plateHash(truck.plate);
                    const ringColor = pct >= 80 ? "text-red-500" : pct >= 60 ? "text-amber-500" : "text-emerald-500";
                    return (
                      <div key={truck._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{truck.plate}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full font-mono">{truck.baseCity}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                            <Users className="w-3 h-3" />
                            <span>{truck.driverName}</span>
                            {truck.phone && <span>· {truck.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`text-xs font-bold ${ringColor}`}>{pct}% filled</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{truck.capacityKg} kg cap</p>
                          </div>
                          <button
                            onClick={() => removeTruckMutation.mutate({ plate: truck.plate })}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No registered trucks found.</p>
              )}
            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Create Load Matching Offer */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Post Load Demand
              </h3>
              <form onSubmit={handleCreateOffer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Origin City *</label>
                    <input
                      type="text"
                      placeholder="Chicago"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Destination City *</label>
                    <input
                      type="text"
                      placeholder="New York"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Weight (kg) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 1500"
                      value={loadWeight}
                      onChange={(e) => setLoadWeight(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pickup Date</label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                  <textarea
                    placeholder="Fragile cargo, temperature check..."
                    value={loadNotes}
                    onChange={(e) => setLoadNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createOfferMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                >
                  {createOfferMutation.isPending ? "Posting Load..." : "Post Load Offer"}
                </button>
              </form>
            </div>

            {/* Right side: Active Load Matching Offers */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">My Posted Loads</h3>
                <button
                  onClick={() => offersQuery.refetch()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {offersQuery.isLoading ? (
                <div className="space-y-3">
                  <CardSkeleton height={60} />
                  <CardSkeleton height={60} />
                </div>
              ) : offersQuery.data && offersQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {offersQuery.data.map((offer: any) => (
                    <div key={offer._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            {offer.originCity} → {offer.destinationCity}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Weight: <span className="font-semibold text-slate-700">{offer.weightKg} kg</span> · Date: {new Date(offer.pickupDate).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => cancelOfferMutation.mutate({ offerId: offer._id })}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No active load match offers posted.</p>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
