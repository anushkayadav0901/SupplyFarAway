import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import { Camera, Video } from "lucide-react";
import Header from "../../components/Header";
import InsightsRail from "../../components/InsightsRail";
import CountUp from "../../components/CountUp";
import DraftPicker from "../../components/DraftPicker";
import { trpc } from "../../lib/trpc";

// ─── constants ────────────────────────────────────────────────────────────────
const FRAME_INTERVAL_MS = 1000;
const COMMENTARY_EVERY_N_FRAMES = 3;
const MAX_LOG = 80;
const YOLO_CONF = 0.4;
const YOLO_FETCH_TIMEOUT_MS = 3500;
const YOLO_HEALTH_TIMEOUT_MS = 2000;
const HISTORY_LIMIT = 20;

// ─── types ────────────────────────────────────────────────────────────────────
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

type Mode = "idle" | "starting" | "live" | "saved" | "error";

// ─── format helpers ────────────────────────────────────────────────────────────
function fmtDuration(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── main component ───────────────────────────────────────────────────────────
export default function BoxCount() {
  const [searchParams] = useSearchParams();
  const initialDraftId = searchParams.get("draftId") ?? "";
  const [mode, setMode] = useState<Mode>("idle");
  const [declaredCount, setDeclaredCount] = useState<string>("");
  const [draftId, setDraftId] = useState<string>(initialDraftId);

  const [yoloOnline, setYoloOnline] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  // Persistent inline validation error for the declared-count field — see start()
  const [declaredError, setDeclaredError] = useState<string>("");
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [suspectedCount, setSuspectedCount] = useState<number>(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [duration, setDuration] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  // mounted guard — prevents setState after unmount from async callbacks
  const mountedRef = useRef(true);
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

  const shouldReduceMotion = useReducedMotion();

  const utils = trpc.useUtils();
  const commentaryMutation = trpc.boxCount.liveCommentary.useMutation();
  const saveSessionMutation = trpc.boxCount.saveSession.useMutation({
    onSuccess: () => {
      utils.boxCount.history.invalidate().catch(() => void 0);
    },
  });
  const historyQuery = trpc.boxCount.history.useQuery({ limit: HISTORY_LIMIT });

  // keep refs in sync
  useEffect(() => { yoloOnlineRef.current = yoloOnline; }, [yoloOnline]);
  useEffect(() => { detectionsRef.current = detections; }, [detections]);
  useEffect(() => { lastClassCountsRef.current = classCounts; }, [classCounts]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // unmount cleanup — always runs regardless of session state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCameraInternal();
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      frameTimerRef.current = null;
      durationTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard: Escape cancels live session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "live") {
        void stopSession();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // stopSession captured via ref to avoid stale closure issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Tab visibility — stop the camera when the user switches away mid-session.
  // This protects the user's camera LED and bandwidth when the tab is hidden.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden" && mode === "live") {
        // Tear down stream + timers; saveSession via stopSession to persist.
        void stopSession();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // beforeunload — synchronously tear down the camera stream on page refresh / close.
  // Async saveSession is not reliable here; the priority is releasing the camera LED.
  useEffect(() => {
    const handler = () => {
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      frameTimerRef.current = null;
      durationTimerRef.current = null;
      stopCameraInternal();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ─── helpers ──────────────────────────────────────────────────────────────
  const pushLog = useCallback(
    (entry: Omit<LogEntry, "id" | "ts">) => {
      if (!mountedRef.current) return;
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
  const stopCameraInternal = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext("2d")?.clearRect(0, 0, 9999, 9999);
  };

  const startCamera = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
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
      if (mountedRef.current) setCameraError("");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access was denied.";
      if (mountedRef.current) setCameraError(msg);
      toast.error("Camera access denied");
      return false;
    }
  };

  // ─── frame loop ───────────────────────────────────────────────────────────
  const processFrame = useCallback(async () => {
    if (processingRef.current || !videoRef.current || !mountedRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth) return;
    processingRef.current = true;
    frameIdxRef.current += 1;
    if (mountedRef.current) setFrameCount(frameIdxRef.current);

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
          signal: AbortSignal.timeout(YOLO_FETCH_TIMEOUT_MS),
        });
        if (!mountedRef.current) return;
        if (r.ok) {
          const data = (await r.json()) as YoloResponse;
          setDetections(data.detections ?? []);
          setClassCounts(data.class_counts ?? {});
          drawOverlay(data.detections ?? []);
          if (yoloOnlineRef.current !== true) {
            setYoloOnline(true);
            pushLog({ text: "YOLO detector online", type: "system" });
          }
        } else if (yoloOnlineRef.current !== false) {
          setYoloOnline(false);
        }
      } catch {
        if (!mountedRef.current) return;
        if (yoloOnlineRef.current !== false) {
          setYoloOnline(false);
          pushLog({ text: "YOLO offline — start the FastAPI service on :8000", type: "alert" });
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
          if (!mountedRef.current) return;
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
    // Re-entrancy guard — double-click or Enter spam should not stack starts.
    if (mode === "starting" || mode === "live") return;
    const n = parseInt(declaredCount, 10);
    if (!n || n <= 0) {
      // Persisted inline error — toasts auto-dismiss and the user loses context.
      setDeclaredError("Enter a positive declared box count before starting.");
      return;
    }
    setDeclaredError("");
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
    if (!mountedRef.current) return;
    if (!camOk) {
      setMode("error");
      return;
    }
    pushLog({ text: "Camera ready. Probing YOLO…", type: "system" });

    try {
      const h = await fetch("/yolo/health", { signal: AbortSignal.timeout(YOLO_HEALTH_TIMEOUT_MS) });
      if (!mountedRef.current) return;
      if (h.ok) {
        setYoloOnline(true);
        pushLog({ text: "YOLO healthy on :8000", type: "system" });
      } else {
        setYoloOnline(false);
      }
    } catch {
      if (!mountedRef.current) return;
      setYoloOnline(false);
      pushLog({
        text: "YOLO not reachable — run `cd yolo && uvicorn main:app --port 8000`. Continuing with Gemini-only commentary.",
        type: "alert",
      });
    }

    if (!mountedRef.current) return;
    setMode("live");
    frameTimerRef.current = setInterval(processFrame, FRAME_INTERVAL_MS);
    durationTimerRef.current = setInterval(() => {
      if (mountedRef.current) setDuration((p) => p + 1);
    }, 1000);
  };

  const stopSession = useCallback(async () => {
    // clear timers first so the frame loop can't restart them
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    frameTimerRef.current = null;
    durationTimerRef.current = null;
    stopCameraInternal();

    const yoloTotal = detectionsRef.current.length;
    // capture values before async gap
    const detected = suspectedCount > 0 ? suspectedCount : yoloTotal;
    const declared = declaredCountRef.current;
    const capturedDuration = duration;

    try {
      await saveSessionMutation.mutateAsync({
        draftId: draftId.trim() || undefined,
        declaredCount: declared,
        detectedCount: detected,
        confidence: 0.85,
        notes: `Live camera session • ${capturedDuration}s • ${frameIdxRef.current} frames • YOLO ${
          yoloOnlineRef.current ? "online" : "offline"
        }`,
      });
      if (!mountedRef.current) return;
      toast.success("Session saved");
      setMode("saved");
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to save session";
      toast.error(msg);
      setMode("idle");
    }
  }, [draftId, duration, saveSessionMutation, suspectedCount]);

  // keyboard Enter on form submits
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && mode !== "live" && mode !== "starting") {
      void start();
    }
  };

  // ─── derived ──────────────────────────────────────────────────────────────
  const declared = parseInt(declaredCount, 10) || 0;
  const detectedNow = suspectedCount > 0 ? suspectedCount : detections.length;
  const diff = Math.abs(detectedNow - declared);
  const mismatchPct = declared > 0 ? (diff / declared) * 100 : 0;
  const mismatch = detectedNow > 0 && diff > 0;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="Live Box Count Verification" />
      <canvas ref={captureRef} className="hidden" aria-hidden="true" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: camera + counts */}
          <div className="lg:col-span-8 space-y-5">
            {/* Setup form */}
            {(mode === "idle" || mode === "saved" || mode === "error") && (
              <motion.div
                initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
              >
                <h2 className="text-lg font-bold text-slate-800 mb-1">
                  Shipment Setup
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                  Point the camera at the shipment. YOLO draws live bounding
                  boxes, Gemini narrates what it sees, and we flag mismatches
                  against your declared manifest count.
                </p>
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  onKeyDown={handleFormKeyDown}
                >
                  <div>
                    <label
                      htmlFor="declaredCount"
                      className="block text-sm font-semibold text-slate-700 mb-1"
                    >
                      Declared Box Count{" "}
                      <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="declaredCount"
                      type="number"
                      min={1}
                      step={1}
                      value={declaredCount}
                      onChange={(e) => {
                        setDeclaredCount(e.target.value);
                        // Clear the inline error as soon as the user types a positive integer.
                        const n = parseInt(e.target.value, 10);
                        if (n > 0) setDeclaredError("");
                      }}
                      placeholder="e.g. 24"
                      aria-label="Declared box count"
                      aria-required="true"
                      aria-invalid={declaredError ? true : undefined}
                      aria-describedby={declaredError ? "declaredCountError" : undefined}
                      className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 text-slate-800 ${
                        declaredError
                          ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                          : "border-slate-200 focus:border-blue-500 focus:ring-blue-200"
                      }`}
                    />
                    {declaredError && (
                      <p
                        id="declaredCountError"
                        role="alert"
                        className="mt-2 text-sm text-red-600 font-medium"
                      >
                        {declaredError}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="draftIdInput"
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Draft ID{" "}
                        <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <DraftPicker value={draftId} onSelect={setDraftId} />
                    </div>
                    <input
                      id="draftIdInput"
                      type="text"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      placeholder="Link to a draft"
                      aria-label="Draft ID"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-800"
                    />
                  </div>
                </div>
                <motion.button
                  onClick={() => void start()}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  whileHover={shouldReduceMotion ? {} : { scale: 1.01 }}
                  disabled={!declared || declared <= 0}
                  aria-disabled={!declared || declared <= 0}
                  className="mt-5 w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md shadow-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Start Live Camera
                </motion.button>
                {cameraError && (
                  <p className="mt-3 text-sm text-red-600" role="alert">{cameraError}</p>
                )}
              </motion.div>
            )}

            {/* Camera card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shadow-sm shadow-blue-100">
                    <Camera className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Live Camera</p>
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
                      aria-live="polite"
                    >
                      YOLO {yoloOnline ? "online" : "offline"}
                    </span>
                  )}
                  {mode === "live" && (
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200"
                      aria-label="Live recording in progress"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                      <span className="text-xs font-bold text-red-600">LIVE</span>
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
                  aria-label="Live camera feed"
                />
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                />
                {mode !== "live" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                    <Video className="w-12 h-12 mb-3 opacity-60" aria-hidden="true" />
                    <p className="text-sm">
                      {mode === "saved"
                        ? "Session saved. Start another to verify."
                        : "Press Start Live Camera to begin."}
                    </p>
                  </div>
                )}
                {mode === "live" && (
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2" aria-live="polite" aria-atomic="true">
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
                    onClick={() => void stopSession()}
                    disabled={saveSessionMutation.isPending}
                    aria-label="Stop recording and save session"
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors disabled:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    {saveSessionMutation.isPending ? "Saving…" : "Stop & Save Session"}
                  </button>
                ) : mode === "starting" ? (
                  <span className="text-sm text-slate-500">Initialising camera + YOLO…</span>
                ) : (
                  <span className="text-sm text-slate-500">Configure above and click Start Live Camera.</span>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Frames: {frameCount}</span>
                </div>
              </div>
            </div>

            {/* Live counts */}
            {mode === "live" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-live="polite">
                <StatTile label="Declared" value={declared || "—"} tone="neutral" />
                <StatTile
                  label="Gemini count"
                  value={suspectedCount || "—"}
                  tone={mismatch ? "danger" : "ok"}
                />
                <StatTile label="YOLO objects" value={detections.length} tone="info" />
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
                <p className="text-sm font-semibold text-slate-800">Live AI Commentary</p>
                <p className="text-xs text-slate-500">
                  {log.length === 0
                    ? "Start a session to begin live commentary."
                    : `${log.length} entries • ${log.filter((e) => e.type === "alert").length} alerts`}
                </p>
              </div>
              <div
                className="max-h-[480px] overflow-y-auto p-3 space-y-2"
                role="log"
                aria-live="polite"
                aria-atomic="false"
                aria-label="Live AI commentary log"
              >
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
                        <span className="text-[10px] text-slate-400">{e.ts}</span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed ${
                          e.type === "alert" ? "text-red-700" : "text-slate-700"
                        }`}
                      >
                        {e.text}
                      </p>
                      {e.suspectedCount !== undefined && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Suspected: {e.suspectedCount} box{e.suspectedCount === 1 ? "" : "es"}
                        </p>
                      )}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
            <InsightsRail draftId={draftId.trim() || undefined} title="Verification Activity" />
          </aside>
        </div>

        {/* History */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Verification History</h2>
              <p className="text-sm text-slate-500 mt-0.5">Last {HISTORY_LIMIT} sessions for your account</p>
            </div>
            {historyQuery.isRefetching && (
              <div
                className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"
                aria-label="Refreshing history"
              />
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" aria-label="Loading history" />
              </div>
            ) : historyQuery.error ? (
              <div className="px-6 py-8 text-center">
                <p className="text-red-500 text-sm">Failed to load history.</p>
                <button
                  type="button"
                  onClick={() => historyQuery.refetch().catch(() => void 0)}
                  className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                >
                  Retry
                </button>
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Camera className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
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
                      item.mismatch ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                    }`}
                    aria-label={item.mismatch ? "Mismatch detected" : "Count verified"}
                  >
                    {item.mismatch ? "!" : "✓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-slate-800 text-sm">
                        Declared: {item.declaredCount}
                      </span>
                      <span className={`font-semibold text-sm ${item.mismatch ? "text-red-600" : "text-emerald-600"}`}>
                        Detected: {item.detectedCount}
                      </span>
                      {item.mismatch && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
                          {fmtPct(item.mismatchPct)} off
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {Number.isFinite(item.confidence)
                          ? `${Math.round(item.confidence * 100)}% confidence`
                          : "—"}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-1 truncate max-w-xl">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">{fmtDate(item.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────
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
  const shouldReduceMotion = useReducedMotion();
  const toneClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "ok"
        ? "text-emerald-600"
        : tone === "info"
          ? "text-blue-600"
          : "text-slate-800";
  const glowClass =
    tone === "danger"
      ? "shadow-red-100"
      : tone === "ok"
        ? "shadow-emerald-100"
        : tone === "info"
          ? "shadow-blue-100"
          : "";
  const isNumber = typeof value === "number" && Number.isFinite(value);
  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { y: -2 }}
      transition={{ duration: 0.15 }}
      className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ${glowClass}`}
    >
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${toneClass}`}>
        {isNumber ? (
          <CountUp value={value as number} decimals={decimals ?? 0} suffix={suffix} />
        ) : (
          value
        )}
      </p>
    </motion.div>
  );
}
