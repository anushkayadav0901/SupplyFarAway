import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { trpc } from "../lib/trpc";

interface DraftPickerProps {
  value: string;
  onSelect: (id: string) => void;
  className?: string;
}

interface DraftLike {
  _id: string | { toString(): string };
  timestamp?: string | Date;
  formData?: {
    ShipmentDetails?: {
      "Origin Country"?: string;
      "Destination Country"?: string;
      "Product Description"?: string;
    };
  };
}

function getId(d: DraftLike): string {
  const raw = d._id as unknown;
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toString(): string }).toString === "function") {
    return (raw as { toString(): string }).toString();
  }
  return "";
}

function describe(d: DraftLike): string {
  const o = d.formData?.ShipmentDetails?.["Origin Country"];
  const dest = d.formData?.ShipmentDetails?.["Destination Country"];
  const prod = d.formData?.ShipmentDetails?.["Product Description"];
  if (o && dest) return `${o} → ${dest}`;
  if (prod) return prod;
  return "Untitled draft";
}

export default function DraftPicker({
  value,
  onSelect,
  className,
}: DraftPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const draftsQuery = trpc.inventory.getDrafts.useQuery({});

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const drafts =
    (draftsQuery.data?.drafts as unknown as DraftLike[] | undefined) ?? [];
  const trimmedValue = value.trim();

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5 text-slate-500" />
        Pick draft
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-30">
          {draftsQuery.isLoading ? (
            <div className="p-4 text-xs text-slate-500">Loading drafts…</div>
          ) : draftsQuery.error ? (
            <div className="p-4 text-xs text-red-600">
              {draftsQuery.error.message}
            </div>
          ) : drafts.length === 0 ? (
            <div className="p-4 text-xs text-slate-500">
              No drafts yet. Create one in Inventory first.
            </div>
          ) : (
            <ul className="py-1">
              {drafts.map((d) => {
                const id = getId(d);
                const selected = id === trimmedValue;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(id);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        selected
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <p className="font-semibold truncate">{describe(d)}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {id}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
