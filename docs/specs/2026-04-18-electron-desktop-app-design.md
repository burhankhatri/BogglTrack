# BogglTrack Desktop (macOS) — Design Spec

**Date:** 2026-04-18
**Author:** Claude + Burhan
**Status:** Approved to plan

---

## 1. Goal

Ship BogglTrack as a macOS desktop app that:
1. Installs by dragging a `.app` from a `.dmg` into `/Applications`.
2. Feels native — menu bar, Dock, Cmd+Q, traffic lights, notifications, global shortcut.
3. Uses the **same** Neon Auth credentials as the web app. Sign-in / sign-up / forgot-password inside the app.
4. Writes are **local-first**: every user action writes SQLite in <20ms; a background sync worker pushes changes to Neon.
5. Survives offline for hours/days; reconciles on reconnect with **server-authoritative LWW** (last-write-wins by `updatedAt`).
6. Looks and feels identical to the web app visually — same React UI, same theme tokens, same dark mode.

## 2. Architecture

```
╔══════════════════════════ BogglTrack.app ══════════════════════════╗
║                                                                    ║
║   ┌──────────────────────────┐   ┌────────────────────────────┐   ║
║   │ Electron main process    │   │ Renderer (BrowserWindow)   │   ║
║   │ (Node.js)                │   │ (Chromium)                 │   ║
║   │                          │   │                            │   ║
║   │ • Window lifecycle       │──►│ • Next.js UI via loadURL() │   ║
║   │ • Native menu bar        │   │   to http://localhost:PORT │   ║
║   │ • Tray / Dock / Badge    │◄──│ • IPC for native calls     │   ║
║   │ • Global shortcut        │   │ • Identical React code     │   ║
║   │ • Notifications          │   │   as web                   │   ║
║   │ • Auto-updater           │   └────────────────────────────┘   ║
║   │ • Forks:                 │                                    ║
║   │   - Next.js server       │                                    ║
║   │   - Sync worker          │                                    ║
║   └────┬─────────────────┬───┘                                    ║
║        │                 │                                         ║
║   ┌────▼──────────┐ ┌────▼────────────────────────────────────┐   ║
║   │ Next.js fork  │ │ Sync worker fork                        │   ║
║   │ (Node)        │ │ (Node)                                  │   ║
║   │               │ │                                         │   ║
║   │ next start    │ │ Every 15s or on write:                  │   ║
║   │ :51823        │ │   1. Read pending_ops from SQLite       │   ║
║   │               │ │   2. POST /api/sync/push to remote      │   ║
║   │ Prisma ──┐    │ │   3. GET /api/sync/pull?since=cursor    │   ║
║   │          ▼    │ │   4. Apply remote rows via LWW          │   ║
║   │       SQLite ◄┼─┘   5. Update sync_cursor                 │   ║
║   │               │                                           │   ║
║   └───────────────┘                                           │   ║
╚═══════════════════════════════════════════════════════════════╪═══╝
                                                                │ HTTPS
                                                                ▼
                                            ┌──────────────────────────────┐
                                            │ Vercel: boggl-track.vercel   │
                                            │ Next.js + Prisma + Neon PG   │
                                            │ Better Auth session cookies  │
                                            │ + new /api/sync/* routes     │
                                            └──────────────────────────────┘
```

### Key properties

- **Same React code** runs in both the browser (web) and the Electron renderer (desktop). One UI codebase.
- **Two Prisma datasources**: local SQLite for the desktop app, remote Neon Postgres for the web app + sync endpoints.
- **Next.js runs embedded** inside Electron on a random localhost port. No server round-trips over the network for read/write — the server is 2mm away.
- **Auth session cookie** lives in Electron's own `session.defaultSession` cookie store, tied to the remote API origin. Survives app restarts via Electron's persistent session partition.
- **Sync worker runs in a separate Node process** (Electron `utilityProcess` or forked child) so it doesn't block the UI even during large sync batches.

## 3. Local database

