import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Camera, Video, AlertTriangle } from "lucide-react";
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

interface BoxCountTabProps {
  draftId: string;
  onResult?: (passed: boolean) => void;
  runAllRequested?: boolean;
}

export default function BoxCountTab({ draftId, onResult, runAllRequested }: BoxCountTabProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [declaredCount, setDeclaredCount] = useState<string>("");
  const [yoloOnline, setYoloOnline] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [declaredError, setDeclaredError] = useState<string>("");
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [suspectedCount, setSuspectedCount] = useState<number>(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [duration, setDuration] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

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

  const utils = trpc.useUtils();
  const commentaryMutation = trpc.boxCount.liveCommentary.useMutation();
  const saveSessionMutation = trpc.boxCount.saveSession.useMutation({
    onSuccess: (data) => {
      utils.boxCount.history.invalidate().catch(() => void 0);
      onResult?.(!data.mismatch);
    },
  });
  const historyQuery = trpc.boxCount.history.useQuery({ limit: HISTORY_LIMIT });

  useEffect(() => { yoloOnlineRef.current = yoloOnline; }, [yoloOnline]);
  useEffect(() => { detectionsRef.current = detections; }, [detections]);
  useEffect(() => { lastClassCountsRef.current = classCounts; }, [classCounts]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

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
  }, []);

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
          /* swallow */
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [commentaryMutation, drawOverlay, pushLog]);

  const start = async () => {
    if (mode === "starting" || mode === "live") return;
    const n = parseInt(declaredCount, 10);
    if (!n || n <= 0) {
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
        text: "YOLO not reachable — run `cd yolo && uvicorn main:app --port 8000`.",
        type: "alert",
      });
    }

    if (!mountedRef.current) return;
    setMode("live");
    frameTimerRef.current = setInterval(processFrame, FRAME_INTERVAL_MS);
    durationTimerRef.current = setInterval(() => {
      if (mountedRef.current) setDuration((d) => d + 1);
    }, 1000);
  };

  const stopSession = async () => {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    frameTimerRef.current = null;
    durationTimerRef.current = null;
    stopCameraInternal();

    if (!mountedRef.current) return;
    setMode("saved");
    pushLog({ text: "Session ended. Saving result to server…", type: "system" });

    const yoloTotal = detectionsRef.current.length;
    const detected = suspectedCount > 0 ? suspectedCount : yoloTotal;

    try {
      await saveSessionMutation.mutateAsync({
        draftId: draftId.trim() || undefined,
        declaredCount: declaredCountRef.current,
        detectedCount: detected,
        confidence: 0.85,
        notes: `Live camera session • ${duration}s • YOLO ${yoloOnline ? "online" : "offline"}`,
      });
      toast.success("Box count session saved successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      toast.error(`Save failed: ${msg}`);
      pushLog({ text: `Failed to save: ${msg}`, type: "alert" });
    }
  };

  const reset = () => {
    stopCameraInternal();
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    frameTimerRef.current = null;
    durationTimerRef.current = null;
    setMode("idle");
    setLog([]);
    setDetections([]);
    setClassCounts({});
    setSuspectedCount(0);
    setDuration(0);
    setFrameCount(0);
    setDeclaredError("");
  };

  const derivedDeclared = parseInt(declaredCount, 10) || 0;
  const detectedNow = suspectedCount > 0 ? suspectedCount : detections.length;
  const diff = Math.abs(detectedNow - derivedDeclared);
  const mismatch = detectedNow > 0 && diff > 0;

  return (
    <div className="space-y-6">
      <canvas ref={captureRef} className="hidden" aria-hidden="true" />

        {/* Setup card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2 flex flex-col gap-4">
              <div>
                <label htmlFor="declared-count" className="block text-sm font-semibold text-slate-700 mb-1">
                  Declared Box Count <span className="text-red-500">*</span>
                </label>
                <input
                  id="declared-count"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5"
                  value={declaredCount}
                  onChange={(e) => setDeclaredCount(e.target.value)}
                  disabled={mode === "live" || mode === "starting"}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {declaredError && (
                  <p className="text-xs text-red-500 mt-1" role="alert">
                    {declaredError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {mode === "idle" || mode === "saved" || mode === "error" ? (
                  <button
                    type="button"
                    onClick={start}
                    className="flex-1 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <Camera className="w-4 h-4" /> Start Inspection
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopSession}
                    disabled={mode === "starting"}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-slate-400"
                  >
                    <Video className="w-4 h-4" /> Stop &amp; Save
                  </button>
                )}
                {(mode === "saved" || mode === "error") && (
                  <button
                    type="button"
                    onClick={reset}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 bg-slate-100 rounded-2xl relative overflow-hidden flex items-center justify-center h-64 border border-slate-200">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                aria-label="Inspection feed"
              />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

              {mode === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-100/90">
                  <Camera className="w-8 h-8" />
                  <p className="text-sm">Camera preview inactive</p>
                </div>
              )}
              {mode === "starting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-100/90">
                  <span className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
                  <p className="text-sm">Configuring camera stream...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Mismatch Warn */}
        {mode === "live" && mismatch && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-sm font-semibold">
              Live Mismatch Detected: Manifest declares {derivedDeclared} boxes, but camera is acquiring {detectedNow}.
            </span>
          </div>
        )}

        {/* Inspection Log */}
        {log.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Inspection Terminal</h3>
            <div className="h-48 overflow-y-auto bg-slate-50 rounded-xl px-4 py-3 font-mono text-xs text-slate-700 border border-slate-200">
              {log.map((l) => (
                <div key={l.id} className="mb-1 leading-relaxed">
                  <span className="text-slate-400">[{l.ts}]</span>{" "}
                  <span className={l.type === "alert" ? "text-red-600" : l.type === "system" ? "text-blue-600" : "text-slate-700"}>
                    {l.text}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* History Log List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800">Check History</h3>
            <button
              onClick={() => historyQuery.refetch()}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
            >
              Refresh
            </button>
          </div>
          {historyQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-10 bg-slate-100 rounded" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          ) : historyQuery.data && historyQuery.data.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {(historyQuery.data as any).map((item: any) => (
                <div key={item._id} className="py-3 flex justify-between items-center text-sm gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.mismatch ? "bg-red-500" : "bg-emerald-500"}`} />
                    <span className="font-semibold text-slate-700">Declared: {item.declaredCount}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 font-semibold">Detected: {item.detectedCount}</span>
                  </div>
                  <span className="text-xs text-slate-400">{fmtDate(item.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">No historical records found.</p>
          )}
        </div>
    </div>
  );
}
