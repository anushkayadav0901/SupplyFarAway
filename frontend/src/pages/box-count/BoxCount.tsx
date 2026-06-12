import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import { trpc } from "../../lib/trpc";

interface YoloDetection {
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number];
  center: [number, number];
}

interface YoloResponse {
  detections: YoloDetection[];
  total_objects: number;
  class_counts: Record<string, number>;
  image_shape: [number, number];
}

interface LogEntry {
  id: number;
  ts: string;
  text: string;
  type: "observation" | "alert" | "system";
  suspectedCount?: number;
}

interface VerifyResult {
  _id: string;
  declaredCount: number;
  detectedCount: number;
  mismatch: boolean;
  mismatchPct: number;
  confidence: number;
  notes: string;
  draftId?: string;
  createdAt: string | Date;
}

const FRAME_INTERVAL_MS = 1000;
const COMMENTARY_EVERY_N_FRAMES = 3;
const MAX_LOG = 80;
const YOLO_CONF = 0.4;

type Mode = "idle" | "starting" | "live" | "saved" | "error";

export default function BoxCount() {
  const [mode, setMode] = useState<Mode>("idle");
  const [declaredCount, setDeclaredCount] = useState<string>("");
  const [draftId, setDraftId] = useState<string>("");

  const [yoloOnline, setYoloOnline] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [suspectedCount, setSuspectedCount] = useState<number>(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [duration, setDuration] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIdxRef = useRef(0);
  const processingRef = useRef(false);
  const yoloOnlineRef = useRef<boolean | null>(null);
  const detectionsRef = useRef<YoloDetection[]>([]);
  const logIdRef = useRef(0);
  const declaredCountRef = useRef<number>(0);
  const lastClassCountsRef = useRef<Record<string, number>>({});
  const logEndRef = useRef<HTMLDivElement>(null);

  const commentaryMutation = trpc.boxCount.liveCommentary.useMutation();
  const saveSessionMutation = trpc.boxCount.saveSession.useMutation();
  const historyQuery = trpc.boxCount.history.useQuery({ limit: 20 });

  useEffect(() => {
    yoloOnlineRef.current = yoloOnline;
  }, [yoloOnline]);
  useEffect(() => {
    detectionsRef.current = detections;
  }, [detections]);
  useEffect(() => {
    lastClassCountsRef.current = classCounts;
  }, [classCounts]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // ─── helpers ──────────────────────────────────────────────────────────────
  const pushLog = useCallback(
    (entry: Omit<LogEntry, "id" | "ts">) => {
      logIdRef.current += 1;
      const e: LogEntry = {
        id: logIdRef.current,
        ts: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        ...entry,
      };
      setLog((prev) => [...prev, e].slice(-MAX_LOG));
    },
    []
  );

  const drawOverlay = useCallback((dets: YoloDetection[]) => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video?.videoWidth) return;
    const rect = video.getBoundingClientRect();
    overlay.width = rect.width;
    overlay.height = rect.height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const sx = rect.width / video.videoWidth;
    const sy = rect.height / video.videoHeight;
    for (const d of dets) {
      const [x1, y1, x2, y2] = d.bbox;
      const bx = x1 * sx;
      const by = y1 * sy;
      const bw = (x2 - x1) * sx;
      const bh = (y2 - y1) * sy;
      const color = "#3b82f6";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      const label = `${d.class_name} ${Math.round(d.confidence * 100)}%`;
      ctx.font = "bold 12px ui-sans-serif, system-ui";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = color;
      ctx.fillRect(bx, Math.max(0, by - 20), tw, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, bx + 5, Math.max(12, by - 6));
    }
  }, []);

  // ─── camera ───────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((res) => {
          const v = videoRef.current!;
          if (v.readyState >= 2) return res();
          v.onloadeddata = () => res();
        });
      }
      setCameraError("");
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Camera access was denied.";
      setCameraError(msg);
      toast.error("Camera access denied");
      return false;
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext("2d")?.clearRect(0, 0, 9999, 9999);
  };

  // ─── frame loop ───────────────────────────────────────────────────────────
  const processFrame = useCallback(async () => {
    if (processingRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth) return;
    processingRef.current = true;
    frameIdxRef.current += 1;
    setFrameCount(frameIdxRef.current);

    try {
      const canvas = captureRef.current;
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const base64 = dataUrl.split(",")[1] ?? "";

      // YOLO (every frame)
      try {
        const r = await fetch("/yolo/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, conf_threshold: YOLO_CONF }),
          signal: AbortSignal.timeout(3500),
        });
        if (r.ok) {
          const data = (await r.json()) as YoloResponse;
          setDetections(data.detections ?? []);
          setClassCounts(data.class_counts ?? {});
          drawOverlay(data.detections ?? []);
          if (yoloOnlineRef.current !== true) {
            setYoloOnline(true);
            pushLog({
              text: "YOLO detector online",
              type: "system",
            });
          }
        } else if (yoloOnlineRef.current !== false) {
          setYoloOnline(false);
        }
      } catch {
        if (yoloOnlineRef.current !== false) {
          setYoloOnline(false);
          pushLog({
            text: "YOLO offline — start the FastAPI service on :8000",
            type: "alert",
          });
        }
      }

      // Gemini commentary (every Nth frame)
      if (frameIdxRef.current % COMMENTARY_EVERY_N_FRAMES === 0) {
        try {
          const res = await commentaryMutation.mutateAsync({
            imageBase64: base64,
            mimeType: "image/jpeg",
            manifestCount: declaredCountRef.current || undefined,
            yoloClassCounts: lastClassCountsRef.current,
          });
          setSuspectedCount(res.suspectedCount);
          pushLog({
            text: res.commentary,
            type: res.alert ? "alert" : "observation",
            suspectedCount: res.suspectedCount,
          });
        } catch {
          /* swallow — keep the loop alive */
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [commentaryMutation, drawOverlay, pushLog]);

  // ─── session control ─────────────────────────────────────────────────────
  const start = async () => {
    const n = parseInt(declaredCount, 10);
    if (!n || n <= 0) {
      toast.error("Enter a valid declared box count first.");
      return;
    }
    declaredCountRef.current = n;
    setMode("starting");
    setLog([]);
    setDetections([]);
    setClassCounts({});
    setSuspectedCount(0);
    setDuration(0);
    setFrameCount(0);
    frameIdxRef.current = 0;
    processingRef.current = false;

    pushLog({ text: "Starting camera…", type: "system" });
    const camOk = await startCamera();
    if (!camOk) {
      setMode("error");
      return;
    }
    pushLog({ text: "Camera ready. Probing YOLO…", type: "system" });

    try {
      const h = await fetch("/yolo/health", { signal: AbortSignal.timeout(2000) });
      if (h.ok) {
        setYoloOnline(true);
        pushLog({ text: "YOLO healthy on :8000", type: "system" });
      } else {
        setYoloOnline(false);
      }
    } catch {
      setYoloOnline(false);
      pushLog({
        text: "YOLO not reachable — run `cd yolo && uvicorn main:app --port 8000`. Continuing with Gemini-only commentary.",
        type: "alert",
      });
    }

    setMode("live");
    frameTimerRef.current = setInterval(processFrame, FRAME_INTERVAL_MS);
    durationTimerRef.current = setInterval(
      () => setDuration((p) => p + 1),
      1000
    );
  };

  const stop = useCallback(async () => {
    stopCamera();
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    frameTimerRef.current = null;
    durationTimerRef.current = null;

    const yoloTotal = detectionsRef.current.length;
    const detected = suspectedCount > 0 ? suspectedCount : yoloTotal;
    const declared = declaredCountRef.current;

    try {
      await saveSessionMutation.mutateAsync({
        draftId: draftId.trim() || undefined,
        declaredCount: declared,
        detectedCount: detected,
        confidence: 0.85,
        notes: `Live camera session • ${duration}s • ${frameIdxRef.current} frames • YOLO ${yoloOnlineRef.current ? "online" : "offline"}`,
      });
      historyQuery.refetch();
      toast.success("Session saved");
      setMode("saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save session";
      toast.error(msg);
      setMode("idle");
    }
  }, [draftId, duration, historyQuery, saveSessionMutation, suspectedCount]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  // ─── derived ──────────────────────────────────────────────────────────────
  const declared = parseInt(declaredCount, 10) || 0;
  const detectedNow = suspectedCount > 0 ? suspectedCount : detections.length;
  const diff = Math.abs(detectedNow - declared);
  const mismatchPct = declared > 0 ? (diff / declared) * 100 : 0;
  const mismatch = detectedNow > 0 && diff > 0;

  const fmtDuration = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Live Box Count Verification" />
      <canvas ref={captureRef} className="hidden" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: camera + counts */}
          <div className="lg:col-span-8 space-y-5">
            {/* Setup form */}
            {(mode === "idle" || mode === "saved" || mode === "error") && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-1">
                  Shipment Setup
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                  Point the camera at the shipment. YOLO draws live bounding
                  boxes, Gemini narrates what it sees, and we flag mismatches
                  against your declared manifest count.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Declared Box Count{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={declaredCount}
                      onChange={(e) => setDeclaredCount(e.target.value)}
                      placeholder="e.g. 24"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-800"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-semibold text-slate-700">
                        Draft ID{" "}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <DraftPicker value={draftId} onSelect={setDraftId} />
                    </div>
                    <input
                      type="text"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      placeholder="Link to a draft"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-800"
                    />
                  </div>
                </div>
                <button
                  onClick={start}
                  className="mt-5 w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors active:scale-[0.99]"
                >
                  Start Live Camera
                </button>
                {cameraError && (
                  <p className="mt-3 text-sm text-red-600">{cameraError}</p>
                )}
              </div>
            )}

            {/* Camera card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M3 7h2l2-3h10l2 3h2a2 2 0 012 2v9a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zM12 17a4 4 0 100-8 4 4 0 000 8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Live Camera
                    </p>
                    <p className="text-xs text-slate-500">
                      {mode === "live"
                        ? `Recording • ${fmtDuration(duration)}`
                        : mode === "starting"
                          ? "Initialising…"
                          : "Idle"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {yoloOnline !== null && (
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        yoloOnline
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      YOLO {yoloOnline ? "online" : "offline"}
                    </span>
                  )}
                  {mode === "live" && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-bold text-red-600">
                        LIVE
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="relative bg-slate-900 aspect-video overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${mode !== "live" ? "hidden" : ""}`}
                />
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                {mode !== "live" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                    <svg
                      className="w-12 h-12 mb-3 opacity-60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm">
                      {mode === "saved"
                        ? "Session saved. Start another to verify."
                        : "Press Start Live Camera to begin."}
                    </p>
                  </div>
                )}
                {mode === "live" && (
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-semibold">
                      {detections.length} YOLO box{detections.length === 1 ? "" : "es"}
                    </span>
                    {Object.entries(classCounts).slice(0, 4).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/80 text-white text-xs"
                      >
                        {v} × {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                {mode === "live" ? (
                  <button
                    onClick={stop}
                    disabled={saveSessionMutation.isPending}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors disabled:bg-slate-300"
                  >
                    {saveSessionMutation.isPending
                      ? "Saving…"
                      : "Stop & Save Session"}
                  </button>
                ) : mode === "starting" ? (
                  <span className="text-sm text-slate-500">
                    Initialising camera + YOLO…
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">
                    Configure above and click Start Live Camera.
                  </span>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Frames: {frameCount}</span>
                </div>
              </div>
            </div>

            {/* Live counts */}
            {mode === "live" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile
                  label="Declared"
                  value={declared || "—"}
                  tone="neutral"
                />
                <StatTile
                  label="Gemini count"
                  value={suspectedCount || "—"}
                  tone={mismatch ? "danger" : "ok"}
                />
                <StatTile
                  label="YOLO objects"
                  value={detections.length}
                  tone="info"
                />
                <StatTile
                  label="Mismatch"
                  value={mismatchPct}
                  decimals={1}
                  suffix="%"
                  tone={mismatch ? "danger" : "ok"}
                />
              </div>
            )}
          </div>

          {/* Right column: live commentary log + insights rail */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <p className="text-sm font-semibold text-slate-800">
                  Live AI Commentary
                </p>
                <p className="text-xs text-slate-500">
                  {log.length === 0
                    ? "Start a session to begin live commentary."
                    : `${log.length} entries • ${log.filter((e) => e.type === "alert").length} alerts`}
                </p>
              </div>
              <div className="max-h-[480px] overflow-y-auto p-3 space-y-2">
                {log.length === 0 ? (
                  <div className="px-3 py-10 text-center text-slate-400 text-sm">
                    Nothing observed yet.
                  </div>
                ) : (
                  log.map((e) => (
                    <div
                      key={e.id}
                      className={`p-3 rounded-xl border-l-4 ${
                        e.type === "alert"
                          ? "bg-red-50 border-red-400"
                          : e.type === "system"
                            ? "bg-slate-50 border-slate-300"
                            : "bg-blue-50 border-blue-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            e.type === "alert"
                              ? "text-red-600"
                              : e.type === "system"
                                ? "text-slate-500"
                                : "text-blue-600"
                          }`}
                        >
                          {e.type}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {e.ts}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed ${
                          e.type === "alert"
                            ? "text-red-700"
                            : "text-slate-700"
                        }`}
                      >
                        {e.text}
                      </p>
                      {e.suspectedCount !== undefined && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Suspected: {e.suspectedCount} box
                          {e.suspectedCount === 1 ? "" : "es"}
                        </p>
                      )}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
            <InsightsRail
              draftId={draftId.trim() || undefined}
              title="Verification Activity"
            />
          </aside>
        </div>

        {/* History */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Verification History
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Last 20 sessions for your account
              </p>
            </div>
            {historyQuery.isRefetching && (
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : historyQuery.error ? (
              <div className="px-6 py-8 text-center">
                <p className="text-red-500 text-sm">Failed to load history.</p>
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-500 font-medium">No verifications yet</p>
                <p className="text-slate-400 text-sm mt-1">
                  Run a live session above to populate history.
                </p>
              </div>
            ) : (
              (historyQuery.data as unknown as VerifyResult[]).map((item) => (
                <div
                  key={item._id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                      item.mismatch
                        ? "bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {item.mismatch ? "!" : "✓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-slate-800 text-sm">
                        Declared: {item.declaredCount}
                      </span>
                      <span
                        className={`font-semibold text-sm ${
                          item.mismatch ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        Detected: {item.detectedCount}
                      </span>
                      {item.mismatch && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
                          {item.mismatchPct.toFixed(1)}% off
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {(item.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-1 truncate max-w-xl">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  suffix,
  decimals,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "ok" | "danger" | "info";
  suffix?: string;
  decimals?: number;
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "ok"
        ? "text-emerald-600"
        : tone === "info"
          ? "text-blue-600"
          : "text-slate-800";
  const isNumber = typeof value === "number" && Number.isFinite(value);
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
    >
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-3xl font-bold mt-1 ${toneClass}`}>
        {isNumber ? (
          <CountUp
            value={value as number}
            decimals={decimals ?? 0}
            suffix={suffix}
          />
        ) : (
          value
        )}
      </p>
    </motion.div>
  );
}
