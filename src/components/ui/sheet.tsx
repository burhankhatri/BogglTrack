"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { X } from "lucide-react"

const SheetContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
  open: false,
  onOpenChange: () => {},
})

const Sheet = ({ children, open, onOpenChange, defaultOpen = false }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void, defaultOpen?: boolean }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  
  React.useEffect(() => {
    if (open !== undefined) setInternalOpen(open)
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    if (open === undefined) setInternalOpen(newOpen)
    if (onOpenChange) onOpenChange(newOpen)
  }

  return (
    <SheetContext.Provider value={{ open: internalOpen, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = React.useContext(SheetContext)
    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onOpenChange(true)
          if (onClick) onClick(e)
        }}
        className={cn("", className)}
        {...props}
      />
    )
  }
)
SheetTrigger.displayName = "SheetTrigger"

const SheetContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "bottom" | "left" | "right" }>(
  ({ side = "right", className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(SheetContext)
    
    if (!open) return null
    return (
      <DialogPortal>
        <DialogOverlay className="z-50 backdrop-blur-sm transition-all duration-300">
          <div
            ref={ref}
            className={cn(
              "fixed z-50 gap-4 bg-[var(--bg-cream)] text-[var(--text-forest)] p-6 shadow-lg transition ease-in-out duration-300",
              side === "right" ? "inset-y-0 right-0 h-full w-3/4 border-l border-[var(--border-subtle)] sm:max-w-sm" : 
              side === "left" ? "inset-y-0 left-0 h-full w-3/4 border-r border-[var(--border-subtle)] sm:max-w-sm" :
              side === "top" ? "inset-x-0 top-0 border-b border-[var(--border-subtle)]" :
              "inset-x-0 bottom-0 border-t border-[var(--border-subtle)]",
              className
            )}
            onClick={e => e.stopPropagation()}
            {...props}
          >
            {children}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogOverlay>
      </DialogPortal>
    )
  }
)
SheetContent.displayName = "SheetContent"

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("font-serif text-lg font-semibold text-[var(--text-forest)]", className)}
      {...props}
    />
  )
)
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-[var(--text-olive)]", className)}
      {...props}
    />
  )
)
SheetDescription.displayName = "SheetDescription"

const SheetClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = React.useContext(SheetContext)
    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onOpenChange(false)
          if (onClick) onClick(e)
        }}
        className={cn("", className)}
        {...props}
      />
    )
  }
)
SheetClose.displayName = "SheetClose"

export {
  Sheet,
  DialogPortal as SheetPortal,
  DialogOverlay as SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
