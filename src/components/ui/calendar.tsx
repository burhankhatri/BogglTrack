"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar is a thin wrapper around react-day-picker v9.
 *
 * v9 restructured the class-name slot system (month_caption, weekdays,
 * weekday, week, day, day_button, selected, today, outside, etc.), and it
 * ships a default table-based layout we want to preserve. We merge our
 * overrides on top of `getDefaultClassNames()` so layout survives while
 * colors/hover/selection pick up the app's tokens.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-3 bg-[var(--bg-cream)] text-[var(--text-forest)] rounded-[var(--radius-lg)]",
        className
      )}
      classNames={{
        ...defaults,
        months: cn(defaults.months, "relative flex flex-col sm:flex-row gap-4"),
        month: cn(defaults.month, "space-y-3"),
        month_caption: cn(defaults.month_caption, "flex items-center justify-center h-9 px-8"),
        caption_label: cn(defaults.caption_label, "text-[13px] font-semibold text-[var(--text-forest)]"),

        nav: cn(defaults.nav, "absolute left-0 right-0 top-0 h-9 flex items-center justify-between px-1 pointer-events-none [&>button]:pointer-events-auto"),
        button_previous: cn(
          defaults.button_previous,
          "h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] transition-colors"
        ),
        button_next: cn(
          defaults.button_next,
          "h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] transition-colors"
        ),

        month_grid: cn(defaults.month_grid, "w-full border-collapse"),
        weekdays: cn(defaults.weekdays, "flex"),
        weekday: cn(
          defaults.weekday,
          "flex-1 h-8 inline-flex items-center justify-center text-[11px] font-medium uppercase tracking-wide text-[var(--text-olive)]"
        ),
        week: cn(defaults.week, "flex w-full mt-1"),

        day: cn(
          defaults.day,
          "flex-1 aspect-square p-0 text-center text-[13px] relative"
        ),
        day_button: cn(
          defaults.day_button,
          "w-full h-full inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20"
        ),

        selected: cn(
          defaults.selected,
          "[&>button]:bg-[var(--text-forest)] [&>button]:text-[var(--text-cream)] [&>button:hover]:bg-[var(--text-forest)] [&>button:hover]:text-[var(--text-cream)]"
        ),
        today: cn(
          defaults.today,
          "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-[var(--border-medium)] [&>button]:font-semibold"
        ),
        outside: cn(defaults.outside, "[&>button]:text-[var(--text-muted)] [&>button]:opacity-60"),
        disabled: cn(defaults.disabled, "[&>button]:text-[var(--text-muted)] [&>button]:opacity-40 [&>button]:cursor-not-allowed"),
        hidden: cn(defaults.hidden, "invisible"),

        range_start: cn(defaults.range_start, "[&>button]:rounded-r-none"),
        range_middle: cn(
          defaults.range_middle,
          "[&>button]:bg-[var(--bg-muted)] [&>button]:text-[var(--text-forest)] [&>button]:rounded-none"
        ),
        range_end: cn(defaults.range_end, "[&>button]:rounded-l-none"),

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: cls, ...rest }) => {
          if (orientation === "left") return <ChevronLeft className={cn("h-4 w-4", cls)} {...rest} />;
          if (orientation === "right") return <ChevronRight className={cn("h-4 w-4", cls)} {...rest} />;
          return null;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
