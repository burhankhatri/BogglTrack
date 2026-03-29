"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative overflow-auto scrollbar-thin scrollbar-thumb-[var(--accent-olive)] scrollbar-track-transparent rounded-[var(--radius-xl)]", className)}
      {...props}
    >
      <div className="h-full w-full">{children}</div>
    </div>
  )
)
ScrollArea.displayName = "ScrollArea"

const ScrollBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal" }>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex touch-none select-none transition-colors", orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-[1px]", orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-[1px]", className)}
      {...props}
    >
      <div className="relative flex-1 rounded-full bg-[var(--border-subtle)]" />
    </div>
  )
)
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
