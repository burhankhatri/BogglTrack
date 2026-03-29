"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Calendar, LayoutDashboard, User } from "lucide-react";

const mobileTabs = [
  { title: "Timer", href: "/timer", icon: Clock },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Profile", href: "/settings", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-around h-20 px-4">
        {mobileTabs.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-2xl transition-all ${
                isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`flex items-center justify-center w-auto h-auto transition-transform ${
                  isActive ? "scale-110" : "scale-100"
                }`}
              >
                <tab.icon
                  className={`h-6 w-6 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span className={`text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {tab.title}
              </span>
              {isActive && (
                <div className="absolute bottom-2 w-8 h-1 bg-primary rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
