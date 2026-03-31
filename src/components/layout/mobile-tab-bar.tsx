"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Calendar, LayoutDashboard, User, List } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

const mobileTabs = [
  { title: "Home", href: "/", icon: LayoutDashboard },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Overview", href: "/tracking", icon: List },
  { title: "Profile", href: "/settings", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const prefetchForRoute = useAppStore((s) => s.prefetchForRoute);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-cream)] border-t border-[var(--border-subtle)] pb-safe z-50">
      <div className="flex items-center justify-around h-[80px] px-2 relative">
        {mobileTabs.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

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
      </div>
    </div>
  );
}
