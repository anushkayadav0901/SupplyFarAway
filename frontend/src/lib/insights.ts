// Shared helpers for trust scoring colors, formatting, and tiny stateless utilities
// used across the verification feature pages.

export type TrustTone = "ok" | "warn" | "danger" | "info" | "neutral";

export function trustToneFromScore(score: number): TrustTone {
  if (score >= 80) return "ok";
  if (score >= 50) return "warn";
  if (score >= 0) return "danger";
  return "neutral";
}

export function trustText(tone: TrustTone): string {
  switch (tone) {
    case "ok":
      return "text-emerald-600";
    case "warn":
      return "text-amber-600";
    case "danger":
      return "text-red-600";
    case "info":
      return "text-blue-600";
    default:
      return "text-slate-700";
  }
}

export function trustBg(tone: TrustTone): string {
  switch (tone) {
    case "ok":
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "warn":
      return "bg-amber-50 border-amber-200 text-amber-700";
    case "danger":
      return "bg-red-50 border-red-200 text-red-700";
    case "info":
      return "bg-blue-50 border-blue-200 text-blue-700";
    default:
      return "bg-slate-50 border-slate-200 text-slate-700";
  }
}

export function trustSolid(tone: TrustTone): string {
  switch (tone) {
    case "ok":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "danger":
      return "bg-red-500";
    case "info":
      return "bg-blue-500";
    default:
      return "bg-slate-400";
  }
}

/** A tiny djb2-style hash that yields a short hex string. Stable across runs. */
export function shortHash(input: string, length: number = 8): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    // h * 33 ^ c
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h |= 0;
  }
  // Convert to unsigned and to hex, then pad/cut to requested length
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  if (hex.length >= length) return hex.slice(0, length);
  // Extend by mixing the original hash a second time
  let extra = (h ^ (h >>> 13)) >>> 0;
  const extraHex = extra.toString(16).padStart(8, "0");
  return (hex + extraHex).slice(0, length);
}

export function formatRelativeTime(input: Date | string | number): string {
  const d = new Date(input);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
