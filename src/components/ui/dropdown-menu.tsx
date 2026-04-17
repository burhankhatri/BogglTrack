"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useAnchoredPosition, type Align } from "@/hooks/use-anchored-position"

interface DropdownMenuContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  onOpenChange: () => {},
  triggerRef: { current: null } as React.MutableRefObject<HTMLButtonElement | null>,
})

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  return (
    <DropdownMenuContext.Provider value={{ open, onOpenChange: setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = React.useContext(DropdownMenuContext)
    return (
      <button
        ref={(node) => {
          triggerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn("focus:outline-none", className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: Align }>(
  ({ className, align = "end", style, children, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = React.useContext(DropdownMenuContext)
    const innerRef = React.useRef<HTMLDivElement>(null)
    const position = useAnchoredPosition({
      triggerRef,
      open,
      align,
      estimatedHeight: 280,
    })

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
          "z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius-md)] bg-[var(--bg-cream)] p-1 text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] animate-in fade-in-80 zoom-in-95 duration-150",
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
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, inset, onClick, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DropdownMenuContext)
    return (
      <div
        ref={ref}
        onClick={(e) => {
          onOpenChange(false)
          if (onClick) onClick(e)
        }}
        className={cn(
          "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2.5 text-sm outline-none transition-colors hover:bg-[var(--bg-muted)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          inset && "pl-8",
          className
        )}
        {...props}
      />
    )
  }
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold text-[var(--text-forest)]", inset && "pl-8", className)}
      {...props}
    />
  )
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("-mx-1 my-1 h-px bg-[var(--border-subtle)]", className)} {...props} />
  )
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
