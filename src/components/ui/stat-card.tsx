import * as React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "./card"
import { cn } from "@/lib/utils"

export interface StatCardProps extends React.ComponentProps<typeof Card> {
  title: string
  value: string | React.ReactNode
  icon?: React.ReactNode
  valueClassName?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, icon, className, valueClassName, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col justify-between p-6", className)} {...props}>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="font-sans text-[13px] font-medium text-[var(--text-olive)]">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-[var(--text-olive)] opacity-70">
              {icon}
            </div>
          )}
        </div>
        <CardContent className="p-0">
          <div className={cn("font-sans text-4xl font-bold tracking-tight text-[var(--accent-olive)]", valueClassName)}>
            {value}
          </div>
        </CardContent>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
