"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useAnchoredPosition, type Align } from "@/hooks/use-anchored-position"

interface PopoverContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
}

const PopoverContext = React.createContext<PopoverContextValue>({
  open: false,
  onOpenChange: () => {},
  triggerRef: { current: null } as React.MutableRefObject<HTMLButtonElement | null>,
})

const Popover = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (open === undefined) setInternalOpen(newOpen)
    if (onOpenChange) onOpenChange(newOpen)
  }

  const isControlled = open !== undefined
  const currentOpen = isControlled ? open : internalOpen

  return (
    <PopoverContext.Provider value={{ open: currentOpen, onOpenChange: handleOpenChange, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, children, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = React.useContext(PopoverContext)
    return (
      <button
        ref={(node) => {
          triggerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
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

const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: Align }>(
  ({ className, align = "center", style, children, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = React.useContext(PopoverContext)
    const innerRef = React.useRef<HTMLDivElement>(null)
    const position = useAnchoredPosition({
      triggerRef,
      open,
      align,
      estimatedHeight: 340,
    })

    // Close on outside click and Escape
    React.useEffect(() => {
      if (!open) return
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as Node
        if (innerRef.current?.contains(target)) return
        if (triggerRef.current?.contains(target)) return
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
    }, [open, onOpenChange, triggerRef])

    if (!open) return null
    if (typeof document === "undefined") return null

    // If align=center, shift left by half the content width. We don't know
    // the width before measurement, so use a CSS translate for center-align.
    const translate = align === "center" ? "translateX(-50%)" : undefined

    const content = (
      <div
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        style={{
          position: "fixed",
          top: position?.top ?? -9999,
          left: position?.left ?? -9999,
          transform: translate,
          visibility: position ? "visible" : "hidden",
          ...style,
        }}
        className={cn(
          "z-50 w-72 rounded-[var(--radius-lg)] bg-[var(--bg-cream)] p-3 text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] outline-none animate-in zoom-in-95 duration-150",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )

    return createPortal(content, document.body)
  }
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
