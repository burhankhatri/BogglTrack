import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] ring-offset-[var(--bg-cream)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--text-olive)] placeholder:opacity-50 focus-visible:outline-none focus-visible:border-[var(--accent-olive)] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
