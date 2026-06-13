import React, { useState } from "react";
import { Settings, History, BarChart2 } from "lucide-react";
import ManageAccount from "./ManageAccount";
import HistoryTab from "./History";
import AnalysisTab from "./Analysis";

type ProfileTab = "settings" | "history" | "analysis";

export default function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("settings");

  return (
    <div className="min-h-screen bg-slate-50">
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
            <BarChart2 className="w-4 h-4" /> Shipment Analysis
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "settings" && <ManageAccount />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "analysis" && <AnalysisTab />}

      </main>
    </div>
  );
}
