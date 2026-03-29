"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

const TooltipContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
})

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div 
        className="relative inline-block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <button ref={ref} type="button" className={cn("", className)} {...props}>
        {children}
      </button>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(TooltipContext)
    if (!open) return null

    return (
      <div
        ref={ref}
        role="tooltip"
        className={cn(
          "absolute z-50 mt-2 px-3 py-1.5 text-xs font-medium text-[var(--text-cream)] bg-[var(--text-forest)] rounded-[var(--radius-sm)] shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95 duration-100 whitespace-nowrap top-full left-1/2 -translate-x-1/2",
          className
        )}
        {...props}
      >
        {children}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-solid border-b-[var(--text-forest)] border-b-[4px] border-x-transparent border-x-[4px] border-t-0" />
      </div>
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
