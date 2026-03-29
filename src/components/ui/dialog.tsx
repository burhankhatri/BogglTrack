"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
  open: false,
  onOpenChange: () => {},
})

const Dialog = ({ children, open, onOpenChange, defaultOpen = false }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void, defaultOpen?: boolean }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  
  React.useEffect(() => {
    if (open !== undefined) setInternalOpen(open)
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    if (open === undefined) setInternalOpen(newOpen)
    if (onOpenChange) onOpenChange(newOpen)
  }

  return (
    <DialogContext.Provider value={{ open: internalOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext)
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
DialogTrigger.displayName = "DialogTrigger"

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  const { open } = React.useContext(DialogContext)
  if (!open) return null
  return <div>{children}</div>
}

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext)
    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 z-50 bg-[var(--text-forest)]/30 backdrop-blur-[2px] backdrop-filter flex items-center justify-center animate-in fade-in-0 duration-200",
          className
        )}
        onClick={() => onOpenChange(false)}
        {...props}
      />
    )
  }
)
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext)
    
    return (
      <DialogPortal>
        <DialogOverlay>
          <div
            ref={ref}
            className={cn(
              "z-50 max-w-lg w-full rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] p-6 shadow-[var(--shadow-dropdown)] animate-in zoom-in-95 duration-200 flex flex-col mx-4 max-h-[90vh]",
              className
            )}
            onClick={(e) => e.stopPropagation()}
            {...props}
          >
            {children}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-6 top-6 rounded-full opacity-70 ring-offset-[var(--bg-cream)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-olive)] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[var(--accent)] data-[state=open]:text-[var(--muted-foreground)]"
            >
              <X className="h-4 w-4 text-[var(--text-forest)]" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogOverlay>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = "DialogContent"

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-6", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("font-serif text-2xl font-semibold leading-none tracking-tight text-[var(--text-forest)]", className)}
      {...props}
    />
  )
)
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-[var(--text-olive)]", className)}
      {...props}
    />
  )
)
DialogDescription.displayName = "DialogDescription"

const DialogClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext)
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
DialogClose.displayName = "DialogClose"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
