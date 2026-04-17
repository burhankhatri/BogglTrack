"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Check, ChevronDown } from "lucide-react"
import { useAnchoredPosition } from "@/hooks/use-anchored-position"

interface SelectContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string
  onValueChange?: (value: string) => void
  // Track display label for the selected value
  labelMap: Map<string, React.ReactNode>
  registerLabel: (value: string, label: React.ReactNode) => void
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextValue>({
  open: false,
  onOpenChange: () => {},
  labelMap: new Map(),
  registerLabel: () => {},
  triggerRef: { current: null } as React.MutableRefObject<HTMLButtonElement | null>,
})

const Select = ({ children, value, onValueChange, defaultValue }: { children: React.ReactNode, value?: string, onValueChange?: (value: string) => void, defaultValue?: string }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue || value)
  const labelMapRef = React.useRef(new Map<string, React.ReactNode>())
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  // Force re-render when labels register
  const [, setLabelVersion] = React.useState(0)

  React.useEffect(() => {
    if (value !== undefined) setInternalValue(value)
  }, [value])

  const handleValueChange = (newValue: string) => {
    if (value === undefined) setInternalValue(newValue)
    if (onValueChange) onValueChange(newValue)
    setInternalOpen(false)
  }

  const registerLabel = React.useCallback((val: string, label: React.ReactNode) => {
    labelMapRef.current.set(val, label)
    setLabelVersion((v) => v + 1)
  }, [])

  return (
    <SelectContext.Provider value={{ open: internalOpen, onOpenChange: setInternalOpen, value: internalValue, onValueChange: handleValueChange, labelMap: labelMapRef.current, registerLabel, triggerRef }}>
      <div className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = React.useContext(SelectContext)
    return (
      <button
        ref={(node) => {
          triggerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] placeholder:text-[var(--text-olive)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-olive)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="flex-1 min-w-0 text-left">
          {children}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }>(
  ({ className, placeholder, ...props }, ref) => {
    const { value, labelMap } = React.useContext(SelectContext)
    const displayLabel = value ? labelMap.get(value) : null
    return (
      <span ref={ref} className={cn("truncate block", !value && "text-[var(--text-olive)] opacity-50", className)} {...props}>
        {displayLabel ?? placeholder}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, style, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = React.useContext(SelectContext)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const position = useAnchoredPosition({
      triggerRef,
      open,
      align: "start",
      matchWidth: true,
      estimatedHeight: 300,
    })

    // Close on click outside and Escape
    React.useEffect(() => {
      if (!open) return
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as Node
        if (contentRef.current?.contains(target)) return
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

    const content = (
      <div
        ref={(node) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        style={{
          position: "fixed",
          top: position?.top ?? -9999,
          left: position?.left ?? -9999,
          width: position?.width ? Math.max(position.width, 200) : undefined,
          visibility: position ? "visible" : "hidden",
          ...style,
        }}
        className={cn(
          "z-50 rounded-[var(--radius-md)] bg-[var(--bg-cream)] text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95 duration-100 max-h-[300px] overflow-y-auto",
          className
        )}
        {...props}
      >
        <div className="p-1">
          {children}
        </div>
      </div>
    )

    return createPortal(content, document.body)
  }
)
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, children, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange, registerLabel } = React.useContext(SelectContext)
    const isSelected = selectedValue === value

    // Register the display label for this item
    React.useEffect(() => {
      registerLabel(value, children)
    }, [value, children, registerLabel])

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2.5 pl-8 pr-4 text-sm outline-none hover:bg-[var(--bg-muted)] transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          isSelected && "text-[var(--text-forest)] font-semibold bg-[var(--bg-muted)]/50",
          className
        )}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4 text-[var(--accent-olive-hover)]" />}
        </span>
        <span className="min-w-0">{children}</span>
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

// Fallback components minimal
const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
)
SelectGroup.displayName = "SelectGroup"

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold text-[var(--text-olive)]", className)} {...props} />
  )
)
SelectLabel.displayName = "SelectLabel"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
}