**Engine:** SQLite via Prisma's `sqlite` provider.
**Location:** `~/Library/Application Support/BogglTrack/boggltrack.db`
**Schema:** identical to current Postgres schema, with these additions on **every** table:

```prisma
updatedAt   DateTime @updatedAt    // present on some tables already; add to all
clientId    String                 // uuid of the writing client
deletedAt   DateTime?              // soft delete, needed for tombstone sync
```

**Sync metadata tables** (local-only, not synced):

```prisma
model SyncCursor {
  id         Int      @id @default(autoincrement())
  cursor     String   // ISO timestamp or opaque token from remote
  lastPullAt DateTime @default(now())
}

model PendingOp {
  id         Int      @id @default(autoincrement())
  tableName  String   // "TimeEntry", "Project", etc.
  rowId      String   // cuid of the row
  op         String   // "upsert" | "delete"
  payload    String   // JSON snapshot of the row at write time
  createdAt  DateTime @default(now())
  attempts   Int      @default(0)
  lastError  String?
}
```

## 4. Sync protocol (LWW, server-authoritative)

### Client ID

Generated once on first launch, stored in `~/Library/Application Support/BogglTrack/client-id`. Used to break `updatedAt` ties deterministically.

### Push (local → remote)

`POST /api/sync/push`
```json
{
  "clientId": "abc...",
  "ops": [
    {
      "table": "TimeEntry",
      "rowId": "cuid...",
      "op": "upsert",
      "row": { "id": "...", "description": "...", "updatedAt": "2026-04-18T10:00:00.000Z", "clientId": "abc...", ... }
    },
    { "table": "TimeEntry", "rowId": "cuid...", "op": "delete", "deletedAt": "..." }
  ]
}
```

Server behavior:
- For each op, compare incoming `updatedAt` vs stored row's `updatedAt`.
- If incoming is newer (or tie broken by lexicographic `clientId`), apply. Else drop.
- Return per-op result: `{ rowId, accepted: true | false, serverUpdatedAt }`.
- Response also includes `serverTime` for cursor advancement.

### Pull (remote → local)

`GET /api/sync/pull?since=<cursor>&limit=500`

Returns:
```json
{
  "rows": [
    { "table": "TimeEntry", "row": { ... } }
  ],
  "nextCursor": "2026-04-18T10:05:23.123Z",
  "hasMore": false
}
```

Scoped to the authenticated user. Uses `updatedAt > since` index on each table.
Sync cursor = max `updatedAt` across all tables the user has seen.

### Apply remote row locally

```
if local row doesn't exist → insert
if local row.updatedAt < remote.updatedAt → update
if local row.updatedAt > remote.updatedAt → keep local (local will push next)
if local row.updatedAt == remote.updatedAt → compare clientId lexicographically
if remote.deletedAt is set → soft-delete locally
```

### Sync cadence

- **On every local write:** enqueue a push debounced 2s (batches bursts).
- **Every 15s:** pull from remote.
- **On app focus:** immediate pull.
- **On app launch:** full pull using stored cursor.

### Conflict philosophy

Time tracking = rarely concurrent edits. LWW is correct 99.9% of the time. The 0.1% where two devices edit the same entry while offline → user's most recent write wins. Acceptable tradeoff.

## 5. Auth

Web auth is already Better Auth via `@neondatabase/auth` with a session cookie. Desktop reuses this:

1. On first launch, Electron opens `BrowserWindow` pointing to the embedded Next.js app's `/sign-in`.
2. User enters email + password. Form POSTs to the **remote** `/api/auth/...` endpoint (`boggl-track.vercel.app`), not local.
3. Better Auth sets a session cookie on `boggl-track.vercel.app` domain, stored in Electron's `session.defaultSession` cookie jar, persisted to disk by Electron.
4. That same cookie is attached to every `/api/sync/push` and `/api/sync/pull` request by the sync worker.
5. "Forgot password?" flow works identically — the email link points to `boggl-track.vercel.app/reset-password?token=...`, which opens in the user's default browser (external link), not inside the app (avoids email-link spoofing).
6. Sign out clears the cookie and also wipes the local SQLite DB (or moves it aside) so the next user starts clean.

