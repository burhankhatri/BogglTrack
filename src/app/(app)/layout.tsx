"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalTimerBar } from "@/components/layout/global-timer-bar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

function RouteProgressBar() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      setShow(true);
      prevPath.current = pathname;
      const timer = setTimeout(() => setShow(false), 350);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  if (!show) return null;

  return (
    <div className="absolute top-0 left-0 right-0 h-[2px] z-50 overflow-hidden">
      <div
        className="h-full bg-[var(--accent-olive)]"
        style={{
          animation: "route-progress 350ms ease-out forwards",
        }}
      />
    </div>
  );
}

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
        <main
          className="flex-1 overflow-y-auto bg-[var(--bg-sage)] p-4 md:p-6 pb-24 md:pb-6 relative"
          style={{ viewTransitionName: "page-content" } as React.CSSProperties}
        >
          <RouteProgressBar />
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
