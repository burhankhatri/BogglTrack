# BogglTrack

Time tracking & earnings for freelancers. Runs on the web and as a native macOS app. Same account, same data, always in sync.

- **Web:** https://boggl-track.vercel.app
- **macOS DMG:** https://github.com/burhankhatri/BogglTrack/releases/latest

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4
- Prisma + Neon Postgres
- [Neon Auth](https://neon.tech/docs/neon-auth) (Better Auth) for sessions
- Electron 32 for the macOS desktop wrapper, `electron-builder` for DMGs, `electron-updater` for auto-updates
- Zustand for client state, Recharts for charts, `react-day-picker` v9 for date picking

## Run it

```bash
npm install
npm run dev              # web app at http://localhost:3000
npm run electron:dev     # Electron window loading localhost:3000
```

Required env vars (see `.env.example` if you add one — for now, check `src/lib/auth/server.ts` and `prisma/schema.prisma`):

```
DATABASE_URL=postgres://...          # Neon connection string
NEON_AUTH_BASE_URL=https://...       # Neon Auth URL from project settings
NEON_AUTH_COOKIE_SECRET=...          # 32+ char random string
```

## Project layout

```
src/app/
├── page.tsx              # public landing page (/) — session-aware
├── (app)/                # authenticated routes
│   ├── layout.tsx        # sidebar + global timer bar
│   ├── dashboard/        # /dashboard
│   ├── timer/            # /timer — track time
│   ├── calendar/         # /calendar — view by day
│   ├── projects/         # /projects — manage projects
│   ├── clients/          # /clients
│   ├── tags/             # /tags
│   ├── invoices/         # /invoices — generate PDFs
│   ├── reports/          # /reports
│   └── settings/         # /settings
├── (auth)/               # public auth flows
│   ├── sign-in/
│   ├── sign-up/
│   ├── forgot-password/
│   └── reset-password/
└── api/                  # route handlers (CRUD + auth)

src/components/
├── layout/               # sidebar, global timer bar, mobile tab bar
└── ui/                   # primitives (button, card, select, calendar, etc.)

electron/
├── main.js               # Electron entry (menu, tray, Dock, IPC, auto-updater)
├── preload.js            # renderer ↔ main bridge
└── assets/               # icon.icns, dmg-background.png, source SVGs

docs/
├── specs/                # design docs (what we're building + why)
└── plans/                # implementation plans (task-by-task)
```

## Docs

- **[AGENTS.md](AGENTS.md)** — agent/AI rules. Includes the mandatory desktop release procedure. Read this if you're shipping.
- **[DESIGN.md](DESIGN.md)** — design system reference (cal.com-inspired monochrome palette, typography, components).
- **[testing.md](testing.md)** — test infrastructure, commands, env setup.

## Shipping a desktop update

See `AGENTS.md` → `desktop-release-rules`. Short version:

```bash
# 1. Bump version in package.json AND src/app/page.tsx (DMG_URL filename)
# 2. Rebuild
rm -rf dist && npm run dmg
# 3. Release
gh release create desktop-vX.Y.Z \
  dist/BogglTrack-X.Y.Z-arm64.dmg \
  dist/BogglTrack-X.Y.Z-arm64.dmg.blockmap \
  dist/latest-mac.yml \
  --title "BogglTrack X.Y.Z" --notes "..."
# 4. Commit + push
```

Users on v0.2.0+ auto-update on next launch.

## License

Private — all rights reserved.