**Why not local-first auth:** Neon Auth owns the password-hash store. Adding local credential storage would mean duplicating the auth system. Not worth it.

**Offline sign-in:** Not supported in v1. User must be online to sign in. Once signed in, the session cookie is valid for 30 days; the app works fully offline after that.

## 6. Native-feel details

This is where "Electron app" becomes "Mac app that happens to be Electron."

### Window
- **Title bar:** `titleBarStyle: "hiddenInset"` — hides the title bar but keeps traffic lights floating in the top-left. Matches Linear, Notion, Slack.
- **Traffic lights:** real (Electron gives them for free with hiddenInset).
- **Vibrancy:** `vibrancy: "sidebar"` on the window — gives the sidebar the translucent/blurry native Mac effect over the user's wallpaper.
- **Rounded corners:** automatic via macOS 11+.
- **Window state persistence:** remember size, position, and fullscreen state in `~/Library/Application Support/BogglTrack/window-state.json`.

### Menu bar
Native `NSMenu` via Electron's `Menu.setApplicationMenu`. Standard macOS menu layout:

```
BogglTrack  About · Settings (⌘,) · Services · Hide (⌘H) · Quit (⌘Q)
File        New Time Entry (⌘N) · Import... · Export... · Close Window (⌘W)
Edit        Undo · Redo · Cut · Copy · Paste · Select All · Find (⌘F)
View        Dashboard (⌘1) · Timer (⌘2) · Calendar (⌘3) · Tracking (⌘4) · Toggle Full Screen (⌃⌘F) · Toggle Dark Mode (⌘⇧D)
Timer       Start/Stop Timer (⌘T) · Resume Last
Window      Minimize (⌘M) · Zoom · BogglTrack (current)
Help        BogglTrack Help · Report Issue...
```

### Dock
- Icon (from provided logo, light neutral tile).
- Badge count: shows `▶` or elapsed minutes when a timer is running. Updates every minute.
- Right-click dock menu: "Start Timer", "Stop Timer", "Open Dashboard".

### Tray (menu bar extra, top-right of screen)
Optional. Small timer icon in the system menu bar.
- Click → popup panel: current timer status, start/stop button, quick-switch project.
- Keeps the user in their current app while checking/controlling the timer.

### Global shortcut
- **Cmd+Shift+T** — toggle timer from anywhere on the system. Default on, configurable in Settings.

### Notifications
Native `Notification` API:
- **Timer running for 4 hours:** "You've been tracking for 4h. Take a break?"
- **Timer running for 8 hours:** "Timer still running — forget to stop it?"
- **Sync error after 5 retries:** "Sync is failing. Check connection or Settings."

### Other polish
- **Cmd+,** opens Settings page (macOS convention).
- **About dialog:** native, with version + build number.
- **Spell-check:** enabled on all text inputs via `webPreferences.spellcheck = true`.
- **Native context menu:** on right-click in text fields, show NSTextView-style menu (Cut/Copy/Paste, plus Look Up, Speech, Services) via `electron-context-menu` package.
- **Cmd+Plus / Cmd+Minus:** zoom in/out. Persisted.
- **Link clicks** on external URLs (reset password emails, GitHub, etc.) open in the user's default browser, never in the app.
- **"Hide when closing last window"** — Cmd+W hides the window, Cmd+Q quits fully. Standard macOS behavior for single-window apps.
- **Auto-update:** `electron-updater` checks on launch + every 6 hours. Silent download, prompt to restart on next quit.

## 7. App icon

Source: provided logo (black stopwatch + arrow + "B").

Target: `icon.icns` containing:
- 16×16, 32×32, 64×64, 128×128, 256×256, 512×512, 1024×1024 (all @1x and @2x variants).
- Composed as **light tile**: black logo centered on `#FAFAFA` background, 20% padding, macOS squircle mask applied by the OS.

