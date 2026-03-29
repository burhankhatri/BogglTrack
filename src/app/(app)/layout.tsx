import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalTimerBar } from "@/components/layout/global-timer-bar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <GlobalTimerBar />
        <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
        <MobileTabBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
