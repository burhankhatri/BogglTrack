"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-[var(--bg-cream)] text-[var(--text-forest)] rounded-[var(--radius-xl)]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium font-serif",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center rounded-full hover:bg-[var(--bg-muted)] transition-colors"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-[var(--text-olive)] rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 m-0",
        day: cn(
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full hover:bg-[var(--bg-muted)] transition-colors flex items-center justify-center m-0"
        ),
        day_selected:
          "bg-[var(--accent-olive)] text-[var(--text-forest)] hover:bg-[var(--accent-olive-hover)] hover:text-[var(--text-forest)] focus:bg-[var(--accent-olive)] focus:text-[var(--text-forest)] font-semibold",
        day_today: "bg-[var(--bg-muted)] text-[var(--text-forest)] font-semibold",
        day_outside:
          "text-[var(--text-olive)] opacity-50 aria-selected:bg-[var(--accent-olive)]/50 aria-selected:text-[var(--text-forest)] aria-selected:opacity-30",
        day_disabled: "text-[var(--text-olive)] opacity-50",
        day_range_middle:
          "aria-selected:bg-[var(--accent-olive)] aria-selected:text-[var(--text-forest)] rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...props }: any) => {
          if (orientation === "left") return <ChevronLeft className="h-4 w-4" {...props} />
          if (orientation === "right") return <ChevronRight className="h-4 w-4" {...props} />
          return <></>;
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
