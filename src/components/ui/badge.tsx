import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
        {
          "bg-[var(--bg-muted)] text-[var(--text-olive)]": variant === "default",
          "bg-[var(--accent-olive)] text-[var(--text-forest)]": variant === "secondary",
          "bg-[var(--accent-coral)] text-[var(--text-cream)]": variant === "destructive",
          "border border-[var(--border-subtle)] text-[var(--text-olive)]": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
