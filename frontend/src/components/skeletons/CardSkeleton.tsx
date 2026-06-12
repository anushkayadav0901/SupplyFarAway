interface CardSkeletonProps {
  className?: string;
  height?: number;
}

/** A simple pulse card placeholder used by feature pages while data loads. */
export default function CardSkeleton({
  className,
  height = 128,
}: CardSkeletonProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse ${className ?? ""}`}
      style={{ height }}
    />
  );
}

export function TileSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm animate-pulse">
      <div className="h-2 w-16 rounded bg-slate-100" />
      <div className="h-7 w-24 rounded bg-slate-100 mt-3" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 rounded bg-slate-100" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-16 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}
