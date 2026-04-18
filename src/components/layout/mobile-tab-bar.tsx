"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Clock,
  Calendar,
  User,
  List,
  GitBranchPlus,
  LayoutDashboard,
  FolderOpen,
  Users,
  Tag,
  AlertCircle,
  BarChart3,
  FileText,
  Settings as SettingsIcon,
  Menu,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";

// Primary tabs — the 4 most-frequent actions live here. The 5th slot opens
// a "More" sheet so every other route (Invoices, Projects, Reports…) stays
// one tap away. Mobile users kept hitting dead ends trying to invoice from
// their phone; this puts the whole nav in reach without squeezing 11 tabs.
const primaryTabs = [
  { title: "Timer", href: "/timer", icon: Clock },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Canvas", href: "/canvas", icon: GitBranchPlus },
  { title: "Overview", href: "/tracking", icon: List },
];

const moreRoutes = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderOpen },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Tags", href: "/tags", icon: Tag },
  { title: "Untracked", href: "/untracked", icon: AlertCircle },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Invoices", href: "/invoices", icon: FileText },
  { title: "Settings", href: "/settings", icon: SettingsIcon },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const prefetchForRoute = useAppStore((s) => s.prefetchForRoute);
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close sheet on Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const isInMoreRoute = moreRoutes.some((r) => pathname.startsWith(r.href));

  return (
    <>
      {/* Backdrop + sheet */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-40 animate-in fade-in-0 duration-150"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            className="md:hidden fixed bottom-[80px] left-3 right-3 z-50 bg-[var(--bg-cream)] rounded-[var(--radius-lg)] shadow-[var(--shadow-dropdown)] p-2 animate-in slide-in-from-bottom-2 fade-in-0 duration-150 border border-[var(--border-subtle)]"
          >
            <div className="grid grid-cols-4 gap-1">
              {moreRoutes.map((r) => {
                const active = pathname.startsWith(r.href);
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    onTouchStart={() => prefetchForRoute(r.href)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-[var(--radius-md)] transition-colors ${
                      active
                        ? "bg-[var(--bg-muted)] text-[var(--text-forest)]"
                        : "text-[var(--text-olive)] hover:bg-[var(--bg-muted)]/50"
                    }`}
                  >
                    <r.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[11px] font-medium">{r.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-cream)] border-t border-[var(--border-subtle)] pb-safe z-50">
        <div className="flex items-center justify-around h-[80px] px-2 relative">
          {primaryTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onTouchStart={() => prefetchForRoute(tab.href)}
                onMouseEnter={() => prefetchForRoute(tab.href)}
                className={`flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-all relative ${
                  isActive ? "text-[var(--text-forest)]" : "text-[var(--text-olive)] hover:text-[var(--text-forest)]"
                }`}
              >
                <div
                  className={`flex items-center justify-center transition-transform ${
                    isActive ? "scale-105" : "scale-100"
                  }`}
                >
                  <tab.icon
                    className={`h-6 w-6 ${isActive ? "text-[var(--text-forest)]" : "text-[var(--text-olive)]"}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span className={`text-xs font-medium ${isActive ? "text-[var(--text-forest)]" : "text-[var(--text-olive)]"}`}>
                  {tab.title}
                </span>
                {isActive && (
                  <div className="absolute top-0 w-8 h-1 bg-[var(--text-forest)] rounded-b-full shadow-sm" />
                )}
              </Link>
            );
          })}

          {/* More — opens the sheet. Active state when the current route is
              one of the "hidden" ones like /settings or /invoices. */}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-all relative ${
              moreOpen || isInMoreRoute
                ? "text-[var(--text-forest)]"
                : "text-[var(--text-olive)] hover:text-[var(--text-forest)]"
            }`}
          >
            {isInMoreRoute ? (
              <User
                className={`h-6 w-6 ${moreOpen || isInMoreRoute ? "text-[var(--text-forest)]" : "text-[var(--text-olive)]"}`}
                strokeWidth={2.5}
              />
            ) : (
              <Menu
                className={`h-6 w-6 ${moreOpen ? "text-[var(--text-forest)]" : "text-[var(--text-olive)]"}`}
                strokeWidth={moreOpen ? 2.5 : 2}
              />
            )}
            <span className="text-xs font-medium">More</span>
            {(moreOpen || isInMoreRoute) && (
              <div className="absolute top-0 w-8 h-1 bg-[var(--text-forest)] rounded-b-full shadow-sm" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
