import Link from "next/link";
import {
  Download,
  Clock,
  Zap,
  Cloud,
  Keyboard,
  MonitorSmartphone,
  Apple,
  Globe,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Calendar,
  FileText,
} from "lucide-react";

export const metadata = {
  title: "BogglTrack — Time tracking & earnings for freelancers",
  description:
    "Track time, manage projects, invoice clients. One tool, on the web and on your Mac. Same account, always in sync.",
};

// Hosted on GitHub Releases (~205 MB, too big for a git-tracked public asset).
const DMG_URL =
  "https://github.com/burhankhatri/BogglTrack/releases/latest/download/BogglTrack-0.1.0-arm64.dmg";
// Intel build not published yet — redirect Intel visitors to the releases page.
const DMG_INTEL_URL = "https://github.com/burhankhatri/BogglTrack/releases/latest";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-sage)] text-[var(--text-forest)]">
      {/* ============ NAV ============ */}
      <header className="max-w-[1200px] mx-auto px-6 md:px-8 pt-6 pb-4 flex items-center justify-between">
        <Link href="/download" className="flex items-center gap-2.5 decoration-transparent">
          <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--text-forest)] flex items-center justify-center">
            <Clock className="h-4 w-4 text-[var(--text-cream)]" />
          </div>
          <span className="text-[18px] font-semibold tracking-tight">BogglTrack</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-[13px] font-medium text-[var(--text-olive)]">
          <a href="#features" className="hover:text-[var(--text-forest)] transition-colors">Features</a>
          <a href="#platforms" className="hover:text-[var(--text-forest)] transition-colors">Platforms</a>
          <Link href="/sign-in" className="hover:text-[var(--text-forest)] transition-colors">Sign in</Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center h-8 px-3 rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section className="max-w-[1200px] mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-cream)] text-[11px] font-medium text-[var(--text-olive)] mb-8 shadow-[var(--shadow-card)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-olive)] pulse-dot" />
          Now available on macOS
        </div>

        <h1 className="text-[44px] md:text-[64px] font-semibold tracking-tight leading-[1.05] max-w-[900px] mx-auto">
          Time tracking & earnings,
          <br />
          <span className="text-[var(--text-olive)]">built for freelancers.</span>
        </h1>

        <p className="mt-6 text-[16px] md:text-[18px] text-[var(--text-olive)] max-w-[620px] mx-auto leading-relaxed">
          Track every billable minute, manage projects and clients, and invoice in one click.
          Works in your browser. Feels at home on your Mac.
        </p>

        {/* Primary CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={DMG_URL}
            className="group inline-flex items-center gap-2.5 h-12 px-5 rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] text-[15px] font-medium hover:opacity-90 transition-opacity shadow-[var(--shadow-card)]"
            download
          >
            <Apple className="h-5 w-5" />
            Download for Mac
            <span className="ml-1 text-[12px] opacity-70 group-hover:opacity-100 transition-opacity">
              Apple Silicon
            </span>
          </a>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-[var(--radius-md)] bg-[var(--bg-cream)] text-[var(--text-forest)] text-[15px] font-medium hover:bg-[var(--bg-cream-hover)] transition-colors shadow-[var(--shadow-card)]"
          >
            <Globe className="h-4 w-4" />
            Use on the web
          </Link>
        </div>

        {/* Intel fallback + version line */}
        <p className="mt-4 text-[12px] text-[var(--text-muted)]">
          Apple Silicon (M1 – M4) ·{" "}
          <a href={DMG_INTEL_URL} className="underline hover:text-[var(--text-olive)]" download>
            Intel Mac
          </a>{" "}
          · macOS 12 Monterey or later · Free, no credit card
        </p>

        {/* App preview — mock dashboard card */}
        <div className="mt-16 md:mt-20 relative mx-auto max-w-[960px]">
          <div className="relative rounded-[var(--radius-xl)] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] overflow-hidden border border-[var(--border-subtle)]">
            {/* Mock traffic lights bar */}
            <div className="h-7 bg-[var(--bg-muted)] flex items-center px-3 gap-1.5 border-b border-[var(--border-subtle)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="flex-1 text-center text-[10px] text-[var(--text-muted)] font-medium">BogglTrack</span>
            </div>

            {/* Mock app UI preview */}
            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 bg-[var(--bg-sage)]/40">
              {/* Mock sidebar */}
              <div className="w-full md:w-[160px] shrink-0 space-y-1 text-left">
                {[
                  { label: "Dashboard", active: true },
                  { label: "Timer" },
                  { label: "Calendar" },
                  { label: "Projects" },
                  { label: "Clients" },
                  { label: "Invoices" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 h-8 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium ${
                      item.active
                        ? "bg-[var(--bg-muted)] text-[var(--text-forest)]"
                        : "text-[var(--text-olive)]"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Mock main panel */}
              <div className="flex-1 min-w-0 text-left space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[20px] font-semibold">Dashboard</h3>
                    <p className="text-[11px] text-[var(--text-olive)]">This week</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-olive)] pulse-dot" />
                    <span className="text-[13px] font-semibold tabular-nums">02:14:37</span>
                    <span className="text-[11px] text-[var(--text-olive)] tabular-nums">$187.43</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Today", hours: "2.3h", earn: "$187" },
                    { label: "Week", hours: "18.6h", earn: "$1,488" },
                    { label: "Month", hours: "74.2h", earn: "$5,936" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-olive)]">
                        {s.label}
                      </p>
                      <p className="mt-1 text-[18px] font-semibold tabular-nums">{s.hours}</p>
                      <p className="text-[11px] text-[var(--text-olive)] tabular-nums">{s.earn}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]">
                  <div className="flex items-end gap-1 h-14">
                    {[6, 8, 5, 9, 12, 7, 3].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[var(--accent-olive)] rounded-sm"
                        style={{ height: `${(h / 12) * 100}%`, opacity: 0.6 + i * 0.05 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platform chips under the preview */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-cream)] shadow-[var(--shadow-card)]">
              <Apple className="h-3 w-3" /> macOS
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-cream)] shadow-[var(--shadow-card)]">
              <Globe className="h-3 w-3" /> Web
            </span>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="max-w-[1200px] mx-auto px-6 md:px-8 py-16 md:py-24">
        <div className="text-center max-w-[680px] mx-auto mb-16">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--accent-olive-hover)] mb-3">
            Built for focus
          </p>
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-tight leading-[1.1]">
            Everything you need to track, bill, and move on.
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-olive)] leading-relaxed">
            No feature bloat. No popups. Just the tools freelancers actually open every day.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Clock,
              title: "One-click timer",
              body: "Start tracking from anywhere — web, Mac app, or a global hotkey. Running timer shows in your Dock and menu bar.",
            },
            {
              icon: DollarSign,
              title: "Earnings in real time",
              body: "Assign hourly rates per project or per client. Your dollar total ticks up as the clock runs.",
            },
            {
              icon: Calendar,
              title: "Calendar view",
              body: "See every entry laid out by day. Edit times, change projects, or resume a session in one click.",
            },
            {
              icon: FileText,
              title: "Invoices, fast",
              body: "Pick a date range, review the auto-generated line items, send a polished PDF. No spreadsheets.",
            },
            {
              icon: Keyboard,
              title: "Keyboard-first",
              body: "⌘T starts the timer. ⌘1–4 switches pages. ⌘⇧T works even when the app isn't focused.",
            },
            {
              icon: Cloud,
              title: "Synced everywhere",
              body: "Sign in once. Your data is there on any device, any browser, any Mac. Same account, same place.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="p-6 rounded-[var(--radius-lg)] bg-[var(--bg-cream)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-dropdown)] transition-shadow"
            >
              <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--bg-muted)] flex items-center justify-center mb-4">
                <Icon className="h-[18px] w-[18px] text-[var(--text-forest)]" />
              </div>
              <h3 className="text-[15px] font-semibold mb-1.5">{title}</h3>
              <p className="text-[13px] text-[var(--text-olive)] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ PLATFORMS SPLIT ============ */}
      <section
        id="platforms"
        className="max-w-[1200px] mx-auto px-6 md:px-8 py-16 md:py-24"
      >
        <div className="grid md:grid-cols-2 gap-4">
          {/* macOS card */}
          <div className="relative p-8 md:p-10 rounded-[var(--radius-xl)] bg-[var(--text-forest)] text-[var(--text-cream)] overflow-hidden">
            <Apple className="h-8 w-8 mb-5 opacity-90" />
            <h3 className="text-[24px] md:text-[28px] font-semibold tracking-tight">
              Native Mac app.
            </h3>
            <p className="mt-3 text-[14px] text-white/70 leading-relaxed max-w-[380px]">
              Lives in your Dock. Menu-bar timer. Global shortcuts. Cmd+Q quits.
              Feels like every other great Mac app on your machine.
            </p>

            <ul className="mt-6 space-y-2.5 text-[13px]">
              {[
                "Menu bar widget — start/stop from the top of the screen",
                "Global ⌘⇧T hotkey works from any app",
                "Native menu, notifications, dark mode",
                "Dock badge shows elapsed time when running",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent-olive)]" />
                  <span className="text-white/85">{f}</span>
                </li>
              ))}
            </ul>

            <a
              href={DMG_URL}
              download
              className="mt-8 inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--text-cream)] text-[var(--text-forest)] text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" />
              Download DMG
            </a>
          </div>

          {/* Web card */}
          <div className="relative p-8 md:p-10 rounded-[var(--radius-xl)] bg-[var(--bg-cream)] border border-[var(--border-subtle)] overflow-hidden">
            <Globe className="h-8 w-8 mb-5 text-[var(--text-forest)]" />
            <h3 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-[var(--text-forest)]">
              Open a browser, you&apos;re in.
            </h3>
            <p className="mt-3 text-[14px] text-[var(--text-olive)] leading-relaxed max-w-[380px]">
              No install. No update. Sign in on any Mac, PC, Linux box, phone — your
              timer and projects are right where you left them.
            </p>

            <ul className="mt-6 space-y-2.5 text-[13px]">
              {[
                "Zero install — works in any modern browser",
                "Same account across web + desktop",
                "Responsive on phone and tablet",
                "Perfect for shared or locked-down machines",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent-olive-hover)]" />
                  <span className="text-[var(--text-olive)]">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Open in browser
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ SNAPPY / CTA ============ */}
      <section className="max-w-[1200px] mx-auto px-6 md:px-8 py-16 md:py-24">
        <div className="p-10 md:p-16 rounded-[var(--radius-xl)] bg-[var(--bg-cream)] shadow-[var(--shadow-card)] text-center">
          <Zap className="h-6 w-6 mx-auto mb-5 text-[var(--accent-olive-hover)]" />
          <h2 className="text-[28px] md:text-[36px] font-semibold tracking-tight leading-[1.15] max-w-[560px] mx-auto">
            Snappy by default.
            <br />
            <span className="text-[var(--text-olive)]">Reliable when you need it.</span>
          </h2>
          <p className="mt-4 text-[15px] text-[var(--text-olive)] max-w-[560px] mx-auto leading-relaxed">
            Writes show up instantly. Sync happens in the background. Offline? Keep
            tracking — your entries land when you&apos;re back online.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={DMG_URL}
              download
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              <Apple className="h-4 w-4" />
              Download for Mac
            </a>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-md)] bg-[var(--bg-muted)] text-[var(--text-forest)] text-[14px] font-medium hover:bg-[var(--bg-cream-hover)] transition-colors"
            >
              <MonitorSmartphone className="h-4 w-4" />
              Try the web app
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 border-t border-[var(--border-subtle)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[var(--text-olive)]">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-[var(--radius-sm)] bg-[var(--text-forest)] flex items-center justify-center">
              <Clock className="h-3 w-3 text-[var(--text-cream)]" />
            </div>
            <span className="font-medium text-[var(--text-forest)]">BogglTrack</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/sign-in" className="hover:text-[var(--text-forest)] transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-[var(--text-forest)] transition-colors">
              Sign up
            </Link>
            <a href={DMG_URL} className="hover:text-[var(--text-forest)] transition-colors" download>
              Download
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
