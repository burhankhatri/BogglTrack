"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

const Tabs = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: string, onValueChange?: (v: string) => void, defaultValue?: string }>(
  ({ className, value, onValueChange, defaultValue, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || value)
    
    // Sync with external value
    React.useEffect(() => {
      if (value !== undefined) setInternalValue(value)
    }, [value])

    const handleValueChange = (newValue: string) => {
      if (value === undefined) setInternalValue(newValue)
      if (onValueChange) onValueChange(newValue)
    }

    return (
      <TabsContext.Provider value={{ value: internalValue, onValueChange: handleValueChange }}>
        <div ref={ref} className={cn("flex flex-col space-y-4", className)} {...props} />
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full bg-[var(--bg-muted)] p-1 text-[var(--text-olive)] ring-1 ring-[var(--border-subtle)] mx-auto",
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isSelected = context.value === value

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => context.onValueChange?.(value)}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
          isSelected 
            ? "bg-[var(--accent-olive)] text-[var(--text-forest)] shadow-sm"
            : "text-[var(--text-olive)] hover:text-[var(--text-forest)]",
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isSelected = context.value === value

    if (!isSelected) return null

    return (
      <div
        ref={ref}
        className={cn("w-full ring-offset-background focus-visible:outline-none", className)}
        {...props}
      />
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
