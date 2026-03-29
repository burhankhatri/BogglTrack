"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { cn } from "@/lib/utils"

const COLORS = [
  "#2D6B5A", // Teal
  "#C8D84E", // Olive
  "#E8A5A0", // Coral
  "#D4D08E", // Gold
  "#7BA68A", // Soft Green
  "#1B3A2D", // Forest
  "#B5C438", // Olive Hover
  "#E2E8D5", // Muted
]

export interface ColorPickerProps {
  value?: string
  onChange?: (color: string) => void
  className?: string
}

const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  ({ value = COLORS[0], onChange, className }, ref) => {
    return (
      <Popover>
        <PopoverTrigger className={cn("h-10 w-10 p-0 rounded-full border border-[var(--border-subtle)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-olive)] transition-transform hover:scale-105", className)} style={{ backgroundColor: value }} />
        <PopoverContent className="w-64 p-3" align="start">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-olive)] transition-transform hover:scale-110",
                  value === color ? "ring-2 ring-[var(--text-forest)] ring-offset-2 ring-offset-[var(--bg-cream)]" : ""
                )}
                style={{ backgroundColor: color }}
                onClick={() => onChange?.(color)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)
ColorPicker.displayName = "ColorPicker"

export { ColorPicker }
