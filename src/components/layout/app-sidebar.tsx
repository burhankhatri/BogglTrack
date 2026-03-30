"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  LayoutDashboard,
  Timer,
  List,
  FolderKanban,
  Users,
  Tags,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Timer", href: "/timer", icon: Clock },
  { title: "Tracking", href: "/tracking", icon: List },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Tags", href: "/tags", icon: Tags },
  { title: "Reports", href: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchForRoute = useAppStore((s) => s.prefetchForRoute);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <aside className="hidden md:flex w-[240px] flex-col bg-[var(--bg-cream)] border-r border-[var(--border-subtle)] h-screen z-10 transition-all duration-300 shrink-0 shadow-sm relative">
      <div className="h-20 flex items-center px-6 border-b border-[var(--border-subtle)]">
        <Link href="/" className="flex items-center gap-3 decoration-transparent">
          <div className="h-8 w-8 rounded-full bg-[var(--accent-olive)] flex items-center justify-center shadow-sm">
            <Clock className="h-4 w-4 text-[var(--text-forest)]" />
          </div>
          <span className="text-2xl font-serif font-semibold text-[var(--text-forest)]">BogglTrack</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-none">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => prefetchForRoute(item.href)}
              onFocus={() => prefetchForRoute(item.href)}
              className={cn(
                "flex items-center gap-3 h-11 px-4 text-[14px] font-medium rounded-xl transition-all",
                isActive
                  ? "bg-[var(--accent-olive)]/20 text-[var(--text-forest)]"
                  : "text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)]"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-[var(--accent-olive)]" : "text-inherit")} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border-subtle)] space-y-1">
        <Link
          href="/settings"
          onMouseEnter={() => prefetchForRoute("/settings")}
          onFocus={() => prefetchForRoute("/settings")}
          className="flex items-center gap-3 h-11 px-4 text-[14px] font-medium rounded-xl text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] transition-all"
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 h-11 px-4 text-[14px] font-medium rounded-xl text-[var(--text-olive)] hover:bg-[var(--accent-coral)]/10 hover:text-[var(--accent-coral)] transition-all text-left"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
