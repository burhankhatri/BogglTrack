"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
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
  Sun,
  Moon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Timer", href: "/timer", icon: Timer },
  { title: "Tracking", href: "/tracking", icon: List },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Tags", href: "/tags", icon: Tags },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">BogglTrack</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="ml-4">Toggle theme</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
