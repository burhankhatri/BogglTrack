"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Toggle = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; onPressedChange?: (pressed: boolean) => void }>(
  ({ className, pressed = false, onPressedChange, ...props }, ref) => {
    const [internalPressed, setInternalPressed] = React.useState(pressed)

    React.useEffect(() => {
      setInternalPressed(pressed)
    }, [pressed])

    const handlePressedChange = (e: React.MouseEvent<HTMLButtonElement>) => {
      const newPressed = !internalPressed
      setInternalPressed(newPressed)
      if (onPressedChange) onPressedChange(newPressed)
      if (props.onClick) props.onClick(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={internalPressed}
        data-state={internalPressed ? "on" : "off"}
        onClick={handlePressedChange}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] text-sm font-medium transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-olive)] disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[var(--accent-olive)] data-[state=on]:text-[var(--text-forest)] bg-transparent",
          className
        )}
        {...props}
      />
    )
  }
)
Toggle.displayName = "Toggle"

export { Toggle }
