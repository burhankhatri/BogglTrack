"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const PopoverContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
  open: false,
  onOpenChange: () => {},
})

const Popover = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (open === undefined) setInternalOpen(newOpen)
    if (onOpenChange) onOpenChange(newOpen)
  }

  const isControlled = open !== undefined
  const currentOpen = isControlled ? open : internalOpen

  return (
    <PopoverContext.Provider value={{ open: currentOpen, onOpenChange: handleOpenChange }}>
      <div className="relative inline-block text-left">{children}</div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(PopoverContext)
    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onOpenChange(!open)
          if (onClick) onClick(e)
        }}
        className={cn("focus:outline-none", className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: "center" | "start" | "end" }>(
  ({ className, align = "center", children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(PopoverContext)
    const innerRef = React.useRef<HTMLDivElement>(null)

    // Close on outside click and Escape
    React.useEffect(() => {
      if (!open) return
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as Node
        if (innerRef.current?.contains(target)) return
        const trigger = innerRef.current?.parentElement?.querySelector("button")
        if (trigger?.contains(target)) return
        onOpenChange(false)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onOpenChange(false)
      }
      document.addEventListener("mousedown", onDocClick)
      document.addEventListener("keydown", onKey)
      return () => {
        document.removeEventListener("mousedown", onDocClick)
        document.removeEventListener("keydown", onKey)
      }
    }, [open, onOpenChange])

    if (!open) return null

    return (
      <div
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        className={cn(
          "absolute z-50 mt-2 w-72 rounded-[var(--radius-lg)] bg-[var(--bg-cream)] p-3 text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] outline-none animate-in zoom-in-95 duration-150",
          align === "center" ? "left-1/2 -translate-x-1/2" : align === "end" ? "right-0" : "left-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
