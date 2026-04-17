import * as React from "react"
import { Card, CardContent, CardTitle } from "./card"
import { cn } from "@/lib/utils"

export interface StatCardProps extends React.ComponentProps<typeof Card> {
  title: string
  value: string | React.ReactNode
  icon?: React.ReactNode
  valueClassName?: string
  /** Visually de-emphasizes the card when value represents "no data yet". */
  muted?: boolean
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, icon, className, valueClassName, muted = false, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "flex flex-col justify-between p-5",
          muted && "bg-[var(--bg-muted)]/40",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between mb-2">
          <CardTitle
            className={cn(
              "font-sans text-[12px] font-medium uppercase tracking-[0.04em]",
              muted ? "text-[var(--text-muted)]" : "text-[var(--text-olive)]"
            )}
          >
            {title}
          </CardTitle>
          {icon && (
            <div
              className={cn(
                muted ? "text-[var(--text-muted)]" : "text-[var(--text-olive)]",
                "opacity-80"
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <CardContent className="p-0">
          <div
            className={cn(
              "font-sans text-[28px] font-semibold tracking-tight leading-none",
              muted ? "text-[var(--text-muted)]" : "text-[var(--text-forest)]",
              valueClassName
            )}
          >
            {value}
          </div>
        </CardContent>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
