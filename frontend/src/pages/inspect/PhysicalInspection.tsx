import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, Scale, Tag, Diff } from "lucide-react";
import Header from "../../components/Header";
import DraftPicker from "../../components/DraftPicker";

import BoxCountTab from "./BoxCountTab";
import WeightCheckTab from "./WeightCheckTab";
import RfidVerificationTab from "./RfidVerificationTab";
import ShipmentDiffTab from "./ShipmentDiffTab";

type SubsystemTab = "camera" | "weight" | "rfid" | "diff";

export default function PhysicalInspection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDraftId, setSelectedDraftId] = useState<string>(
    searchParams.get("draftId") ?? ""
  );
  const [activeTab, setActiveTab] = useState<SubsystemTab>(
    (searchParams.get("tab") as SubsystemTab) ?? "camera"
  );

  // Sync state back to query params so URL remains bookmarkable
  useEffect(() => {
    const params: Record<string, string> = { tab: activeTab };
    if (selectedDraftId) params.draftId = selectedDraftId;
    setSearchParams(params);
  }, [activeTab, selectedDraftId, setSearchParams]);

  const tabs = [
    { id: "camera" as const, label: "Camera Count", Icon: Camera },
    { id: "weight" as const, label: "Weight Check", Icon: Scale },
    { id: "rfid" as const, label: "RFID Tagging", Icon: Tag },
    { id: "diff" as const, label: "Tamper Diff", Icon: Diff },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Physical Inspection" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Unified draft selector card */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Inspection Context</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select a draft to analyze manifest data across all verification subsystems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Active Draft:</span>
            <DraftPicker value={selectedDraftId} onSelect={setSelectedDraftId} />
          </div>
        </div>

        {/* Flat style tabs conforming to taste.txt */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const { Icon } = tab;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap focus:outline-none ${
                  isActive
                    ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 rounded-t-xl"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content panel */}
        <div className="mt-6">
          {activeTab === "camera" && <BoxCountTab draftId={selectedDraftId} />}
          {activeTab === "weight" && <WeightCheckTab draftId={selectedDraftId} />}
          {activeTab === "rfid" && <RfidVerificationTab draftId={selectedDraftId} />}
          {activeTab === "diff" && <ShipmentDiffTab draftId={selectedDraftId} />}
        </div>
      </main>
    </div>
  );
}
