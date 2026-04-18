"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { gsap } from "gsap"
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

// Walk the Select's JSX tree synchronously to collect (value → label) pairs
// from every SelectItem, even those whose SelectContent hasn't mounted yet.
// Without this, SelectValue reads from an empty map on first render and the
// trigger shows only the placeholder until the user opens the dropdown —
// so the "currently selected" state is invisible.
function collectLabels(nodes: React.ReactNode, map: Map<string, React.ReactNode>) {
  React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: React.ReactNode }
    if (typeof props.value === "string" && "children" in props) {
      map.set(props.value, props.children as React.ReactNode)
    }
    if (props.children) collectLabels(props.children, map)
  })
}

const Select = ({ children, value, onValueChange, defaultValue }: { children: React.ReactNode, value?: string, onValueChange?: (value: string) => void, defaultValue?: string }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue || value)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    if (value !== undefined) setInternalValue(value)
  }, [value])

  const handleValueChange = (newValue: string) => {
    if (value === undefined) setInternalValue(newValue)
    if (onValueChange) onValueChange(newValue)
    setInternalOpen(false)
  }

  // Derive labelMap from children every render. Cheap — Select trees rarely
  // have more than a few dozen items. This lets the trigger show the selected
  // label immediately, before the dropdown has ever been opened.
  const labelMap = React.useMemo(() => {
    const m = new Map<string, React.ReactNode>()
    collectLabels(children, m)
    return m
  }, [children])

  // Kept as a no-op for backwards-compat with SelectItem's registerLabel call.
  // Labels are now derived synchronously above; SelectItems don't need to
  // announce themselves.
  const registerLabel = React.useCallback(() => {}, [])

  return (
    <SelectContext.Provider value={{ open: internalOpen, onOpenChange: setInternalOpen, value: internalValue, onValueChange: handleValueChange, labelMap, registerLabel, triggerRef }}>
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

    // GSAP entrance — fires only once position is known so the tween starts
    // at the correct on-screen coordinates. Using useLayoutEffect + gsap.fromTo
    // sets the start state synchronously before paint (no flash of final state).
    React.useLayoutEffect(() => {
      if (!open || !position || !contentRef.current) return
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduced) {
        gsap.set(contentRef.current, { opacity: 1, scale: 1, y: 0 })
        return
      }
      const tween = gsap.fromTo(
        contentRef.current,
        { opacity: 0, scale: 0.96, y: -4 },
        { opacity: 1, scale: 1, y: 0, duration: 0.18, ease: "power2.out" }
      )
      return () => {
        tween.kill()
      }
    }, [open, position])

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
          // Disable ALL CSS transitions. Default transition-property is "all",
          // so any duration utility (e.g. duration-100) would make top/left
          // animate from -9999 to target on first positioned render — the flicker.
          transition: "none",
          transformOrigin: "top left",
          ...style,
        }}
        className={cn(
          "z-50 rounded-[var(--radius-md)] bg-[var(--bg-cream)] text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] max-h-[300px] overflow-y-auto",
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
