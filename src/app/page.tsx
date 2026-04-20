import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { auth } from "@/lib/auth/server";
import { BrandLogo } from "@/components/ui/brand-logo";
import { LandingHero } from "@/components/landing/landing-hero";
import { MarqueeStrip } from "@/components/landing/marquee-strip";
import { PinnedCounter } from "@/components/landing/pinned-counter";
import { HorizontalFeatures } from "@/components/landing/horizontal-features";
import { DashboardReveal } from "@/components/landing/dashboard-reveal";
import { PlatformSplit } from "@/components/landing/platform-split";
import { FinalCTA } from "@/components/landing/final-cta";
import { ScrollProgress } from "@/components/landing/scroll-progress";

export const metadata = {
  title: "BogglTrack — Time tracking & earnings for freelancers",
  description:
    "Track time, manage projects, invoice clients. One tool, on the web and on your Mac. Same account, always in sync.",
};

export const dynamic = "force-dynamic";

const DMG_URL =
  "https://github.com/burhankhatri/BogglTrack/releases/latest/download/BogglTrack-0.2.0-arm64.dmg";
const DMG_INTEL_URL = "https://github.com/burhankhatri/BogglTrack/releases/latest";

export default async function LandingPage() {
  let isSignedIn = false;
  try {
    const { data: session } = await auth.getSession();
    if (session?.user) isSignedIn = true;
  } catch {
    isSignedIn = false;
  }

  const webAppHref = isSignedIn ? "/timer" : "/sign-up";
  const webAppLabel = isSignedIn ? "Open app" : "Use on the web";

  return (
    <div className="min-h-screen bg-[var(--bg-sage)] text-[var(--text-forest)] selection:bg-[var(--text-forest)] selection:text-white">
      <ScrollProgress />

      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-50 bg-[var(--bg-sage)]/80 backdrop-blur-md border-b border-[var(--border-subtle)]/50">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 decoration-transparent outline-none"
          >
            <BrandLogo size={28} />
            <span className="font-[family-name:var(--font-display)] text-[20px] font-bold tracking-tighter text-[var(--text-forest)]">
              BogglTrack
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-8 text-[14px] font-medium text-[var(--text-forest)]">
            <a href="#features" className="hover:opacity-70 transition-opacity">
              Features
            </a>
            <a href="#platforms" className="hover:opacity-70 transition-opacity">
              Platforms
            </a>
            {isSignedIn ? (
              <Link
                href="/timer"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 transition-opacity shadow-[inset_0_2px_0_rgba(255,255,255,0.15)]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Open app
              </Link>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/sign-in" className="hover:opacity-70 transition-opacity">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center h-9 px-4 rounded-md bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 transition-opacity shadow-[inset_0_2px_0_rgba(255,255,255,0.15)]"
                >
                  Get started
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <LandingHero
        webAppHref={webAppHref}
        webAppLabel={webAppLabel}
        dmgUrl={DMG_URL}
        dmgIntelUrl={DMG_INTEL_URL}
      />

      {/* ============ MARQUEE ============ */}
      <MarqueeStrip />

      {/* ============ PINNED MONEY COUNTER ============ */}
      <PinnedCounter />

      {/* ============ HORIZONTAL FEATURES ============ */}
      <div id="features">
        <HorizontalFeatures />
      </div>

      {/* ============ DASHBOARD REVEAL ============ */}
      <DashboardReveal />

      {/* ============ PLATFORM SPLIT ============ */}
      <div id="platforms">
        <PlatformSplit
          webAppHref={webAppHref}
          isSignedIn={isSignedIn}
          dmgUrl={DMG_URL}
        />
      </div>

      {/* ============ FINAL CTA ============ */}
      <FinalCTA webAppHref={webAppHref} webAppLabel={webAppLabel} dmgUrl={DMG_URL} />

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-cream)]">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-[14px] text-[var(--text-olive)] font-medium">
            <div className="flex items-center gap-3">
              <BrandLogo size={24} />
              <span className="font-[family-name:var(--font-display)] font-bold text-[var(--text-forest)] tracking-tight">
                BogglTrack
              </span>
              <span>© {new Date().getFullYear()}</span>
            </div>
            <nav className="flex items-center gap-8">
              {isSignedIn ? (
                <Link
                  href="/timer"
                  className="hover:text-[var(--text-forest)] transition-colors"
                >
                  Open app
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="hover:text-[var(--text-forest)] transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="hover:text-[var(--text-forest)] transition-colors"
                  >
                    Sign up
                  </Link>
                </>
              )}
              <a
                href={DMG_URL}
                className="hover:text-[var(--text-forest)] transition-colors"
                download
              >
                Download
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
