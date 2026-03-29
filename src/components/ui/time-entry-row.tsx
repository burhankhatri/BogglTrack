import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"
import { Play } from "lucide-react"
import { Button } from "./button"

export interface TimeEntryRowProps extends React.HTMLAttributes<HTMLDivElement> {
  description: string
  projectName?: string
  projectColor?: string
  duration: string
  onPlay?: () => void
}

const TimeEntryRow = React.forwardRef<HTMLDivElement, TimeEntryRowProps>(
  ({ className, description, projectName, projectColor, duration, onPlay, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn("flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0", className)}
        {...props}
      >
        <div className="flex flex-col gap-1 items-start">
          <span className="font-sans text-[15px] font-medium text-[var(--text-forest)]">
            {description || "(No description)"}
          </span>
          {projectName && (
            <Badge 
              variant="outline" 
              className="text-[13px]"
              style={projectColor ? { 
                color: projectColor,
                borderColor: projectColor,
                backgroundColor: `${projectColor}15` 
              } : undefined}
            >
              {projectName}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <span className="font-sans text-[15px] font-semibold tracking-tight text-[var(--text-forest)] tabular-nums">
            {duration}
          </span>
          {onPlay && (
            <Button variant="icon" size="icon" onClick={onPlay} className="h-9 w-9" title="Resume entry">
              <Play fill="currentColor" className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }
)
TimeEntryRow.displayName = "TimeEntryRow"

export { TimeEntryRow }
