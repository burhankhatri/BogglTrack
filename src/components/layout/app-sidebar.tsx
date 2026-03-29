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

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <Sidebar className="border-r border-border/50 bg-card">
      <SidebarHeader className="border-b border-border/50 px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <Clock className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-2xl font-serif text-foreground">BogglTrack</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
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
                      className={`h-11 px-4 text-[15px] font-medium rounded-xl transition-colors ${
                        isActive 
                          ? "bg-primary/20 text-foreground hover:bg-primary/30" 
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary' : ''}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              className="h-11 px-4 text-[15px] font-medium rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Settings className="h-5 w-5 mr-3" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="h-11 px-4 text-[15px] font-medium rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
