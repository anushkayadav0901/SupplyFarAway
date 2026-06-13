import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, Scale, Tag, Diff, PlayCircle, CheckCircle2, Circle } from "lucide-react";
import Header from "../../components/Header";
import DraftPicker from "../../components/DraftPicker";
import TrustGauge from "../../components/TrustGauge";

import BoxCountTab from "./BoxCountTab";
import WeightCheckTab from "./WeightCheckTab";
import RfidVerificationTab from "./RfidVerificationTab";
import ShipmentDiffTab from "./ShipmentDiffTab";

type SubsystemTab = "camera" | "weight" | "rfid" | "diff";

interface SubsystemStatus {
  camera: boolean | null;
  weight: boolean | null;
  rfid: boolean | null;
  diff: boolean | null;
}

const INITIAL_STATUS: SubsystemStatus = {
  camera: null,
  weight: null,
  rfid: null,
  diff: null,
};

function computeTrustScore(status: SubsystemStatus): number {
  const values = Object.values(status);
  const completed = values.filter((v) => v !== null);
  if (completed.length === 0) return 50; // neutral default
  const passed = values.filter((v) => v === true).length;
  return Math.round((passed / 4) * 100);
}

export default function PhysicalInspection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDraftId, setSelectedDraftId] = useState<string>(
    searchParams.get("draftId") ?? ""
  );
  const [activeTab, setActiveTab] = useState<SubsystemTab>(
    (searchParams.get("tab") as SubsystemTab) ?? "camera"
  );
  const [subsystemStatus, setSubsystemStatus] =
    useState<SubsystemStatus>(INITIAL_STATUS);
  const [runAllRequested, setRunAllRequested] = useState(false);

  useEffect(() => {
    const params: Record<string, string> = { tab: activeTab };
    if (selectedDraftId) params.draftId = selectedDraftId;
    setSearchParams(params, { replace: true });
  }, [activeTab, selectedDraftId, setSearchParams]);

  const handleResult = useCallback(
    (key: keyof SubsystemStatus) => (passed: boolean) => {
      setSubsystemStatus((prev) => ({ ...prev, [key]: passed }));
    },
    []
  );

  const trustScore = computeTrustScore(subsystemStatus);

  const tabs: {
    id: SubsystemTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    statusKey: keyof SubsystemStatus;
  }[] = [
    { id: "camera", label: "Camera Count", Icon: Camera, statusKey: "camera" },
    { id: "weight", label: "Weight Check", Icon: Scale, statusKey: "weight" },
    { id: "rfid", label: "RFID Tagging", Icon: Tag, statusKey: "rfid" },
    { id: "diff", label: "Tamper Diff", Icon: Diff, statusKey: "diff" },
  ];

  function StatusDot({ passed }: { passed: boolean | null }) {
    if (passed === null) return <Circle className="w-3 h-3 text-slate-300" />;
    if (passed)
      return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
    return <CheckCircle2 className="w-3 h-3 text-red-400" />;
  }

  const handleRunAll = () => {
    setRunAllRequested((v) => !v);
  };

  const completedCount = Object.values(subsystemStatus).filter(
    (v) => v !== null
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Physical Inspection" page="inspect" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Draft selector + Run All Checks */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Inspection Context
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select a draft to run verification across all subsystems.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-600">
              Active Draft:
            </span>
            <DraftPicker
              value={selectedDraftId}
              onSelect={setSelectedDraftId}
            />
            <button
              type="button"
              onClick={handleRunAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <PlayCircle className="w-4 h-4" />
              Run All Checks
            </button>
          </div>
        </div>

        {/* Two-column layout: tabs + trust panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: tab strip + content */}
          <div className="lg:col-span-8 space-y-0">
            {/* Tab strip */}
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px bg-white rounded-t-2xl px-3 pt-3">
              {tabs.map((tab) => {
                const { Icon } = tab;
                const isActive = activeTab === tab.id;
                const status = subsystemStatus[tab.statusKey];
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all whitespace-nowrap focus:outline-none ${
                      isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <StatusDot passed={status} />
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="pt-4">
              {activeTab === "camera" && (
                <BoxCountTab
                  draftId={selectedDraftId}
                  onResult={handleResult("camera")}
                  runAllRequested={runAllRequested}
                />
              )}
              {activeTab === "weight" && (
                <WeightCheckTab
                  draftId={selectedDraftId}
                  onResult={handleResult("weight")}
                />
              )}
              {activeTab === "rfid" && (
                <RfidVerificationTab
                  draftId={selectedDraftId}
                  onResult={handleResult("rfid")}
                />
              )}
              {activeTab === "diff" && (
                <ShipmentDiffTab
                  draftId={selectedDraftId}
                  onResult={handleResult("diff")}
                />
              )}
            </div>
          </div>

          {/* Right: Trust Score panel */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center gap-4">
              <h3 className="text-sm font-bold text-slate-700 self-start">
                Trust Score
              </h3>
              <TrustGauge
                value={trustScore}
                size={180}
                label="Inspection"
                subLabel={
                  completedCount === 0
                    ? "No checks run yet"
                    : `${completedCount}/4 subsystems`
                }
              />
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                Score updates as each subsystem completes. Run checks in each
                tab or press "Run All Checks" above.
              </p>
            </div>

            {/* Subsystem status summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-700">
                Subsystem Summary
              </h3>
              {tabs.map((tab) => {
                const status = subsystemStatus[tab.statusKey];
                const { Icon } = tab;
                return (
                  <div
                    key={tab.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      status === true
                        ? "bg-emerald-50 border-emerald-200"
                        : status === false
                        ? "bg-red-50 border-red-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Icon className="w-4 h-4 text-slate-500" />
                      {tab.label}
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        status === true
                          ? "bg-emerald-100 text-emerald-700"
                          : status === false
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {status === true
                        ? "Pass"
                        : status === false
                        ? "Fail"
                        : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
