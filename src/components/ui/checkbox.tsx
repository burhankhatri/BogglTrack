"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded border border-[var(--border-medium)] bg-[var(--bg-cream)] accent-[var(--accent-teal)] transition-colors",
          "checked:bg-[var(--accent-teal)] checked:border-[var(--accent-teal)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-olive)] focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
