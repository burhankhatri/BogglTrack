"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronDown } from "lucide-react"

const SelectContext = React.createContext<{ 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  value?: string;
  onValueChange?: (value: string) => void;
}>({
  open: false,
  onOpenChange: () => {},
})

const Select = ({ children, value, onValueChange, defaultValue }: { children: React.ReactNode, value?: string, onValueChange?: (value: string) => void, defaultValue?: string }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue || value)

  React.useEffect(() => {
    if (value !== undefined) setInternalValue(value)
  }, [value])

  const handleValueChange = (newValue: string) => {
    if (value === undefined) setInternalValue(newValue)
    if (onValueChange) onValueChange(newValue)
    setInternalOpen(false)
  }

  return (
    <SelectContext.Provider value={{ open: internalOpen, onOpenChange: setInternalOpen, value: internalValue, onValueChange: handleValueChange }}>
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
          "flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] placeholder:text-[var(--text-olive)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-olive)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }>(
  ({ className, placeholder, ...props }, ref) => {
    const { value } = React.useContext(SelectContext)
    return (
      <span ref={ref} className={cn("truncate", !value && "text-[var(--text-olive)] opacity-50", className)} {...props}>
        {value ? value : placeholder}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(SelectContext)
    if (!open) return null
    
    return (
      <div
        ref={ref}
        className={cn(
          "absolute top-[calc(100%+4px)] z-50 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] text-[var(--text-forest)] shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95 duration-100 overflow-hidden max-h-[300px] overflow-y-auto",
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
    const { value: selectedValue, onValueChange } = React.useContext(SelectContext)
    const isSelected = selectedValue === value

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-[var(--bg-muted)] transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          isSelected && "text-[var(--text-forest)] font-semibold bg-[var(--bg-muted)]/50",
          className
        )}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4 text-[var(--accent-olive-hover)]" />}
        </span>
        <span className="truncate">{children}</span>
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
