import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "icon" | "ghost" | "outline" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-[var(--accent-olive)] text-[var(--text-forest)] hover:bg-[var(--accent-olive-hover)] shadow-sm":
              variant === "default",
            "bg-[var(--accent-olive)] text-[var(--text-forest)] hover:bg-[var(--accent-olive-hover)] hover:scale-105 rounded-full shadow-sm":
              variant === "icon",
            "hover:bg-[var(--bg-muted)] text-[var(--text-olive)] hover:text-[var(--text-forest)]":
              variant === "ghost",
            "border border-[var(--border-subtle)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)]":
              variant === "outline",
            "bg-[var(--accent-coral)] text-[var(--text-cream)] hover:opacity-90 shadow-sm":
              variant === "destructive",
            "h-10 px-6 py-2 rounded-full": size === "default" && variant !== "icon",
            "h-8 px-4 rounded-full text-xs": size === "sm" && variant !== "icon",
            "h-12 px-8 rounded-full": size === "lg" && variant !== "icon",
            "h-10 w-10 flex-shrink-0": variant === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
