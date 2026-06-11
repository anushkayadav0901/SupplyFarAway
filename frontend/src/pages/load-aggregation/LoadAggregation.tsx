import { useState } from "react";
import { toast } from "react-toastify";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

interface LoadOffer {
  _id: string;
  originCity: string;
  destinationCity: string;
  weightKg: number;
  pickupDate: string | Date;
  status: string;
  notes?: string;
  createdAt: string | Date;
}

interface MatchResult extends LoadOffer {
  similarityScore: number;
}

const statusColors: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  matched: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function LoadAggregation() {
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const createOffer = trpc.loadMatch.createOffer.useMutation({
    onSuccess: () => {
      toast.success("Load offer posted successfully!");
      setOriginCity("");
      setDestinationCity("");
      setWeightKg("");
      setPickupDate("");
      setNotes("");
      utils.loadMatch.listMine.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create load offer.");
    },
  });

  const cancelOffer = trpc.loadMatch.cancel.useMutation({
    onSuccess: () => {
      toast.success("Offer cancelled.");
      utils.loadMatch.listMine.invalidate();
      if (selectedOfferId) {
        utils.loadMatch.findMatches.invalidate({ offerId: selectedOfferId });
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel offer.");
    },
  });

  const { data: myOffersData, isLoading: loadingOffers } =
    trpc.loadMatch.listMine.useQuery({});

  const { data: matchData, isLoading: loadingMatches } =
    trpc.loadMatch.findMatches.useQuery(
      { offerId: selectedOfferId! },
      { enabled: !!selectedOfferId }
    );

  const myOffers: LoadOffer[] = (myOffersData?.offers as unknown as LoadOffer[]) ?? [];
  const matches: MatchResult[] = (matchData?.matches as unknown as MatchResult[]) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originCity.trim()) {
      toast.error("Origin city is required.");
      return;
    }
    if (!destinationCity.trim()) {
      toast.error("Destination city is required.");
      return;
    }
    const weight = parseFloat(weightKg);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Weight must be a positive number.");
      return;
    }
    if (!pickupDate) {
      toast.error("Pickup date is required.");
      return;
    }

    createOffer.mutate({
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      weightKg: weight,
      pickupDate,
      notes: notes.trim() || undefined,
    });
  };

  const handleFindMatches = (offerId: string) => {
    setSelectedOfferId(offerId === selectedOfferId ? null : offerId);
  };

  const handleCancel = (offerId: string) => {
    cancelOffer.mutate({ offerId });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Small Truck Load Aggregation" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Post Load Form */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Post a Load Offer</h2>
          <p className="text-sm text-gray-500 mb-6">
            Share your available truck capacity. The system will find compatible loads along the same corridor.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Origin City
                </label>
                <input
                  type="text"
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  placeholder="e.g. Chicago"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Destination City
                </label>
                <input
                  type="text"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  placeholder="e.g. Detroit"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="e.g. 800"
                  min="0.1"
                  step="0.1"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Notes <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requirements, cargo type, etc."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800 transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createOffer.isPending}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {createOffer.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Post Load Offer"
                )}
              </button>
            </div>
          </form>
        </section>

        {/* My Offers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">My Load Offers</h2>

          {loadingOffers ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : myOffers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">
                No load offers yet. Post your first offer above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myOffers.map((offer) => (
                <div
                  key={offer._id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-base font-bold text-gray-900">
                          {offer.originCity}
                          <span className="mx-2 text-blue-400">→</span>
                          {offer.destinationCity}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            statusColors[offer.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {offer.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>
                          <span className="font-semibold text-gray-700">Weight:</span>{" "}
                          {offer.weightKg.toLocaleString()} kg
                        </span>
                        <span>
                          <span className="font-semibold text-gray-700">Pickup:</span>{" "}
                          {formatDate(offer.pickupDate)}
                        </span>
                        <span>
                          <span className="font-semibold text-gray-700">Posted:</span>{" "}
                          {formatDate(offer.createdAt)}
                        </span>
                      </div>

                      {offer.notes && (
                        <p className="text-sm text-gray-500 italic">{offer.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {offer.status === "open" && (
                        <>
                          <button
                            onClick={() => handleFindMatches(offer._id)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                              selectedOfferId === offer._id
                                ? "bg-blue-600 text-white"
                                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                            }`}
                          >
                            {selectedOfferId === offer._id ? "Hide Matches" : "Find Matches"}
                          </button>

                          <button
                            onClick={() => handleCancel(offer._id)}
                            disabled={cancelOffer.isPending}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Match Results Panel */}
                  {selectedOfferId === offer._id && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-700 mb-3">
                        Compatible Load Matches
                      </h3>

                      {loadingMatches ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                          <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                          Scanning for matches...
                        </div>
                      ) : matches.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No compatible loads found for this route and date window. Check back later or adjust your offer details.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {matches.map((match) => (
                            <div
                              key={match._id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 rounded-xl p-4"
                            >
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-gray-800">
                                  {match.originCity}
                                  <span className="mx-2 text-blue-400">→</span>
                                  {match.destinationCity}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                  <span>{match.weightKg.toLocaleString()} kg</span>
                                  <span>Pickup: {formatDate(match.pickupDate)}</span>
                                  {match.notes && (
                                    <span className="italic text-gray-500">{match.notes}</span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="h-2 rounded-full bg-blue-200 w-24 overflow-hidden"
                                    aria-label={`Match score: ${match.similarityScore}`}
                                  >
                                    <div
                                      className="h-full bg-blue-600 rounded-full transition-all"
                                      style={{ width: `${match.similarityScore}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-blue-700">
                                    {match.similarityScore}%
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 text-right">
                                  Combined: {(offer.weightKg + match.weightKg).toLocaleString()} kg
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
