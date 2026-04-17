"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Calendar,
  LayoutDashboard,
  List,
  FolderKanban,
  Users,
  Tags,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  GitBranchPlus,
  ChevronUp,
  GitCommit,
} from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

type NavItem = {
  title: string;
  href: string;
  icon: typeof Clock;
  /** When set, a small count chip renders to the right of the title. */
  badgeKey?: "untracked";
};

const navItems: NavItem[] = [
  { title: "Timer", href: "/timer", icon: Clock },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Tracking", href: "/tracking", icon: List },
  { title: "Canvas", href: "/canvas", icon: GitBranchPlus },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Tags", href: "/tags", icon: Tags },
  { title: "Untracked", href: "/untracked", icon: GitCommit, badgeKey: "untracked" },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Invoices", href: "/invoices", icon: FileText },
];

function prettifyName(raw: string | null | undefined): string {
  if (!raw) return "Account";
  // Insert a space between lowercase-uppercase transitions and capitalize each word.
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function initialsFor(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchForRoute = useAppStore((s) => s.prefetchForRoute);
  const settings = useAppStore((s) => s.settings.data);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSettings?.();
  }, [fetchSettings]);

  const displayName = prettifyName(settings?.name);
  const initials = initialsFor(displayName);

  // Untracked-commits badge. One probe on mount — the /untracked page itself
  // is where the detail lives; the sidebar just needs the count.
  const [untrackedCount, setUntrackedCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/github/untracked-commits?days=7");
        if (cancelled || !r.ok) return;
        const clusters = (await r.json()) as { commits: unknown[] }[];
        const n = clusters.reduce((s, c) => s + c.commits.length, 0);
        setUntrackedCount(n);
      } catch {
        // silent: no GitHub connection or network blip — don't show a badge
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <aside className="hidden md:flex w-[232px] flex-col bg-[var(--bg-cream)] border-r border-[var(--border-subtle)] h-screen z-10 shrink-0 relative">
      <div className="h-16 flex items-center px-5 border-b border-[var(--border-subtle)]">
        <Link href="/timer" className="flex items-center gap-2.5 decoration-transparent">
          <div className="h-7 w-7 rounded-md bg-[var(--text-forest)] flex items-center justify-center">
            <Clock className="h-3.5 w-3.5 text-[var(--text-cream)]" />
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-[var(--text-forest)]">
            BogglTrack
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-none">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => prefetchForRoute(item.href)}
              onFocus={() => prefetchForRoute(item.href)}
              className={cn(
                "relative flex items-center gap-2.5 h-9 px-3 text-[13px] font-medium rounded-[var(--radius-md)] transition-colors",
                isActive
                  ? "bg-[var(--bg-muted)] text-[var(--text-forest)]"
                  : "text-[var(--text-olive)] hover:bg-[var(--bg-muted)]/60 hover:text-[var(--text-forest)]"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[var(--text-forest)]"
                />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-[var(--text-forest)]" : "text-[var(--text-olive)]"
                )}
              />
              <span className="flex-1">{item.title}</span>
              {item.badgeKey === "untracked" && untrackedCount && untrackedCount > 0 && (
                <span
                  className="ml-auto inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded-full bg-[var(--accent-olive)]/15 text-[var(--accent-olive-hover)] text-[10px] font-semibold tabular-nums"
                  aria-label={`${untrackedCount} untracked commits`}
                >
                  {untrackedCount > 99 ? "99+" : untrackedCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Account — avatar popover replaces inline Sign out */}
      <div className="p-3 border-t border-[var(--border-subtle)] relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "w-full flex items-center gap-2.5 h-11 px-2.5 rounded-[var(--radius-md)] transition-colors",
            "hover:bg-[var(--bg-muted)]"
          )}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="h-7 w-7 rounded-full bg-[var(--bg-muted)] text-[11px] font-semibold text-[var(--text-forest)] inline-flex items-center justify-center tracking-tight">
            {initials}
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="block text-[13px] font-medium text-[var(--text-forest)] truncate">
              {displayName}
            </span>
            <span className="block text-[11px] text-[var(--text-olive)] truncate">Account</span>
          </span>
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 text-[var(--text-olive)] transition-transform",
              !menuOpen && "rotate-180"
            )}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute left-3 right-3 bottom-[calc(100%-4px)] rounded-[var(--radius-md)] bg-[var(--bg-cream)] p-1 shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95 duration-100"
          >
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              onMouseEnter={() => prefetchForRoute("/settings")}
              className="flex items-center gap-2.5 h-9 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              <Settings className="h-4 w-4 text-[var(--text-olive)]" />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 h-9 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors text-left"
            >
              <LogOut className="h-4 w-4 text-[var(--text-olive)]" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
