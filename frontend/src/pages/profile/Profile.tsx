import React, { useState } from "react";
import { Settings, History, BarChart2 } from "lucide-react";
import ManageAccount from "./ManageAccount";
import HistoryTab from "./History";
import AnalysisTab from "./Analysis";
import PageLead from "../../components/PageLead";

type ProfileTab = "settings" | "history" | "analysis";

export default function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("settings");

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">

        <PageLead
          title="Your account"
          sub="Profile details, every action you've taken on the platform, and a breakdown of the shipments you've handled."
        />

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Settings className="w-4 h-4" /> Account Settings
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4" /> Activity History
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === "analysis"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
