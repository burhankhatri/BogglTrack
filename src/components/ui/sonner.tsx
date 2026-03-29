"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--bg-cream)] group-[.toaster]:text-[var(--text-forest)] group-[.toaster]:border-[var(--border-subtle)] group-[.toaster]:shadow-[var(--shadow-dropdown)] group-[.toaster]:rounded-[var(--radius-xl)]",
          description: "group-[.toast]:text-[var(--text-olive)]",
          actionButton:
            "group-[.toast]:bg-[var(--accent-olive)] group-[.toast]:text-[var(--text-forest)]",
          cancelButton:
            "group-[.toast]:bg-[var(--bg-muted)] group-[.toast]:text-[var(--text-olive)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
