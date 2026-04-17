"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerFieldProps {
  /** ISO date string, "yyyy-MM-dd". */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Size preset. "sm" matches inline edit rows; "md" matches form fields. */
  size?: "sm" | "md";
  /** How the selected date should be displayed. Default: "MMM d, yyyy". */
  displayFormat?: string;
}

/**
 * A date input that opens our Calendar in a popover. Shows the formatted date
 * on the trigger button, never a raw `yyyy-mm-dd` the user has to parse.
 * Replaces native `<input type="date">` for consistent styling across browsers.
 */
export function DatePickerField({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled = false,
  size = "md",
  displayFormat = "MMM d, yyyy",
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);

  const parsed = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  const displayLabel = parsed ? format(parsed, displayFormat) : "";

  const heightClass = size === "sm" ? "h-9 text-[13px]" : "h-10 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex w-full items-center gap-2 px-3",
          "bg-[var(--bg-muted)] text-[var(--text-forest)] rounded-[var(--radius-md)]",
          "hover:bg-[var(--bg-cream-hover)] transition-colors",
          "focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20 focus-visible:outline-none",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          heightClass,
          className
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-[var(--text-olive)]" />
        <span
          className={cn(
            "flex-1 text-left truncate",
            !displayLabel && "text-[var(--text-olive)]"
          )}
        >
          {displayLabel || placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(d: Date | undefined) => {
            if (!d) return;
            onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