Also generated:
- `icon.png` (1024×1024) for Linux/Windows builds if we add them later.
- `favicon.png` and `apple-touch-icon.png` for web — same composition.
- `dmg-background.png` — 660×400 window with a left-side logo and drag-to-Applications arrow.

Pipeline: single source SVG → `scripts/build-icons.ts` → generates all sizes + `.icns`.

## 8. Packaging & distribution

- **Builder:** `electron-builder` (preferred over electron-forge for mature DMG + auto-update support).
- **Output:** `dist/BogglTrack-0.1.0-arm64.dmg` and `BogglTrack-0.1.0-x64.dmg` (both architectures).
- **DMG contents:** `.app` bundle + symlink to `/Applications` + background image with drag arrow.
- **Bundle size target:** ≤180MB per arch.

### Code signing (v1: unsigned)

User will see Gatekeeper warning on first open:
> "BogglTrack" can't be opened because Apple cannot check it for malicious software.

Workaround for first users: right-click → Open → Open Anyway.

**Mitigation in the DMG window:** include a small `README - First Launch.txt` that says:
> "macOS will show a warning the first time you open the app. Right-click BogglTrack in Applications → Open → Open Anyway. (We're working on Apple signing — coming soon.)"

### v2 (once Apple Developer account is ready)
- Add `CSC_LINK` + `CSC_KEY_PASSWORD` env vars to the build.
- Add `notarize` step with `APPLE_ID` + app-specific password.
- Users no longer see the warning.

## 9. Auto-update

- `electron-updater` checking GitHub Releases as the source.
- Release flow: `npm run release` → builds, signs (when ready), uploads `.dmg` + `latest-mac.yml` to a GitHub Release.
- On launch, app checks `latest-mac.yml` → if newer version, downloads in background → prompts on next quit.

## 10. Directory layout

```
BogglTrack/
├── electron/                       # NEW
│   ├── main.ts                     # Electron entry
│   ├── preload.ts                  # Preload script (IPC bridge)
│   ├── menu.ts                     # Native menu bar
│   ├── tray.ts                     # Menu bar extra (optional)
│   ├── window-state.ts             # Persist window size/pos
│   ├── server.ts                   # Fork + manage embedded Next.js
│   ├── sync-worker.ts              # Fork + manage sync worker
│   ├── updater.ts                  # electron-updater integration
│   └── assets/
│       ├── icon.icns
│       └── dmg-background.png
│
├── scripts/
│   ├── build-icons.ts              # NEW — logo.svg → icon.icns + all sizes
│   └── release.ts                  # NEW — package + publish
│
├── prisma/
│   ├── schema.prisma               # (existing) remote Postgres schema
│   └── schema.local.prisma         # NEW — SQLite schema with sync columns
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── sync/               # NEW
│   │   │       ├── push/route.ts
│   │   │       └── pull/route.ts
│   │   ├── ...(existing)
│   ├── lib/
│   │   ├── prisma.ts               # (existing) — switch based on IS_DESKTOP env
│   │   ├── sync/                   # NEW
│   │   │   ├── client.ts           # enqueuePush, startPullLoop
│   │   │   ├── lww.ts              # conflict resolution
│   │   │   └── types.ts
│   │   └── desktop/                # NEW
│   │       ├── is-desktop.ts       # runtime flag
│   │       └── ipc-client.ts       # renderer-side IPC helpers
│   └── components/ (existing, unchanged)
│
├── package.json                    # MODIFY — add electron scripts + build config
└── electron-builder.yml            # NEW — DMG/icon/notarize config
```

## 11. Development workflow

Three scripts:
- `npm run dev` — web dev (unchanged).
- `npm run dev:desktop` — boots Electron pointing at `localhost:3000`. Hot reload works because the Electron window is just a Chromium tab.
- `npm run dmg` — full production build. Builds Next.js standalone, bundles Prisma client + SQLite engine, compiles Electron, packages DMG via `electron-builder`.

## 12. Error handling

