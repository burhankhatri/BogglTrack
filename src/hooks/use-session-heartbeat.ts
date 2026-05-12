"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Tuned so we hit the heartbeat well inside better-auth's default refresh
// window (1 day on 7-day sessions). Four minutes also means a fresh tab gets
// a session check within ~4 min of opening — slightly faster than waiting on
// the next page navigation.
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Periodically pings /api/auth/heartbeat so the Neon Auth session keeps
 * rolling forward while the app is open. Pauses while the tab is hidden and
 * pings immediately on return. If the session is gone (401), surfaces one
 * sticky toast asking the user to sign back in — the running timer stays
 * safe in localStorage and resumes after sign-in.
 */
export function useSessionHeartbeat() {
  // Prevents duplicate "session expired" toasts if the heartbeat keeps
  // 401'ing. Reset once we see a successful response again.
  const expiredToastShownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;

      let res: Response;
      try {
        res = await fetch("/api/auth/heartbeat", { cache: "no-store" });
      } catch {
        return;
      }

      if (res.ok) {
        expiredToastShownRef.current = false;
        return;
      }

      if (res.status === 401 && !expiredToastShownRef.current) {
        expiredToastShownRef.current = true;
        toast.error("You've been signed out", {
          id: "session-expired",
          description:
            "Sign in again to keep your timer running — nothing was lost.",
          duration: Infinity,
          action: {
            label: "Sign in",
            onClick: () => {
              window.location.href = "/sign-in";
            },
          },
        });
      }
    };

    ping();
    const id = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
