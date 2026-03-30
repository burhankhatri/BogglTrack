"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronDown } from "lucide-react"

interface SelectContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string
  onValueChange?: (value: string) => void
  // Track display label for the selected value
  labelMap: Map<string, React.ReactNode>
  registerLabel: (value: string, label: React.ReactNode) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  open: false,
  onOpenChange: () => {},
  labelMap: new Map(),
  registerLabel: () => {},
})

const Select = ({ children, value, onValueChange, defaultValue }: { children: React.ReactNode, value?: string, onValueChange?: (value: string) => void, defaultValue?: string }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue || value)
  const labelMapRef = React.useRef(new Map<string, React.ReactNode>())
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
    <SelectContext.Provider value={{ open: internalOpen, onOpenChange: setInternalOpen, value: internalValue, onValueChange: handleValueChange, labelMap: labelMapRef.current, registerLabel }}>
      <div className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(SelectContext)
    return (
      <button
        ref={ref}
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
        {displayLabel ?? (value ? value : placeholder)}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(SelectContext)
    const contentRef = React.useRef<HTMLDivElement>(null)

    // Close on click outside
    React.useEffect(() => {
      if (!open) return
      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node
        // Don't close if clicking inside the content or on the trigger
        if (contentRef.current?.contains(target)) return
        const trigger = contentRef.current?.parentElement?.querySelector('button')
        if (trigger?.contains(target)) return
        onOpenChange(false)
      }
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }, [open, onOpenChange])

    if (!open) return null

    return (
      <div
        ref={(node) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          "absolute top-[calc(100%+4px)] z-50 w-full min-w-[200px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95 duration-100 overflow-hidden max-h-[300px] overflow-y-auto",
          className
        )}
        {...props}
      >
        <div className="p-1">
          {children}
        </div>
      </div>
    )
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
          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm outline-none hover:bg-[var(--bg-muted)] transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
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
