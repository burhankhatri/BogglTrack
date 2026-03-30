# BogglTrack — Build Conversation Log

A full-stack time tracking app built from scratch with Claude Code. This document captures the entire build process from initialization to production deployment.

---

## Table of Contents

1. [Project Initialization](#1-project-initialization)
2. [Building Core Features](#2-building-core-features)
3. [TypeScript & Build Fixes](#3-typescript--build-fixes)
4. [API & Frontend Verification](#4-api--frontend-verification)
5. [Timer Fix & Tracking Page](#5-timer-fix--tracking-page)
6. [Git Commits & Push to GitHub](#6-git-commits--push-to-github)
7. [Adding Neon Auth (Per-User Authentication)](#7-adding-neon-auth-per-user-authentication)
8. [Fixing Auth on Production](#8-fixing-auth-on-production)
9. [Timer UX & Production Hardening](#9-timer-ux--production-hardening)
10. [OG Image Fix for Social Sharing](#10-og-image-fix-for-social-sharing)

---

## 1. Project Initialization

### User
> Build **BogglTrack** — a full-stack time tracking and earnings management app for freelancers. *(Full prompt with tech stack, Prisma schema, all 12 pages, API routes, and build order provided)*

### Claude
Checked the project directory, confirmed `.env` with `DATABASE_URL` was present. Then executed the build plan:

- **Created Next.js project** with TypeScript, Tailwind CSS v4, App Router
- **Installed all dependencies**: Prisma, shadcn/ui, Zustand, Recharts, date-fns, jsPDF, lucide-react, next-themes
- **Set up Prisma schema** with models: User, Client, Project, Tag, TimeEntry, TimeEntryTag
- **Pushed schema to Neon PostgreSQL** — database synced successfully
- **Initialized shadcn/ui** and installed 23+ components (button, card, dialog, table, tabs, calendar, popover, etc.)

---

## 2. Building Core Features

### Claude
Built the entire app using **parallel agents** for maximum speed:

**Foundation files created:**
- `src/lib/prisma.ts` — Prisma singleton client
- `src/lib/user.ts` — Default user utility (auto-create on first API call)
- `src/lib/earnings.ts` — Rate hierarchy, currency formatting, duration formatting
- `src/lib/constants.ts` — Project colors, currencies, date presets
- `src/stores/timer-store.ts` — Zustand timer store with start/stop/restore/tick

**Layout & navigation:**
- Collapsible sidebar with 7 nav items
- Global timer bar (always visible, sticky at top)
- Theme provider with dark/light/system mode

**All 15 API routes created:**
- Time entries: CRUD, running timer detection, stop endpoint
- Projects: CRUD with time aggregations and budget tracking
- Clients: CRUD with project counts and earnings totals
- Tags: CRUD with usage counts
- Dashboard: aggregated today/week/month stats, earnings trend, top projects
- Reports: summary (grouped), detailed (paginated), weekly grid
- Settings: GET/PATCH for user preferences

**All 8 pages built:**
- Dashboard (summary cards, earnings chart, top projects, recent entries)
- Timer (start/stop, manual entry, entry list grouped by day)
- Projects (grid with budget progress, detail page with charts)
- Clients (table with CRUD and aggregations)
- Tags (list with color picker and usage counts)
- Reports (filters, summary/detailed/weekly tabs, CSV/PDF export)
- Settings (profile, rates, currency, preferences, theme)

---

## 3. TypeScript & Build Fixes

### Claude
Fixed multiple TypeScript errors caused by **base-ui (not Radix)** components in shadcn/ui v4:

- **Select `onValueChange`** passes `string | null` — added null guards across all files
- **PopoverTrigger** doesn't support `asChild` — replaced with inline buttons
- **SidebarMenuButton** uses `render` prop instead of `asChild` — fixed pattern
- **Recharts formatter** type mismatch — removed explicit type annotation
- **Removed `prisma.config.ts`** (Prisma v5 doesn't need it)
- **Reinstalled `node_modules`** after corruption

Final result: **Clean production build with zero TypeScript errors** across all 24 routes.

---

## 4. API & Frontend Verification

### Claude
Verified every feature works end-to-end:

| Feature | Status |
|---------|--------|
| `npm run build` | ✅ Clean, no errors |
| All 7 pages return 200 | ✅ `/`, `/timer`, `/projects`, `/clients`, `/tags`, `/reports`, `/settings` |
| All 17 API routes return 200 | ✅ All CRUD + aggregation endpoints |
| Default user auto-created | ✅ "Freelancer" with $50/hr rate |
| Timer start/stop flow | ✅ Creates entry, computes duration (66s test) |
| Running timer detection | ✅ `GET /api/time-entries/running` returns active entry |
| Project CRUD | ✅ Create with color, rate, budget |
| Client CRUD | ✅ Create with email, aggregations |
| Tag CRUD | ✅ Create with color, usage counts |
| Dashboard aggregations | ✅ Today/week/month stats, 30-day earnings trend, top projects |
| Reports APIs | ✅ Summary (grouped), detailed (paginated), weekly (grid) |
| Settings PATCH | ✅ Update name, rate, currency, preferences |
| Dark/light theme | ✅ next-themes integration |
| Prisma + Neon DB connected | ✅ Read/write confirmed |

---

## 5. Timer Fix & Tracking Page

### User
> Issues clicking starting it didn't feel instant. Also add a discovery page with all of the tracking which looks like this *(Toggl screenshot provided)*

### Claude
**Fix 1 — Optimistic timer start:**
- Previously: Click Start → wait for API → then show timer (noticeable delay)
- Now: Click Start → timer ticks immediately → API saves in background → rollback on failure
- Added `setEntryId` action to Zustand store for updating temp ID after API responds
- Added temp-ID guard on stop to handle race conditions

**Fix 2 — New Tracking page (`/tracking`):**
- Entries grouped by day with date labels and daily duration totals
- Within each day, entries collapsed by project with count badges
- Clean, read-only Toggl-style overview
- Added "Tracking" nav item to sidebar between Timer and Projects

Both changes verified with preview screenshots — tracking page shows grouped entries correctly, dashboard still renders with real data.

---

## 6. Git Commits & Push to GitHub

### User
> Push to this repo with meaningful multiple commits and don't add Claude as author. Also make it Vercel ready if it isn't already.

### Claude
Created **11 meaningful commits** with clean separation:

```
f84866c feat: add tracking discovery page with Toggl-style entry overview
16e8b53 feat: add reports page with summary, detailed, and weekly views
985d1dd feat: add clients, tags, and settings pages
7e88e5c feat: add projects list and detail pages
2051d71 feat: add timer page with manual entry and time entry list
bc3758a feat: add dashboard with summary cards, earnings chart, and recent entries
95f4959 feat: add all API routes for time entries, projects, clients, tags, reports, and settings
e58e862 feat: add app layout with sidebar navigation and global timer bar
36dd42f feat: add core utilities and Zustand timer store
f7e9b55 feat: add shadcn/ui component library
757a5e9 chore: set up project with Prisma schema and dependencies
```

**Vercel-ready:** Added `prisma generate` to build script and `postinstall` hook. `.env` gitignored. Just needs `DATABASE_URL` env var on Vercel.

---

## 7. Adding Neon Auth (Per-User Authentication)

### User
> Add auth according to user since every user has their own data. *(Neon Auth docs and dashboard config provided)*

### Claude
Read the Neon Auth docs and implemented full authentication:

**Files created:**
- `src/lib/auth/server.ts` — Server auth instance with `createNeonAuth`
- `src/lib/auth/client.ts` — Client auth instance with `createAuthClient`
- `src/app/api/auth/[...path]/route.ts` — Auth API catch-all handler
- `src/app/(auth)/sign-in/page.tsx` — Sign-in page (client-side SDK)
- `src/app/(auth)/sign-up/page.tsx` — Sign-up page (client-side SDK)
- `src/app/(auth)/layout.tsx` — Minimal auth layout (no sidebar)
- `middleware.ts` — Route protection (redirects to `/sign-in`)

**Files modified:**
- `src/lib/user.ts` — Replaced `getDefaultUser()` with `getAuthUser()` (finds/creates app user from Neon Auth session)
- All 15 API routes — Changed import to `getAuthUser`, added 401 response on null
- `src/components/layout/app-sidebar.tsx` — Added sign-out button
- Restructured into route groups: `(app)` for authenticated pages, `(auth)` for sign-in/sign-up

**Build fix:** Auth init wrapped in `initAuth()` function that returns null during build time when env vars aren't available.

Env vars needed on Vercel: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`

---

## 8. Fixing Auth on Production

### User
> Invalid origin is what I get when I try signing up. *(Evidence: `{"error":"Invalid origin"}` in network tab)*

### Claude
**Root cause:** Neon Auth's server rejects requests from origins not in the trusted domains list. The Vercel domain wasn't added to Neon Auth's configuration.

**Code fix:** Rewrote sign-in/sign-up pages from server actions to client-side SDK (`authClient.signIn.email()` / `authClient.signUp.email()`) with proper error display and loading states.

**Required user action:** Add `https://boggl-track.vercel.app` to Neon Console → Auth → Configuration → Domains.

### User
> Fixed! Now another problem — when I started a timer it said failed to start a timer. In the network tab it calls the sign-in network request (POST 405 Method Not Allowed).

### Claude
**Root cause:** The auth middleware was intercepting ALL `/api/*` routes (except `/api/auth`). When the middleware couldn't find a session cookie, it redirected to `/sign-in` — even for API POST requests, causing 405.

**Fix:** Changed middleware matcher from `api/auth` (only excluding auth API) to `api` (excluding ALL API routes). API routes already protect themselves with `getAuthUser()` → 401 JSON response.

```typescript
// Before (broken):
matcher: ["/((?!sign-in|sign-up|api/auth|_next|favicon|.*\\..*).*)"]

// After (fixed):
matcher: ["/((?!sign-in|sign-up|api|_next|favicon|.*\\..*).*)"]
```

---

## 9. Timer UX & Production Hardening

### User
> Stopping the timer didn't feel instant. Also the dashboard doesn't update dynamically as soon as I stop the timer. Is this prod ready? Please verify if users can trust it.

### Claude
**Fix 1 — Optimistic timer stop:**
```typescript
// Before: await API → then stopTimer()
// After: stopTimer() immediately → API saves in background
```

**Fix 2 — Auto-refresh on timer stop:**
Added `window.dispatchEvent(new Event("timer-stopped"))` after successful API save. Dashboard, Timer page, and Tracking page all listen for this event and re-fetch data.

**Fix 3 — Browser tab title:**
Shows `01:23:45 - BogglTrack` while timer is running — visible even when on other tabs.

**Production security audit (all fixed):**

| Issue | Fix |
|-------|-----|
| Unvalidated pagination params (NaN risk) | Added NaN fallback + 200 cap |
| PATCH endpoints accept arbitrary fields (mass assignment) | Whitelisted allowed fields on all update endpoints |
| Invalid date strings stored in DB | Added date validation returning 400 |
| `getAuthUser()` crashes on DB failure | Wrapped in try-catch, returns null |

**Timer persistence verified:**
- Timer stored in DB with `endTime = null`
- Survives browser close, page refresh, device switch
- Restores with correct elapsed time on return

---

## 10. OG Image Fix for Social Sharing

### User
> Is the OG image in the right place? Will it appear when I share on WhatsApp?

### Claude
Files were correctly placed at `src/app/opengraph-image.png` and `src/app/twitter-image.png` (Next.js auto-generates meta tags).

**Issue:** `metadataBase` was falling back to `http://localhost:3000` because `NEXT_PUBLIC_APP_URL` wasn't set on Vercel. WhatsApp's scraper couldn't fetch the image.

**Fix:** Updated `metadataBase` to use Vercel's auto-set `VERCEL_PROJECT_PRODUCTION_URL`:
```typescript
metadataBase: new URL(
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
),
```

OG image now resolves to `https://boggl-track.vercel.app/opengraph-image.png`.

---

## Final State

**Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Neon PostgreSQL |
| ORM | Prisma 5 |
| Auth | Neon Auth (Better Auth) |
| Charts | Recharts |
| Timer State | Zustand |
| Date Utils | date-fns |
| Export | jsPDF (PDF) + CSV |
| Icons | Lucide React |
| Deployment | Vercel |

**Pages:** Dashboard, Timer, Tracking, Projects (list + detail), Clients, Tags, Reports, Settings, Sign-in, Sign-up

**API Routes:** 17 endpoints covering time entries, projects, clients, tags, dashboard, reports, settings, and auth

**Production URL:** [https://boggl-track.vercel.app](https://boggl-track.vercel.app)

**Repository:** [https://github.com/burhankhatri/BogglTrack](https://github.com/burhankhatri/BogglTrack)
