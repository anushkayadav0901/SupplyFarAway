import { TileSkeleton } from "./CardSkeleton";

/** Placeholder that occupies the exact footprint of the dashboard hero block. */
export default function HeroSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-center">
        <div className="flex items-center justify-center">
          <div className="w-[200px] h-[200px] rounded-full bg-gradient-to-br from-slate-100 to-slate-50 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      </div>
    </div>
  );
}