| Failure | Behavior |
|---|---|
| Offline during launch | App opens, reads from local SQLite, shows "Offline" badge in top-right. All user actions work. |
| Sign-in when offline | Sign-in page shows "Connect to the internet to sign in." Once online, form works. |
| Sync push fails (500, timeout) | Op stays in `PendingOp`, retries with exponential backoff (5s, 30s, 2min, 10min, 1hr). |
| Sync pull fails | Same. UI shows "Last synced: 3 min ago" in status bar; turns amber after 10min, red after 1hr. |
| Session cookie expired | App redirects to sign-in. Local data preserved. Sync resumes after re-auth. |
| Local DB corruption | App moves corrupt file to `boggltrack.db.corrupt.<timestamp>`, creates fresh DB, pulls full state from remote. User sees "Rebuilding local database..." toast. |
| Embedded Next.js fails to start | Electron shows a native error dialog with "Report Issue" button. Won't happen in practice — common causes are port conflicts (we pick a random free port). |
| Auto-update fails | Silent. App continues working. Retries next launch. |

## 13. Testing

- **Unit tests:** LWW resolver (`src/lib/sync/lww.test.ts`), sync payload encode/decode.
- **Integration tests:** spin up local SQLite + mock remote, verify push/pull/conflict scenarios.
- **E2E (desktop):** Playwright with `@playwright/test-electron` driver. Tests:
  - Sign in → create project → see it in local DB.
  - Offline → create entry → go online → entry appears on remote.
  - Two "clients" (two test Electron instances) → edit same entry → newer write wins.
  - Cmd+Q quits, Cmd+W hides window, Dock badge updates.
- **Manual QA checklist** (in `docs/plans/...desktop-qa.md`): 30-point list covering menu bar, shortcuts, dark mode, notifications, DMG install experience.

## 14. Out of scope for v1

- Windows / Linux builds.
- Code signing (v2).
- Apple Silicon-specific optimizations beyond universal binary.
- Multi-user / multi-account on same machine.
- Real-time collaborative editing (we chose LWW, not CRDT).
- Siri Shortcuts, Focus Filters, Widgets.
- Apple Watch companion.

## 15. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Prisma binary doesn't bundle cleanly into Electron asar | Medium | Well-documented; use `@prisma/client` + `prisma-binary-cache` or extract Prisma engines outside asar. |
| SQLite file locked by sync worker while Next.js writes | Low | WAL mode + single-writer pattern. Sync worker only reads + writes via the same Prisma client; Next.js API routes hold the write lock briefly. |
| Bundle size explodes past 250MB | Medium | Use `next build` in `standalone` mode, exclude dev deps, strip sourcemaps in prod. |
| Session cookie attached to wrong origin | Medium | Explicit `session.defaultSession.cookies.set` calls, configure CSP to only allow our API host. |
| User quits mid-sync, data lost | Low | `PendingOp` table survives restart. On next launch, worker resumes. |
| Gatekeeper blocks unsigned app | 100% in v1 | Clear README in DMG. Signing in v2. |
| Dark mode doesn't apply to title bar / vibrancy | Low | Electron `systemPreferences.setUserDefault("AppleInterfaceStyle")`, test both modes. |

## 16. Success criteria

A user can:
1. Download `BogglTrack-0.1.0-arm64.dmg` from our GitHub releases.
2. Double-click, drag to Applications, open (right-click → Open for unsigned v1).
3. See the app in their Dock with the new icon.
4. Sign in with their existing web credentials.
5. Start a timer, close the app, open it 5 seconds later — timer is still running with accurate elapsed time.
6. Go offline for an hour, create 10 time entries. Come back online. All 10 appear on the web app within 30s.
7. Hit Cmd+Shift+T from inside Xcode or any other app — BogglTrack's timer toggles.
8. Quit BogglTrack with Cmd+Q. Relaunch. Window is exactly where they left it.
9. Right-click in a description field → native macOS text menu.
10. Blindfold test: they can't tell it's Electron.
