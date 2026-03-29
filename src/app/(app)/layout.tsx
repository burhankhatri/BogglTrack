import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalTimerBar } from "@/components/layout/global-timer-bar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-sage)]">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        <GlobalTimerBar />
        <main className="flex-1 overflow-y-auto bg-[var(--bg-sage)] p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
