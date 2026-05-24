"use client";

import { useState } from "react";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type RangePreset = "7d" | "30d" | "month" | "all" | "custom";

export interface DateRange {
  preset: RangePreset;
  from: Date | null;
  to: Date | null;
}

const PRESETS: { id: Exclude<RangePreset, "custom">; label: string }[] = [
  { id: "7d", label: "Last 7d" },
  { id: "30d", label: "Last 30d" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function rangeFromPreset(preset: Exclude<RangePreset, "custom">): DateRange {
  const now = new Date();
  switch (preset) {
    case "7d":
      return { preset, from: subDays(now, 6), to: now };
    case "30d":
      return { preset, from: subDays(now, 29), to: now };
    case "month":
      return { preset, from: startOfMonth(now), to: now };
    case "all":
      return { preset, from: null, to: null };
  }
}

function labelFor(range: DateRange): string {
  if (range.preset !== "custom") {
    return PRESETS.find((p) => p.id === range.preset)?.label ?? "Last 30d";
  }
  if (range.from && range.to) {
    return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`;
  }
  return "Custom range";
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  // local copy of the custom range while the popover is open; commits on close.
  const [draftFrom, setDraftFrom] = useState<Date | undefined>(value.from ?? undefined);
  const [draftTo, setDraftTo] = useState<Date | undefined>(value.to ?? undefined);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => {
        const active = value.preset === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(rangeFromPreset(p.id))}
            className={`inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
              active
                ? "bg-[var(--text-forest)] text-[var(--text-cream)]"
                : "bg-[var(--bg-muted)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)]"
            }`}
          >
            {p.label}
          </button>
        );
      })}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o && draftFrom && draftTo) {
            onChange({ preset: "custom", from: draftFrom, to: draftTo });
          }
        }}
      >
        <PopoverTrigger
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
            value.preset === "custom"
              ? "bg-[var(--text-forest)] text-[var(--text-cream)]"
              : "bg-[var(--bg-muted)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)]"
          }`}
        >
          <CalendarIcon className="h-3 w-3" />
          <span>{value.preset === "custom" ? labelFor(value) : "Custom"}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="end" className="p-0 w-auto">
          <Calendar
            mode="range"
            selected={{ from: draftFrom, to: draftTo }}
            onSelect={(r) => {
              setDraftFrom(r?.from);
              setDraftTo(r?.to);
            }}
            numberOfMonths={1}
            defaultMonth={draftFrom ?? new Date()}
          />
          <div className="flex items-center justify-end gap-2 p-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setDraftFrom(undefined);
                setDraftTo(undefined);
              }}
              className="h-7 px-2.5 rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!draftFrom || !draftTo}
              onClick={() => {
                if (draftFrom && draftTo) {
                  onChange({ preset: "custom", from: draftFrom, to: draftTo });
                  setOpen(false);
                }
              }}
              className="h-7 px-3 rounded-[var(--radius-sm)] text-[11px] font-medium bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { labelFor as labelForRange };
