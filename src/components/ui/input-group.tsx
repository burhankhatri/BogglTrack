import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, prefix, suffix, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] focus-within:border-[var(--accent-olive)] transition-colors overflow-hidden h-10 w-full",
          className
        )}
        {...props}
      >
        {prefix && (
          <div className="flex items-center px-3 text-[var(--text-olive)] opacity-50 bg-[var(--bg-muted)]/30 h-full border-r border-[var(--border-subtle)] text-sm whitespace-nowrap">
            {prefix}
          </div>
        )}
        <div className="flex-1 h-full [&_input]:h-full [&_input]:border-0 [&_input]:ring-0 [&_input]:focus-visible:ring-0 [&_input]:focus-visible:border-0 [&_input]:rounded-none">
          {children}
        </div>
        {suffix && (
          <div className="flex items-center px-3 text-[var(--text-olive)] opacity-50 bg-[var(--bg-muted)]/30 h-full border-l border-[var(--border-subtle)] text-sm whitespace-nowrap">
            {suffix}
          </div>
        )}
      </div>
    )
  }
)
InputGroup.displayName = "InputGroup"

export { InputGroup }
