import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { User, Settings, History, BarChart2, Shield, Trash2, Key } from "lucide-react";
import Header from "../../components/Header";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import { trpc } from "../../lib/trpc";

type ProfileTab = "settings" | "history" | "analysis";

export default function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("settings");
  const navigate = useNavigate();

  // Settings State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  
  // Password Update State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const meQuery = trpc.auth.getMe.useQuery();
  const analyticsQuery = trpc.insights.userAnalytics.useQuery(undefined, {
    retry: false,
  });
  const draftsQuery = trpc.inventory.getDrafts.useQuery({ tab: "compliant" });

  useEffect(() => {
    if (meQuery.data?.user) {
      const u = meQuery.data.user as any;
      setPhoneNumber(u.phoneNumber || "");
      setCompanyName(u.companyName || "");
      setTaxId(u.taxId || "");
      
      const addr = u.companyAddress;
      if (addr) {
        const addrLines = [
          addr.street,
          [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "),
          addr.country,
        ].filter(Boolean).join("\n");
        setCompanyAddress(addrLines);
      }
    }
  }, [meQuery.data]);

  // Mutations
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated.");
      utils.auth.getMe.invalidate().catch(() => null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update profile.");
    },
  });

  const updatePasswordMutation = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to change password.");
    },
  });

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted.");
      localStorage.removeItem("token");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete account.");
    },
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileMutation.mutateAsync({
      phoneNumber,
      companyName,
      companyAddress: {
        street: companyAddress,
        city: "",
        state: "",
        postalCode: "",
        country: "",
      },
      taxId,
    });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    await updatePasswordMutation.mutateAsync({
      currentPassword,
      newPassword,
    });
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you absolutely sure you want to delete your account? This action is permanent.")) {
      await deleteAccountMutation.mutateAsync();
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    toast.success("Logged out successfully.");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="User Profile &amp; Settings" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <Settings className="w-4 h-4" /> Account Settings
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <History className="w-4 h-4" /> Activity History
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all rounded-t-xl ${
              activeTab === "analysis"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Trust Analysis
          </button>
        </div>

        {/* Tab Content Panels */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Profile Updates */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" /> Profile Information
              </h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Company Address</label>
                  <textarea
                    rows={3}
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    placeholder={`123 Main St\nNew York, NY 10001\nUSA`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tax ID</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Security and Actions */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Password update */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" /> Security
                </h3>
                <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatePasswordMutation.isPending}
                    className="w-full py-2 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-900 transition-colors"
                  >
                    {updatePasswordMutation.isPending ? "Updating..." : "Change Password"}
                  </button>
                </form>
              </div>

              {/* Danger Zone */}
              <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-red-700 flex items-center gap-2">
                  Danger Zone
                </h3>
                <p className="text-xs text-slate-500">Actions here are permanent and affect your account data.</p>
                <div className="space-y-2">
                  <button
                    onClick={logout}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Logout Session
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountMutation.isPending}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800">Shipment History Logs</h3>
            {draftsQuery.isLoading ? (
              <div className="space-y-2">
                <CardSkeleton height={40} />
                <CardSkeleton height={40} />
              </div>
            ) : draftsQuery.data && (draftsQuery.data as any).drafts?.length > 0 ? (
              <div className="overflow-x-auto text-sm text-slate-700">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 font-semibold text-xs uppercase">
                      <th className="py-2">Route</th>
                      <th className="py-2">Weight</th>
                      <th className="py-2">Compliance</th>
                      <th className="py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draftsQuery.data as any).drafts.map((draft: any) => (
                      <tr key={draft._id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 font-semibold">{draft.originCountry} → {draft.destinationCountry}</td>
                        <td className="py-3">{draft.weight} kg</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${draft.statuses?.compliance === "compliant" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {draft.statuses?.compliance || "Pending"}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400 font-mono text-xs">{new Date(draft.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No historical drafts found.</p>
            )}
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-800">Fleet Trust Score Analytics</h3>
            {analyticsQuery.isLoading ? (
              <div className="animate-pulse h-20 bg-slate-100 rounded-xl" />
            ) : analyticsQuery.data ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <Shield className="w-8 h-8 mx-auto text-blue-600" />
                  <p className="text-xs text-slate-400 font-semibold uppercase">Total Verification Runs</p>
                  <p className="text-3xl font-extrabold text-slate-800">{(analyticsQuery.data as any).totalRuns || 0}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <Shield className="w-8 h-8 mx-auto text-emerald-600" />
                  <p className="text-xs text-slate-400 font-semibold uppercase">Verification Integrity Rate</p>
                  <p className="text-3xl font-extrabold text-emerald-700">
                    {((analyticsQuery.data as any).integrityRate * 100 || 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <Shield className="w-8 h-8 mx-auto text-red-600" />
                  <p className="text-xs text-slate-400 font-semibold uppercase">Active Flags</p>
                  <p className="text-3xl font-extrabold text-red-600">{(analyticsQuery.data as any).flaggedCount || 0}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No analysis details available.</p>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
