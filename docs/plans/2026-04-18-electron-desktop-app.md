# BogglTrack Desktop — Implementation Plan

**Goal:** Ship a native-feeling macOS Electron app with local-first SQLite + background LWW sync to Neon.
**Architecture:** Electron main process forks an embedded Next.js server + a sync worker; renderer loads the same React UI; local SQLite via Prisma; remote Neon via new `/api/sync/*` routes.
**Tech Stack:** Electron 30+, electron-builder, electron-updater, better-sqlite3 (via Prisma SQLite), existing Next.js 16 + Prisma + Neon Auth.

**Spec:** `docs/specs/2026-04-18-electron-desktop-app-design.md`

**Phases (each lands independently):**
1. Electron shell + embedded Next.js (no local DB yet, hits remote)
2. Local SQLite via dual Prisma schema
3. Sync engine (LWW push/pull) + remote routes
4. Native polish (menu bar, tray, shortcuts, dock, notifications)
5. Icon pipeline + DMG packaging
6. Auto-update + release automation

---

## Phase 1 — Electron shell + embedded Next.js

Goal: double-click a `.app`, see the existing BogglTrack UI in a real window. No local DB yet — app hits the remote Vercel backend for everything. Proves the shell works.

### Task 1.1: Add Electron deps + scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install deps**
  ```
  npm i -D electron@^32 electron-builder@^25 concurrently@^9 cross-env@^7 wait-on@^8 tsx@^4
  ```

- [ ] **Step 2: Add scripts to `package.json`**
  Add to `"scripts"`:
  ```json
  "dev:desktop": "concurrently -k -n next,electron -c blue,magenta \"npm run dev\" \"wait-on http://localhost:3000 && cross-env ELECTRON_IS_DEV=1 tsx electron/main.ts\"",
  "build:desktop": "npm run build && tsc -p electron/tsconfig.json",
  "dmg": "npm run build:desktop && electron-builder --mac dmg --publish never"
  ```
  Add `"main": "electron/dist/main.js"` at top level.

- [ ] **Step 3: Commit**
  ```
  git add package.json package-lock.json
  git commit -m "chore(desktop): add Electron dev dependencies and scripts"
  ```

### Task 1.2: Electron TypeScript config

**Files:**
- Create: `electron/tsconfig.json`

- [ ] **Step 1: Write the config**
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "commonjs",
      "lib": ["ES2022"],
      "outDir": "./dist",
      "rootDir": ".",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true
    },
    "include": ["**/*.ts"],
    "exclude": ["dist", "node_modules"]
  }
  ```

- [ ] **Step 2: Add `electron/dist/` to `.gitignore`**
  Append:
  ```
  electron/dist/
  dist/
  ```

- [ ] **Step 3: Commit**
  ```
  git add electron/tsconfig.json .gitignore
  git commit -m "chore(desktop): Electron tsconfig and ignore build artifacts"
  ```

### Task 1.3: Minimal Electron main process (dev mode)

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Write `electron/preload.ts`**
  ```ts
  import { contextBridge, ipcRenderer } from "electron";

  // Minimal bridge. We'll add more channels in later phases.
  contextBridge.exposeInMainWorld("boggl", {
    platform: process.platform,
    versions: process.versions,
    onMenu: (handler: (action: string) => void) => {
      ipcRenderer.on("menu-action", (_e, action: string) => handler(action));
    },
  });
  ```

- [ ] **Step 2: Write `electron/main.ts`**
  ```ts
  import { app, BrowserWindow, shell } from "electron";
  import * as path from "node:path";

  const IS_DEV = process.env.ELECTRON_IS_DEV === "1";

  async function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      titleBarStyle: "hiddenInset",
      vibrancy: "sidebar",
      visualEffectState: "active",
      backgroundColor: "#FAFAFA",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: true,
      },
    });

    win.once("ready-to-show", () => win.show());

    // External links open in default browser, not inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    const url = IS_DEV ? "http://localhost:3000" : "http://localhost:51823";
    await win.loadURL(url);
  }

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  ```

- [ ] **Step 3: Verify dev mode opens a window**
  Run: `npm run dev:desktop`
  Expected: a macOS window opens with the BogglTrack sign-in page. Traffic lights visible top-left. Cmd+Q quits. Cmd+W closes.

- [ ] **Step 4: Commit**
  ```
  git add electron/main.ts electron/preload.ts
  git commit -m "feat(desktop): minimal Electron main process with dev hot-reload"
  ```

### Task 1.4: Detect desktop runtime in the app

**Files:**
- Create: `src/lib/desktop/is-desktop.ts`

- [ ] **Step 1: Write detection helper**
  ```ts
  "use client";

  /**
   * True when the React code is running inside the Electron renderer.
   * The preload exposes `window.boggl` — presence = desktop.
   */
  export function isDesktop(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { boggl?: unknown }).boggl);
  }
  ```

- [ ] **Step 2: Commit**
  ```
  git add src/lib/desktop/is-desktop.ts
  git commit -m "feat(desktop): runtime flag for detecting Electron renderer"
  ```

### Task 1.5: Window state persistence

**Files:**
- Create: `electron/window-state.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the state module**
  ```ts
  import { app, BrowserWindow, Rectangle } from "electron";
  import * as fs from "node:fs";
  import * as path from "node:path";

  interface SavedState {
    bounds: Rectangle;
    isMaximized: boolean;
    isFullScreen: boolean;
  }

  const DEFAULT: SavedState = {
    bounds: { x: 0, y: 0, width: 1280, height: 800 },
    isMaximized: false,
    isFullScreen: false,
  };

  function statePath() {
    return path.join(app.getPath("userData"), "window-state.json");
  }

  export function loadState(): SavedState {
    try {
      const raw = fs.readFileSync(statePath(), "utf8");
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch {
      return DEFAULT;
    }
  }

  export function attach(win: BrowserWindow) {
    const save = () => {
      try {
        const state: SavedState = {
          bounds: win.getBounds(),
          isMaximized: win.isMaximized(),
          isFullScreen: win.isFullScreen(),
        };
        fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
      } catch {
        // best-effort
      }
    };
    win.on("close", save);
    win.on("resize", save);
    win.on("move", save);
  }
  ```

- [ ] **Step 2: Wire it into `main.ts`**
  Replace the hardcoded width/height with `loadState().bounds`, and call `attach(win)` after creation. Restore fullscreen/maximize flags.

- [ ] **Step 3: Verify**
  Run: `npm run dev:desktop`. Resize + move window, Cmd+Q. Relaunch.
  Expected: window opens at the last size/position.

- [ ] **Step 4: Commit**
  ```
  git add electron/window-state.ts electron/main.ts
  git commit -m "feat(desktop): persist window size/position across launches"
  ```

### Task 1.6: Smoke-test that sign-in works in the window

- [ ] **Step 1: Launch**
  Run: `npm run dev:desktop`

- [ ] **Step 2: Manual verify**
  - Sign in with real Neon Auth credentials.
  - Navigate Dashboard → Timer → Calendar.
  - Resize window, confirm layout responsive.
  - Cmd+Q quits. Relaunch. Still signed in (cookie persisted by Electron's default session).

- [ ] **Step 3: Commit the phase as a tag**
  ```
  git tag phase-1-shell-working
  git push origin main phase-1-shell-working
  ```

---

## Phase 2 — Local SQLite via dual Prisma schema

Goal: when `IS_DESKTOP=1`, Prisma reads/writes a SQLite file in the user's Application Support directory. Web keeps using Neon Postgres. Schema has sync columns (`updatedAt`, `clientId`, `deletedAt`).

### Task 2.1: Add sync columns to Postgres schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add columns to every user-owned table**
  For each model (`TimeEntry`, `Project`, `Client`, `Tag`, `TagOnTimeEntry`, `Invoice`, `InvoiceLine`, `UserSettings`), add:
  ```prisma
  updatedAt DateTime @updatedAt
  clientId  String   @default("server")
  deletedAt DateTime?

  @@index([userId, updatedAt])
  ```
  (Skip `clientId` default and use `@default("server")` so existing rows get a non-null value.)

- [ ] **Step 2: Generate migration**
  ```
  npx prisma migrate dev --name add_sync_columns
  ```

- [ ] **Step 3: Verify the migration SQL**
  Open `prisma/migrations/<timestamp>_add_sync_columns/migration.sql`.
  Confirm: `ADD COLUMN "updatedAt"`, `ADD COLUMN "clientId"`, `ADD COLUMN "deletedAt"`, and `CREATE INDEX` for each table.

- [ ] **Step 4: Commit**
  ```
  git add prisma/schema.prisma prisma/migrations
  git commit -m "feat(sync): add updatedAt/clientId/deletedAt sync columns to all user tables"
  ```

### Task 2.2: Create local SQLite schema

**Files:**
- Create: `prisma/schema.local.prisma`

- [ ] **Step 1: Duplicate `schema.prisma` as `schema.local.prisma`**
  Same model definitions, but replace the datasource block:
  ```prisma
  datasource db {
    provider = "sqlite"
    url      = env("LOCAL_DATABASE_URL")
  }

  generator client {
    provider = "prisma-client-js"
    output   = "../node_modules/.prisma/client-local"
  }
  ```
  Also add the two sync-meta tables:
  ```prisma
  model SyncCursor {
    id         Int      @id @default(autoincrement())
    cursor     String
    lastPullAt DateTime @default(now())
  }

  model PendingOp {
    id         Int      @id @default(autoincrement())
    tableName  String
    rowId      String
    op         String
    payload    String
    createdAt  DateTime @default(now())
    attempts   Int      @default(0)
    lastError  String?
  }
  ```

- [ ] **Step 2: Convert Postgres-specific types to SQLite-compatible**
  - Replace `@db.Text` with nothing (SQLite has no TEXT variant).
  - Replace any `Json` columns with `String` (store JSON as text) — there shouldn't be any in the current schema; verify with `grep "Json" prisma/schema.prisma`.
  - `DateTime` works on both.

- [ ] **Step 3: Add script to generate both clients**
  In `package.json` scripts:
  ```json
  "prisma:generate:all": "prisma generate && prisma generate --schema=prisma/schema.local.prisma"
  ```
  Update `postinstall` to call it instead of `prisma generate`.

- [ ] **Step 4: Run it**
  ```
  npm run prisma:generate:all
  ```
  Expected: both `@prisma/client` and `.prisma/client-local` exist under `node_modules`.

- [ ] **Step 5: Commit**
  ```
  git add prisma/schema.local.prisma package.json package-lock.json
  git commit -m "feat(desktop): SQLite schema mirror with sync meta tables"
  ```

### Task 2.3: Prisma client switcher

**Files:**
- Modify: `src/lib/prisma.ts` (or wherever Prisma is instantiated — check with `grep -rn "new PrismaClient" src`)

- [ ] **Step 1: Read existing Prisma setup**
  Find the singleton that creates `PrismaClient`. Typical shape:
  ```ts
  import { PrismaClient } from "@prisma/client";
  export const prisma = globalThis.__prisma ?? new PrismaClient();
  ```

- [ ] **Step 2: Rewrite to conditionally load the local client**
  ```ts
  import type { PrismaClient as RemoteClient } from "@prisma/client";

  type AnyPrisma = RemoteClient;
  declare global {
    var __prisma: AnyPrisma | undefined;
  }

  function createClient(): AnyPrisma {
    if (process.env.IS_DESKTOP === "1") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require(".prisma/client-local") as typeof import("@prisma/client");
      return new PrismaClient();
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
    return new PrismaClient();
  }

  export const prisma = globalThis.__prisma ?? createClient();
  if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;
  ```

- [ ] **Step 3: Verify web still works**
  Run: `npm run dev`
  Expected: web app loads, hits Neon, no TS errors.

- [ ] **Step 4: Commit**
  ```
  git add src/lib/prisma.ts
  git commit -m "feat(desktop): Prisma client switches to SQLite when IS_DESKTOP=1"
  ```

### Task 2.4: Seed + prepare the local DB on first launch

**Files:**
- Create: `electron/local-db.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write `electron/local-db.ts`**
  ```ts
  import { app } from "electron";
  import * as fs from "node:fs";
  import * as path from "node:path";
  import { execFileSync } from "node:child_process";

  export function localDbPath(): string {
    return path.join(app.getPath("userData"), "boggltrack.db");
  }

  export function localDbUrl(): string {
    return `file:${localDbPath()}`;
  }

  export function ensureLocalDb() {
    const dbFile = localDbPath();
    if (fs.existsSync(dbFile)) return;

    // Run prisma migrate deploy against the local schema to create tables.
    const prismaBin = path.join(process.resourcesPath ?? process.cwd(), "node_modules", ".bin", "prisma");
    execFileSync(prismaBin, [
      "migrate", "deploy",
      "--schema=prisma/schema.local.prisma",
    ], {
      env: { ...process.env, LOCAL_DATABASE_URL: localDbUrl() },
      stdio: "inherit",
    });
  }
  ```

- [ ] **Step 2: Create local migrations folder**
  ```
  npx prisma migrate dev --schema=prisma/schema.local.prisma --name init
  ```
  This creates `prisma/migrations-local/<timestamp>_init/`. Move or rename to `prisma/migrations/` of the local schema so `migrate deploy` picks it up. (Prisma looks next to the schema file.)

- [ ] **Step 3: Call `ensureLocalDb()` in main.ts BEFORE creating the window**
  ```ts
  import { ensureLocalDb, localDbUrl } from "./local-db";

  app.whenReady().then(async () => {
    process.env.IS_DESKTOP = "1";
    process.env.LOCAL_DATABASE_URL = localDbUrl();
    ensureLocalDb();
    await createWindow();
  });
  ```

- [ ] **Step 4: Generate a client ID on first launch**
  Append to `local-db.ts`:
  ```ts
  import { randomUUID } from "node:crypto";

  export function getClientId(): string {
    const p = path.join(app.getPath("userData"), "client-id");
    try {
      return fs.readFileSync(p, "utf8").trim();
    } catch {
      const id = randomUUID();
      fs.writeFileSync(p, id);
      return id;
    }
  }
  ```
  Set `process.env.CLIENT_ID = getClientId()` in main.ts before `createWindow`.

- [ ] **Step 5: Verify**
  Run: `npm run dev:desktop`.
  Check: `ls ~/Library/Application\ Support/BogglTrack/`
  Expected: `boggltrack.db` and `client-id` files exist.

- [ ] **Step 6: Commit**
  ```
  git add electron/local-db.ts electron/main.ts prisma/migrations-local
  git commit -m "feat(desktop): provision local SQLite DB and client ID on first launch"
  ```

### Task 2.5: Embedded Next.js server in production build

**Files:**
- Create: `electron/server.ts`
- Modify: `electron/main.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Enable Next.js standalone output**
  In `next.config.ts`, add:
  ```ts
  output: "standalone",
  ```
  Rebuild: `npm run build`. Confirm `.next/standalone/` exists.

- [ ] **Step 2: Write `electron/server.ts`**
  ```ts
  import { fork, ChildProcess } from "node:child_process";
  import * as path from "node:path";
  import * as net from "node:net";

  async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.on("error", reject);
      srv.listen(0, () => {
        const port = (srv.address() as net.AddressInfo).port;
        srv.close(() => resolve(port));
      });
    });
  }

  export async function startEmbeddedNext(resourcesPath: string): Promise<{ port: number; proc: ChildProcess }> {
    const port = await getFreePort();
    const entry = path.join(resourcesPath, "app", ".next", "standalone", "server.js");
    const proc = fork(entry, [], {
      env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
      cwd: path.dirname(entry),
      silent: false,
    });

    // Wait for server to be ready.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Next.js server didn't start in 10s")), 10_000);
      const tryConnect = () => {
        const s = net.createConnection({ host: "127.0.0.1", port }, () => {
          clearTimeout(timeout);
          s.end();
          resolve();
        });
        s.on("error", () => setTimeout(tryConnect, 100));
      };
      tryConnect();
    });

    return { port, proc };
  }
  ```

- [ ] **Step 3: Wire into main.ts**
  ```ts
  import { startEmbeddedNext } from "./server";

  let nextProc: ChildProcess | null = null;

  app.whenReady().then(async () => {
    // ...existing setup
    if (!IS_DEV) {
      const { port, proc } = await startEmbeddedNext(process.resourcesPath);
      nextProc = proc;
      process.env.NEXT_PORT = String(port);
    }
    await createWindow();
  });

  app.on("before-quit", () => {
    nextProc?.kill();
  });
  ```
  And update `createWindow` to use `process.env.NEXT_PORT` when `!IS_DEV`.

- [ ] **Step 4: Test with a manual prod build**
  ```
  npm run build
  npm run build:desktop
  cross-env NODE_ENV=production electron electron/dist/main.js
  ```
  Expected: window opens, embedded Next.js serves the UI from a random localhost port. Sign in works against remote Neon.

- [ ] **Step 5: Commit**
  ```
  git add electron/server.ts electron/main.ts next.config.ts
  git commit -m "feat(desktop): embed Next.js standalone server as forked child process"
  ```

### Task 2.6: Verify Phase 2 — desktop writes land in local SQLite

- [ ] **Step 1: Launch**
  `npm run dev:desktop`

- [ ] **Step 2: Manual test**
  - Sign in.
  - Create a project.
  - Start + stop a timer.
  - Quit the app.
  - Run: `sqlite3 ~/Library/Application\ Support/BogglTrack/boggltrack.db "SELECT id, name FROM Project;"`
  - Expected: the project you created appears locally.

  Note: at this point the web and desktop are **diverged** — nothing syncs yet. That's Phase 3.

- [ ] **Step 3: Tag**
  ```
  git tag phase-2-local-db-working
  git push origin main phase-2-local-db-working
  ```

---

## Phase 3 — Sync engine (LWW push/pull)

Goal: every local write enqueues a pending op; a sync worker process pushes batched ops to the remote `/api/sync/push`, pulls remote changes via `/api/sync/pull`, applies LWW. On offline, ops queue. On reconnect, queue drains.

### Task 3.1: Remote sync route — push

**Files:**
- Create: `src/app/api/sync/push/route.ts`
- Create: `src/lib/sync/types.ts`

- [ ] **Step 1: Write types**
  In `src/lib/sync/types.ts`:
  ```ts
  export type SyncTable =
    | "TimeEntry" | "Project" | "Client" | "Tag"
    | "TagOnTimeEntry" | "Invoice" | "InvoiceLine" | "UserSettings";

  export interface PushOp {
    table: SyncTable;
    rowId: string;
    op: "upsert" | "delete";
    row: Record<string, unknown>; // full row snapshot at write time
  }

  export interface PushRequest {
    clientId: string;
    ops: PushOp[];
  }

  export interface PushResponseItem {
    rowId: string;
    accepted: boolean;
    reason?: "older" | "not-found" | "error";
    serverUpdatedAt?: string;
  }

  export interface PushResponse {
    serverTime: string;
    results: PushResponseItem[];
  }

  export interface PullRow {
    table: SyncTable;
    row: Record<string, unknown>;
  }

  export interface PullResponse {
    rows: PullRow[];
    nextCursor: string;
    hasMore: boolean;
  }
  ```

- [ ] **Step 2: Write the route**
  In `src/app/api/sync/push/route.ts`:
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { prisma } from "@/lib/prisma";
  import { auth } from "@/lib/auth/server";
  import type { PushRequest, PushResponse, PushResponseItem, SyncTable } from "@/lib/sync/types";
  import { applyLWW } from "@/lib/sync/lww";

  export const dynamic = "force-dynamic";

  export async function POST(req: NextRequest) {
    const session = await auth.getSession({ headers: req.headers });
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const body = (await req.json()) as PushRequest;
    const results: PushResponseItem[] = [];

    for (const op of body.ops) {
      try {
        const r = await applyLWW(prisma, userId, op);
        results.push(r);
      } catch (e) {
        results.push({ rowId: op.rowId, accepted: false, reason: "error" });
      }
    }

    const res: PushResponse = {
      serverTime: new Date().toISOString(),
      results,
    };
    return NextResponse.json(res);
  }
  ```

- [ ] **Step 3: Commit**
  ```
  git add src/app/api/sync src/lib/sync/types.ts
  git commit -m "feat(sync): add /api/sync/push route scaffold"
  ```

### Task 3.2: LWW resolver (unit-tested)

**Files:**
- Create: `src/lib/sync/lww.ts`
- Create: `tests/unit/sync/lww.test.ts`

- [ ] **Step 1: Write the failing test first**
  ```ts
  import { describe, it, expect, vi } from "vitest";
  import { applyLWW } from "@/lib/sync/lww";

  function fakePrisma(current: any) {
    return {
      timeEntry: {
        findFirst: vi.fn(async () => current),
        upsert: vi.fn(async ({ create }: any) => create),
      },
    } as any;
  }

  describe("applyLWW", () => {
    it("accepts when incoming updatedAt is newer", async () => {
      const prisma = fakePrisma({ id: "r1", userId: "u1", updatedAt: new Date("2026-04-17T10:00:00Z"), clientId: "a" });
      const res = await applyLWW(prisma, "u1", {
        table: "TimeEntry",
        rowId: "r1",
        op: "upsert",
        row: { id: "r1", userId: "u1", updatedAt: "2026-04-18T10:00:00.000Z", clientId: "b" },
      });
      expect(res.accepted).toBe(true);
    });

    it("rejects when incoming updatedAt is older", async () => {
      const prisma = fakePrisma({ id: "r1", userId: "u1", updatedAt: new Date("2026-04-18T10:00:00Z"), clientId: "a" });
      const res = await applyLWW(prisma, "u1", {
        table: "TimeEntry",
        rowId: "r1",
        op: "upsert",
        row: { id: "r1", userId: "u1", updatedAt: "2026-04-17T10:00:00.000Z", clientId: "b" },
      });
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe("older");
    });

    it("tiebreaks on clientId lexicographically (higher wins)", async () => {
      const prisma = fakePrisma({ id: "r1", userId: "u1", updatedAt: new Date("2026-04-18T10:00:00Z"), clientId: "a" });
      const res = await applyLWW(prisma, "u1", {
        table: "TimeEntry",
        rowId: "r1",
        op: "upsert",
        row: { id: "r1", userId: "u1", updatedAt: "2026-04-18T10:00:00.000Z", clientId: "b" },
      });
      expect(res.accepted).toBe(true);
    });

    it("inserts when no current row exists", async () => {
      const prisma = fakePrisma(null);
      const res = await applyLWW(prisma, "u1", {
        table: "TimeEntry",
        rowId: "r1",
        op: "upsert",
        row: { id: "r1", userId: "u1", updatedAt: "2026-04-18T10:00:00.000Z", clientId: "b" },
      });
      expect(res.accepted).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run it — should fail**
  ```
  npm run test:run tests/unit/sync/lww.test.ts
  ```
  Expected: FAIL ("Cannot find module '@/lib/sync/lww'").

- [ ] **Step 3: Write the implementation**
  ```ts
  import type { PushOp, PushResponseItem, SyncTable } from "./types";

  const TABLE_TO_MODEL: Record<SyncTable, string> = {
    TimeEntry: "timeEntry",
    Project: "project",
    Client: "client",
    Tag: "tag",
    TagOnTimeEntry: "tagOnTimeEntry",
    Invoice: "invoice",
    InvoiceLine: "invoiceLine",
    UserSettings: "userSettings",
  };

  export async function applyLWW(
    prisma: any,
    userId: string,
    op: PushOp
  ): Promise<PushResponseItem> {
    const model = TABLE_TO_MODEL[op.table];
    if (!model) return { rowId: op.rowId, accepted: false, reason: "error" };

    const incoming = op.row;
    const incomingAt = new Date(String(incoming.updatedAt));
    const incomingClient = String(incoming.clientId ?? "");

    // Ensure user ownership is preserved.
    if (incoming.userId && incoming.userId !== userId) {
      return { rowId: op.rowId, accepted: false, reason: "error" };
    }

    const current = await prisma[model].findFirst({
      where: { id: op.rowId, userId },
    });

    if (current) {
      const currentAt = new Date(current.updatedAt).getTime();
      if (incomingAt.getTime() < currentAt) {
        return { rowId: op.rowId, accepted: false, reason: "older" };
      }
      if (incomingAt.getTime() === currentAt && incomingClient <= (current.clientId ?? "")) {
        return { rowId: op.rowId, accepted: false, reason: "older" };
      }
    }

    if (op.op === "delete") {
      await prisma[model].update({
        where: { id: op.rowId },
        data: { deletedAt: new Date(), updatedAt: incomingAt, clientId: incomingClient },
      });
      return { rowId: op.rowId, accepted: true, serverUpdatedAt: incomingAt.toISOString() };
    }

    await prisma[model].upsert({
      where: { id: op.rowId },
      create: { ...incoming, userId },
      update: { ...incoming, userId },
    });
    return { rowId: op.rowId, accepted: true, serverUpdatedAt: incomingAt.toISOString() };
  }
  ```

- [ ] **Step 4: Run the test — pass**
  ```
  npm run test:run tests/unit/sync/lww.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```
  git add src/lib/sync/lww.ts tests/unit/sync/lww.test.ts
  git commit -m "feat(sync): LWW resolver with unit tests"
  ```

### Task 3.3: Remote sync route — pull

**Files:**
- Create: `src/app/api/sync/pull/route.ts`

- [ ] **Step 1: Write the route**
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { prisma } from "@/lib/prisma";
  import { auth } from "@/lib/auth/server";
  import type { PullResponse, PullRow, SyncTable } from "@/lib/sync/types";

  export const dynamic = "force-dynamic";

  const TABLES: { table: SyncTable; model: string }[] = [
    { table: "Project", model: "project" },
    { table: "Client", model: "client" },
    { table: "Tag", model: "tag" },
    { table: "TimeEntry", model: "timeEntry" },
    { table: "TagOnTimeEntry", model: "tagOnTimeEntry" },
    { table: "Invoice", model: "invoice" },
    { table: "InvoiceLine", model: "invoiceLine" },
    { table: "UserSettings", model: "userSettings" },
  ];

  export async function GET(req: NextRequest) {
    const session = await auth.getSession({ headers: req.headers });
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const url = new URL(req.url);
    const since = url.searchParams.get("since");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 2000);

    const sinceDate = since ? new Date(since) : new Date(0);

    const rows: PullRow[] = [];
    for (const { table, model } of TABLES) {
      const batch = await (prisma as any)[model].findMany({
        where: {
          userId,
          updatedAt: { gt: sinceDate },
        },
        orderBy: { updatedAt: "asc" },
        take: limit,
      });
      for (const row of batch) {
        rows.push({ table, row });
      }
    }

    // Sort all rows by updatedAt and slice to `limit` so cursor advances monotonically.
    rows.sort((a, b) =>
      new Date((a.row as any).updatedAt).getTime() -
      new Date((b.row as any).updatedAt).getTime()
    );
    const page = rows.slice(0, limit);
    const nextCursor = page.length > 0
      ? new Date((page[page.length - 1].row as any).updatedAt).toISOString()
      : sinceDate.toISOString();

    const res: PullResponse = {
      rows: page,
      nextCursor,
      hasMore: rows.length > limit,
    };
    return NextResponse.json(res);
  }
  ```

- [ ] **Step 2: Commit**
  ```
  git add src/app/api/sync/pull/route.ts
  git commit -m "feat(sync): add /api/sync/pull route with cursor pagination"
  ```

### Task 3.4: Enqueue pending ops on local writes

**Files:**
- Modify: `src/lib/prisma.ts`

- [ ] **Step 1: Add a Prisma middleware that writes to PendingOp on any local mutation**
  When `IS_DESKTOP=1`, wrap the client with `$extends`:
  ```ts
  function createClient() {
    if (process.env.IS_DESKTOP === "1") {
      const { PrismaClient } = require(".prisma/client-local");
      const base = new PrismaClient();
      return base.$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              const syncedModels = new Set([
                "Project","Client","Tag","TimeEntry","TagOnTimeEntry",
                "Invoice","InvoiceLine","UserSettings",
              ]);
              const isWrite = ["create","update","upsert","delete","updateMany","deleteMany","createMany"].includes(operation);
              const result = await query(args);
              if (isWrite && syncedModels.has(model ?? "") && result) {
                const rows = Array.isArray(result) ? result : [result];
                for (const row of rows) {
                  if (!row?.id) continue;
                  await base.pendingOp.create({
                    data: {
                      tableName: model!,
                      rowId: row.id,
                      op: operation === "delete" || operation === "deleteMany" ? "delete" : "upsert",
                      payload: JSON.stringify(row),
                    },
                  });
                }
              }
              return result;
            },
          },
        },
      });
    }
    const { PrismaClient } = require("@prisma/client");
    return new PrismaClient();
  }
  ```

- [ ] **Step 2: Manual test**
  Run desktop, create a project, then:
  ```
  sqlite3 ~/Library/Application\ Support/BogglTrack/boggltrack.db \
    "SELECT tableName, rowId, op FROM PendingOp;"
  ```
  Expected: row appears with `tableName=Project`, `op=upsert`.

- [ ] **Step 3: Commit**
  ```
  git add src/lib/prisma.ts
  git commit -m "feat(sync): enqueue PendingOp on every desktop write"
  ```

### Task 3.5: Sync worker process

**Files:**
- Create: `electron/sync-worker.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the worker**
  ```ts
  // Runs in a forked Node process. No Electron APIs here.
  import { PrismaClient } from ".prisma/client-local";

  const REMOTE_BASE = process.env.REMOTE_BASE_URL!;
  const CLIENT_ID = process.env.CLIENT_ID!;
  const SESSION_COOKIE = process.env.SESSION_COOKIE!;

  const prisma = new PrismaClient();

  async function push() {
    const ops = await prisma.pendingOp.findMany({ orderBy: { id: "asc" }, take: 100 });
    if (ops.length === 0) return;

    const body = {
      clientId: CLIENT_ID,
      ops: ops.map((o) => ({
        table: o.tableName,
        rowId: o.rowId,
        op: o.op,
        row: JSON.parse(o.payload),
      })),
    };

    const res = await fetch(`${REMOTE_BASE}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: SESSION_COOKIE },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await prisma.pendingOp.updateMany({
        where: { id: { in: ops.map((o) => o.id) } },
        data: { attempts: { increment: 1 }, lastError: `HTTP ${res.status}` },
      });
      return;
    }
    const json = await res.json() as { results: { rowId: string; accepted: boolean }[] };
    const acceptedIds = ops
      .filter((o) => json.results.find((r) => r.rowId === o.rowId)?.accepted)
      .map((o) => o.id);
    await prisma.pendingOp.deleteMany({ where: { id: { in: acceptedIds } } });
  }

  async function pull() {
    const cursor = await prisma.syncCursor.findFirst({ orderBy: { id: "desc" } });
    const since = cursor?.cursor ?? new Date(0).toISOString();
    const res = await fetch(`${REMOTE_BASE}/api/sync/pull?since=${encodeURIComponent(since)}`, {
      headers: { Cookie: SESSION_COOKIE },
    });
    if (!res.ok) return;
    const json = await res.json() as { rows: { table: string; row: any }[]; nextCursor: string };

    for (const { table, row } of json.rows) {
      const model = table.charAt(0).toLowerCase() + table.slice(1);
      const existing = await (prisma as any)[model].findUnique({ where: { id: row.id } });
      if (!existing || new Date(existing.updatedAt) < new Date(row.updatedAt)) {
        await (prisma as any)[model].upsert({
          where: { id: row.id },
          create: row,
          update: row,
        });
      }
    }
    await prisma.syncCursor.create({ data: { cursor: json.nextCursor } });
  }

  async function tick() {
    try {
      await push();
      await pull();
      process.send?.({ type: "sync-ok", at: Date.now() });
    } catch (e) {
      process.send?.({ type: "sync-err", message: String(e) });
    }
  }

  setInterval(tick, 15_000);
  tick();

  process.on("message", (msg: any) => {
    if (msg?.type === "nudge") tick();
  });
  ```

- [ ] **Step 2: Fork from main.ts after sign-in cookie is available**
  In `main.ts`:
  ```ts
  import { fork } from "node:child_process";

  let syncProc: ChildProcess | null = null;

  async function startSyncWorker(win: BrowserWindow) {
    const cookies = await win.webContents.session.cookies.get({ url: "https://boggl-track.vercel.app" });
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    syncProc = fork(path.join(__dirname, "sync-worker.js"), [], {
      env: {
        ...process.env,
        REMOTE_BASE_URL: "https://boggl-track.vercel.app",
        CLIENT_ID: process.env.CLIENT_ID!,
        SESSION_COOKIE: cookieHeader,
        LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL!,
      },
    });
    syncProc.on("message", (msg: any) => {
      win.webContents.send("sync-status", msg);
    });
  }
  ```
  Call `startSyncWorker(win)` on `did-finish-load` when the renderer reports a signed-in state (add an IPC channel `app:signed-in` from the renderer).

- [ ] **Step 3: Commit**
  ```
  git add electron/sync-worker.ts electron/main.ts
  git commit -m "feat(sync): background sync worker process (push + pull every 15s)"
  ```

### Task 3.6: Sync status indicator in UI

**Files:**
- Create: `src/components/layout/sync-status.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Write the component**
  ```tsx
  "use client";
  import { useEffect, useState } from "react";
  import { isDesktop } from "@/lib/desktop/is-desktop";
  import { Cloud, CloudOff, Loader2 } from "lucide-react";

  type Status = "idle" | "syncing" | "ok" | "error";

  export function SyncStatus() {
    const [status, setStatus] = useState<Status>("idle");
    const [lastAt, setLastAt] = useState<number | null>(null);

    useEffect(() => {
      if (!isDesktop()) return;
      const b = (window as any).boggl;
      b?.onSync?.((msg: any) => {
        if (msg.type === "sync-ok") { setStatus("ok"); setLastAt(msg.at); }
        else if (msg.type === "sync-err") setStatus("error");
        else if (msg.type === "sync-start") setStatus("syncing");
      });
    }, []);

    if (!isDesktop()) return null;

    const label =
      status === "syncing" ? "Syncing…" :
      status === "error" ? "Offline" :
      lastAt ? `Synced ${Math.round((Date.now() - lastAt) / 1000)}s ago` : "Local only";
    const Icon = status === "error" ? CloudOff : status === "syncing" ? Loader2 : Cloud;

    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-olive)] px-2 py-1">
        <Icon className={status === "syncing" ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
        <span>{label}</span>
      </div>
    );
  }
  ```

- [ ] **Step 2: Mount in sidebar above the account chip**
  In `app-sidebar.tsx` add `<SyncStatus />` just above the account-menu button.

- [ ] **Step 3: Extend preload to forward sync messages**
  In `electron/preload.ts`, add:
  ```ts
  onSync: (handler: (msg: any) => void) => {
    ipcRenderer.on("sync-status", (_e, msg) => handler(msg));
  },
  ```

- [ ] **Step 4: Commit**
  ```
  git add src/components/layout/sync-status.tsx src/components/layout/app-sidebar.tsx electron/preload.ts
  git commit -m "feat(desktop): sync status indicator in sidebar"
  ```

### Task 3.7: End-to-end sync test

- [ ] **Step 1: Manual test — happy path**
  - Launch desktop.
  - Sign in.
  - Create a project "E2E Sync Test".
  - Wait ~20s.
  - Open `https://boggl-track.vercel.app` in a browser, sign in with same account.
  - Expected: project visible on web.

- [ ] **Step 2: Manual test — offline**
  - Turn off Wi-Fi.
  - Create 3 time entries.
  - Verify `sqlite3 ... "SELECT COUNT(*) FROM PendingOp;"` shows 3 pending ops.
  - Turn Wi-Fi back on.
  - Wait 20s.
  - Expected: PendingOp table empties; entries appear on web.

- [ ] **Step 3: Manual test — conflict**
  - Edit same project description on web at T=0.
  - Edit same project description on desktop at T+10s.
  - Desktop syncs.
  - Expected: web reflects desktop's text (newer updatedAt wins).

- [ ] **Step 4: Tag**
  ```
  git tag phase-3-sync-working
  git push origin main phase-3-sync-working
  ```

---

## Phase 4 — Native polish (menu bar, shortcuts, tray, notifications)

Goal: pass the "blindfold test." This is the phase where Electron → feels native.

### Task 4.1: Native application menu bar

**Files:**
- Create: `electron/menu.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the menu**
  ```ts
  import { app, Menu, MenuItemConstructorOptions, BrowserWindow, shell } from "electron";

  function send(win: BrowserWindow | undefined, action: string) {
    win?.webContents.send("menu-action", action);
  }

  export function buildAppMenu(getWindow: () => BrowserWindow | undefined) {
    const isMac = process.platform === "darwin";
    const w = () => getWindow();

    const template: MenuItemConstructorOptions[] = [
      ...(isMac
        ? [{
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { label: "Settings…", accelerator: "Cmd+,", click: () => send(w(), "open-settings") },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          }]
        : []),
      {
        label: "File",
        submenu: [
          { label: "New Time Entry", accelerator: "CmdOrCtrl+N", click: () => send(w(), "new-entry") },
          { type: "separator" },
          { label: "Export CSV…", click: () => send(w(), "export-csv") },
          { type: "separator" },
          isMac ? { role: "close" } : { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
          { type: "separator" },
          { label: "Find", accelerator: "CmdOrCtrl+F", click: () => send(w(), "find") },
        ],
      },
      {
        label: "View",
        submenu: [
          { label: "Dashboard", accelerator: "CmdOrCtrl+1", click: () => send(w(), "nav:/") },
          { label: "Timer",     accelerator: "CmdOrCtrl+2", click: () => send(w(), "nav:/timer") },
          { label: "Calendar",  accelerator: "CmdOrCtrl+3", click: () => send(w(), "nav:/calendar") },
          { label: "Tracking",  accelerator: "CmdOrCtrl+4", click: () => send(w(), "nav:/tracking") },
          { type: "separator" },
          { role: "reload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
          { label: "Toggle Dark Mode", accelerator: "CmdOrCtrl+Shift+D", click: () => send(w(), "toggle-theme") },
        ],
      },
      {
        label: "Timer",
        submenu: [
          { label: "Start/Stop Timer", accelerator: "CmdOrCtrl+T", click: () => send(w(), "toggle-timer") },
          { label: "Resume Last",      accelerator: "CmdOrCtrl+Shift+R", click: () => send(w(), "resume-last") },
        ],
      },
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          { type: "separator" },
          { role: "front" },
        ],
      },
      {
        label: "Help",
        submenu: [
          { label: "BogglTrack Website", click: () => shell.openExternal("https://boggl-track.vercel.app") },
          { label: "Report an Issue…",    click: () => shell.openExternal("https://github.com/burhankhatri/BogglTrack/issues/new") },
        ],
      },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
  ```

- [ ] **Step 2: Wire in `main.ts`**
  ```ts
  import { buildAppMenu } from "./menu";

  let mainWindow: BrowserWindow | undefined;

  app.whenReady().then(async () => {
    // ...existing
    mainWindow = await createWindow();
    buildAppMenu(() => mainWindow);
  });
  ```

- [ ] **Step 3: Renderer handles menu IPC**
  Create `src/lib/desktop/menu-router.tsx`:
  ```tsx
  "use client";
  import { useEffect } from "react";
  import { useRouter } from "next/navigation";
  import { isDesktop } from "./is-desktop";

  export function MenuRouter() {
    const router = useRouter();
    useEffect(() => {
      if (!isDesktop()) return;
      (window as any).boggl?.onMenu?.((action: string) => {
        if (action.startsWith("nav:")) router.push(action.slice(4));
        else if (action === "open-settings") router.push("/settings");
        else if (action === "toggle-timer") window.dispatchEvent(new Event("menu:toggle-timer"));
        else if (action === "toggle-theme") window.dispatchEvent(new Event("menu:toggle-theme"));
      });
    }, [router]);
    return null;
  }
  ```
  Mount `<MenuRouter />` in `src/app/(app)/layout.tsx`.

- [ ] **Step 4: Commit**
  ```
  git add electron/menu.ts electron/main.ts src/lib/desktop/menu-router.tsx src/app/(app)/layout.tsx
  git commit -m "feat(desktop): native macOS application menu with Cmd-shortcuts"
  ```

### Task 4.2: Native right-click context menu

**Files:**
- Modify: `package.json` (dep)
- Modify: `electron/main.ts`

- [ ] **Step 1: Install**
  ```
  npm i electron-context-menu
  ```

- [ ] **Step 2: Wire it**
  In `main.ts`, top-level:
  ```ts
  import contextMenu from "electron-context-menu";

  contextMenu({
    showLookUpSelection: true,
    showSearchWithGoogle: false,
    showCopyImage: false,
    showInspectElement: process.env.ELECTRON_IS_DEV === "1",
    showSaveImageAs: false,
  });
  ```

- [ ] **Step 3: Verify**
  Launch desktop, right-click in any text input.
  Expected: native-styled menu with Cut/Copy/Paste/Look Up.

- [ ] **Step 4: Commit**
  ```
  git add package.json package-lock.json electron/main.ts
  git commit -m "feat(desktop): native macOS context menu in text fields"
  ```

### Task 4.3: Tray (menu bar extra) with quick timer controls

**Files:**
- Create: `electron/tray.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the tray module**
  ```ts
  import { app, Tray, Menu, BrowserWindow, nativeImage } from "electron";
  import * as path from "node:path";

  let tray: Tray | null = null;

  export function createTray(getWindow: () => BrowserWindow | undefined) {
    const iconPath = path.join(__dirname, "assets", "tray-iconTemplate.png");
    const image = nativeImage.createFromPath(iconPath);
    image.setTemplateImage(true);
    tray = new Tray(image);
    tray.setToolTip("BogglTrack");
    rebuild("idle");
    tray.on("click", () => {
      const w = getWindow();
      if (!w) return;
      w.isVisible() ? w.hide() : (w.show(), w.focus());
    });

    function rebuild(state: "idle" | "running", label?: string) {
      const menu = Menu.buildFromTemplate([
        { label: label ?? (state === "running" ? "Timer running" : "No timer"), enabled: false },
        { type: "separator" },
        { label: state === "running" ? "Stop Timer" : "Start Timer",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => getWindow()?.webContents.send("menu-action", "toggle-timer") },
        { label: "Open BogglTrack", click: () => { getWindow()?.show(); getWindow()?.focus(); } },
        { type: "separator" },
        { label: "Quit", role: "quit" },
      ]);
      tray?.setContextMenu(menu);
    }

    return {
      setState(state: "idle" | "running", label?: string) {
        rebuild(state, label);
        tray?.setTitle(state === "running" && label ? label : "");
      },
    };
  }
  ```

- [ ] **Step 2: Generate a template icon**
  `electron/assets/tray-iconTemplate.png` — 16×16 + 32×32 @2x PNG of just the stopwatch silhouette in black. (For now a placeholder; final icon pipeline comes in Phase 5.)

- [ ] **Step 3: Wire in main.ts**
  ```ts
  import { createTray } from "./tray";

  let trayApi: ReturnType<typeof createTray> | null = null;
  app.whenReady().then(async () => {
    // ...existing
    trayApi = createTray(() => mainWindow);
  });

  // Bridge timer state from the renderer:
  ipcMain.on("timer-state", (_e, payload: { running: boolean; label?: string }) => {
    trayApi?.setState(payload.running ? "running" : "idle", payload.label);
    if (mainWindow && payload.running && payload.label) {
      mainWindow.setTitle(`${payload.label} — BogglTrack`);
      app.dock?.setBadge(payload.label);
    } else {
      mainWindow?.setTitle("BogglTrack");
      app.dock?.setBadge("");
    }
  });
  ```

- [ ] **Step 4: Send state from renderer**
  In `global-timer-bar.tsx`, after the existing `document.title` effect, add:
  ```ts
  useEffect(() => {
    if (!isDesktop()) return;
    const label = isRunning ? formatElapsed(elapsedSeconds).slice(0, 5) : undefined; // MM:SS
    (window as any).boggl?.send?.("timer-state", { running: isRunning, label });
  }, [isRunning, elapsedSeconds]);
  ```
  Extend preload with:
  ```ts
  send: (channel: string, payload: unknown) => ipcRenderer.send(channel, payload),
  ```

- [ ] **Step 5: Commit**
  ```
  git add electron/tray.ts electron/assets electron/main.ts electron/preload.ts src/components/layout/global-timer-bar.tsx
  git commit -m "feat(desktop): menu bar tray with timer state + Dock badge"
  ```

### Task 4.4: Global shortcut — Cmd+Shift+T toggles timer

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Register the shortcut on ready, unregister on quit**
  ```ts
  import { globalShortcut } from "electron";

  app.whenReady().then(() => {
    // ...existing
    globalShortcut.register("CommandOrControl+Shift+T", () => {
      mainWindow?.webContents.send("menu-action", "toggle-timer");
    });
  });

  app.on("will-quit", () => globalShortcut.unregisterAll());
  ```

- [ ] **Step 2: Verify**
  Launch desktop, switch to Xcode / Safari / any other app, press Cmd+Shift+T.
  Expected: BogglTrack's timer toggles. The app doesn't steal focus.

- [ ] **Step 3: Commit**
  ```
  git add electron/main.ts
  git commit -m "feat(desktop): Cmd+Shift+T global shortcut to toggle timer"
  ```

### Task 4.5: Notifications — long timer reminders

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Listen to timer state, fire notifications at 4h and 8h marks**
  ```ts
  import { Notification } from "electron";

  let fourHourFired = false;
  let eightHourFired = false;

  ipcMain.on("timer-state", (_e, payload: { running: boolean; elapsedSeconds: number }) => {
    if (!payload.running) { fourHourFired = false; eightHourFired = false; return; }
    if (payload.elapsedSeconds >= 14400 && !fourHourFired) {
      fourHourFired = true;
      new Notification({ title: "4 hours tracked", body: "Nice work. Maybe time for a break?" }).show();
    }
    if (payload.elapsedSeconds >= 28800 && !eightHourFired) {
      eightHourFired = true;
      new Notification({ title: "Timer still running", body: "Did you forget to stop it?" }).show();
    }
  });
  ```
  Update `timer-state` sender in the renderer to include `elapsedSeconds`.

- [ ] **Step 2: Commit**
  ```
  git add electron/main.ts src/components/layout/global-timer-bar.tsx
  git commit -m "feat(desktop): 4h/8h timer notifications via native macOS Notification"
  ```

### Task 4.6: About dialog + external link handling

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Set About panel options**
  ```ts
  app.setAboutPanelOptions({
    applicationName: "BogglTrack",
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} BogglTrack`,
    credits: "Time tracking & earnings for freelancers.",
    iconPath: path.join(__dirname, "assets", "icon.png"),
  });
  ```

- [ ] **Step 2: Already handled** — `setWindowOpenHandler` in Task 1.3 forwards external links to default browser. Verify by clicking a GitHub link inside the app.

- [ ] **Step 3: Commit**
  ```
  git add electron/main.ts
  git commit -m "feat(desktop): About panel + external links open in default browser"
  ```

### Task 4.7: Cmd+W hide, Cmd+Q quit behavior

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Intercept window close**
  ```ts
  let isQuitting = false;
  app.on("before-quit", () => { isQuitting = true; });

  // inside createWindow:
  win.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  ```
  Also update the `window-all-closed` handler to do nothing on macOS.

- [ ] **Step 2: Verify**
  Cmd+W hides the window. Dock icon click re-shows. Cmd+Q fully quits.

- [ ] **Step 3: Commit + tag**
  ```
  git add electron/main.ts
  git commit -m "feat(desktop): Cmd+W hides window, Cmd+Q quits (macOS convention)"
  git tag phase-4-native-polish
  git push origin main phase-4-native-polish
  ```

---

## Phase 5 — Icon pipeline + DMG packaging

Goal: single source logo → all icon sizes → `.icns` + favicon + DMG background. `npm run dmg` produces a signed-ready `.dmg`.

### Task 5.1: Store source logo as SVG

**Files:**
- Create: `electron/assets/source/logo.svg`
- Create: `electron/assets/source/logo-tile.svg`

- [ ] **Step 1: Export the logo to SVG**
  Trace the supplied PNG using an online tool (e.g. vectorizer.ai) or manually redraw the stopwatch + arrow + "B" in a vector editor. Save the monochrome black version as `logo.svg` (1024×1024 viewBox).

- [ ] **Step 2: Create the tile version**
  `logo-tile.svg` — wraps `logo.svg` inside a `<rect width="1024" height="1024" fill="#FAFAFA" rx="180"/>` then places the logo centered at ~60% size. This is what gets rasterized into icon PNGs.

- [ ] **Step 3: Commit**
  ```
  git add electron/assets/source
  git commit -m "chore(desktop): source SVG assets for icon pipeline"
  ```

### Task 5.2: Icon generator script

**Files:**
- Create: `scripts/build-icons.ts`
- Modify: `package.json`

- [ ] **Step 1: Install deps**
  ```
  npm i -D sharp png2icons
  ```

- [ ] **Step 2: Write the script**
  ```ts
  import sharp from "sharp";
  import png2icons from "png2icons";
  import * as fs from "node:fs";
  import * as path from "node:path";

  const SRC = path.join("electron", "assets", "source", "logo-tile.svg");
  const OUT_APP = path.join("electron", "assets");
  const OUT_WEB = path.join("public");

  const SIZES = [16, 32, 64, 128, 256, 512, 1024];

  async function rasterize(size: number, out: string) {
    await sharp(SRC).resize(size, size).png().toFile(out);
  }

  async function main() {
    fs.mkdirSync(OUT_APP, { recursive: true });
    fs.mkdirSync(OUT_WEB, { recursive: true });

    // App icon PNGs
    for (const s of SIZES) {
      await rasterize(s, path.join(OUT_APP, `icon-${s}.png`));
    }
    await rasterize(1024, path.join(OUT_APP, "icon.png"));

    // Mac .icns
    const base = fs.readFileSync(path.join(OUT_APP, "icon-1024.png"));
    const icns = png2icons.createICNS(base, png2icons.BICUBIC, 0);
    if (!icns) throw new Error("ICNS generation failed");
    fs.writeFileSync(path.join(OUT_APP, "icon.icns"), icns);

    // Favicon + web app icons
    await rasterize(32, path.join(OUT_WEB, "favicon.png"));
    await rasterize(180, path.join(OUT_WEB, "apple-touch-icon.png"));
    await rasterize(512, path.join(OUT_WEB, "icon-512.png"));

    // Tray template icon (silhouette-only, from monochrome logo, NOT tiled)
    await sharp(path.join("electron", "assets", "source", "logo.svg"))
      .resize(22, 22).png().toFile(path.join(OUT_APP, "tray-iconTemplate.png"));
    await sharp(path.join("electron", "assets", "source", "logo.svg"))
      .resize(44, 44).png().toFile(path.join(OUT_APP, "tray-iconTemplate@2x.png"));

    console.log("✓ Icons generated");
  }

  main().catch((e) => { console.error(e); process.exit(1); });
  ```

- [ ] **Step 3: Add npm script**
  ```json
  "icons": "tsx scripts/build-icons.ts"
  ```
  And wire it into `build:desktop` so it always runs before packaging:
  ```json
  "build:desktop": "npm run icons && npm run build && tsc -p electron/tsconfig.json",
  ```

- [ ] **Step 4: Run it**
  ```
  npm run icons
  ```
  Expected: `electron/assets/icon.icns`, `icon-{16..1024}.png`, `public/favicon.png` all exist.

- [ ] **Step 5: Commit**
  ```
  git add scripts/build-icons.ts package.json package-lock.json electron/assets/*.png electron/assets/icon.icns public/favicon.png public/apple-touch-icon.png public/icon-512.png
  git commit -m "feat(desktop): icon generation pipeline (logo.svg → .icns + favicon)"
  ```

### Task 5.3: Wire favicon into the Next.js app

**Files:**
- Modify: `src/app/layout.tsx` or `src/app/icon.png` (whichever Next.js uses)

- [ ] **Step 1: Replace the existing `src/app/icon.png`**
  The app already has `src/app/icon.png`. Overwrite it with the generated `public/icon-512.png`:
  ```
  cp public/icon-512.png src/app/icon.png
  cp public/apple-touch-icon.png src/app/apple-icon.png
  ```
  Next.js picks these up automatically for `<link rel="icon">`.

- [ ] **Step 2: Verify**
  Run: `npm run dev`. Open http://localhost:3000, check the browser tab icon.
  Expected: new logo appears.

- [ ] **Step 3: Commit**
  ```
  git add src/app/icon.png src/app/apple-icon.png
  git commit -m "feat(web): swap favicon to new stopwatch logo (tile composition)"
  ```

### Task 5.4: DMG background image

**Files:**
- Create: `electron/assets/dmg-background.png` (660×400)

- [ ] **Step 1: Compose the DMG window background**
  Use a 660×400 PNG with:
  - Left: the 128px logo with "Drag to install" label beneath.
  - Right: arrow pointing to the Applications folder symlink.
  - Off-white background (`#FAFAFA`) matching the app.
  Generate via script (add to `build-icons.ts`) or compose once in Figma and check in.

- [ ] **Step 2: Commit**
  ```
  git add electron/assets/dmg-background.png
  git commit -m "chore(desktop): DMG install-window background image"
  ```

### Task 5.5: electron-builder configuration

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`

- [ ] **Step 1: Write the builder config**
  ```yaml
  appId: app.boggltrack.desktop
  productName: BogglTrack
  copyright: © 2026 BogglTrack

  directories:
    output: dist
    buildResources: electron/assets

  files:
    - "electron/dist/**/*"
    - ".next/standalone/**/*"
    - ".next/static/**/*"
    - "public/**/*"
    - "prisma/schema.local.prisma"
    - "prisma/migrations-local/**/*"
    - "node_modules/.prisma/client-local/**/*"
    - "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}"
    - "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}"

  extraResources:
    - from: ".next/standalone"
      to: "app"
      filter: ["**/*"]

  asar: true
  asarUnpack:
    - "node_modules/.prisma/**/*"
    - "node_modules/@prisma/engines/**/*"

  mac:
    category: public.app-category.productivity
    icon: electron/assets/icon.icns
    target:
      - target: dmg
        arch: [arm64, x64]
    hardenedRuntime: true
    gatekeeperAssess: false
    entitlements: electron/assets/entitlements.mac.plist
    entitlementsInherit: electron/assets/entitlements.mac.plist

  dmg:
    background: electron/assets/dmg-background.png
    window:
      width: 660
      height: 400
    contents:
      - x: 180
        y: 200
        type: file
      - x: 480
        y: 200
        type: link
        path: /Applications
  ```

- [ ] **Step 2: Write the entitlements file**
  `electron/assets/entitlements.mac.plist`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.disable-library-validation</key><true/>
    <key>com.apple.security.network.client</key><true/>
    <key>com.apple.security.files.user-selected.read-write</key><true/>
  </dict>
  </plist>
  ```

- [ ] **Step 3: Set version + metadata in package.json**
  At top-level:
  ```json
  "version": "0.1.0",
  "description": "Time tracking & earnings for freelancers.",
  "author": { "name": "Burhan Khatri" },
  "homepage": "https://boggl-track.vercel.app"
  ```

- [ ] **Step 4: Commit**
  ```
  git add electron-builder.yml electron/assets/entitlements.mac.plist package.json
  git commit -m "build(desktop): electron-builder config for DMG with universal arm64+x64"
  ```

### Task 5.6: First DMG build

- [ ] **Step 1: Build**
  ```
  npm run dmg
  ```
  Expected output: `dist/BogglTrack-0.1.0-arm64.dmg` and `dist/BogglTrack-0.1.0-x64.dmg` (and a universal `.dmg` optionally).

- [ ] **Step 2: Manual install test**
  - Double-click the arm64 DMG.
  - Expected: custom background appears with logo + arrow.
  - Drag `BogglTrack` into `Applications`.
  - Eject DMG.
  - Open Applications → BogglTrack (right-click → Open the first time, since unsigned).
  - Expected: app opens, shows sign-in, logo in Dock, traffic lights, everything from phases 1-4 works.

- [ ] **Step 3: Size check**
  ```
  du -sh dist/*.dmg
  ```
  Expected: ≤ 180MB per arch.

- [ ] **Step 4: Tag**
  ```
  git tag phase-5-dmg-works
  git push origin main phase-5-dmg-works
  ```

---

## Phase 6 — Auto-update + release automation

Goal: push a git tag, get a published GitHub Release with the DMG. Running app picks up the new version on next launch.

### Task 6.1: Add electron-updater

**Files:**
- Modify: `package.json`
- Create: `electron/updater.ts`
- Modify: `electron/main.ts`
- Modify: `electron-builder.yml`

- [ ] **Step 1: Install**
  ```
  npm i electron-updater
  ```

- [ ] **Step 2: Write updater module**
  ```ts
  import { autoUpdater } from "electron-updater";
  import { BrowserWindow, dialog } from "electron";

  export function attachUpdater(getWindow: () => BrowserWindow | undefined) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-downloaded", async (info) => {
      const win = getWindow();
      if (!win) return;
      const res = await dialog.showMessageBox(win, {
        type: "info",
        title: "Update ready",
        message: `BogglTrack ${info.version} is ready to install.`,
        detail: "Restart now to apply, or it'll install next time you quit.",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (res.response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.on("error", (err) => {
      console.error("[updater]", err);
    });

    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 60 * 60 * 1000);
  }
  ```

- [ ] **Step 3: Wire in main.ts**
  ```ts
  import { attachUpdater } from "./updater";
  app.whenReady().then(() => {
    // ...existing
    if (!IS_DEV) attachUpdater(() => mainWindow);
  });
  ```

- [ ] **Step 4: Configure publish target in electron-builder.yml**
  Add:
  ```yaml
  publish:
    provider: github
    owner: burhankhatri
    repo: BogglTrack
    releaseType: release
  ```

- [ ] **Step 5: Commit**
  ```
  git add package.json package-lock.json electron/updater.ts electron/main.ts electron-builder.yml
  git commit -m "feat(desktop): electron-updater wired to GitHub Releases"
  ```

### Task 6.2: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release-desktop.yml`

- [ ] **Step 1: Write the workflow**
  ```yaml
  name: Release Desktop

  on:
    push:
      tags:
        - "desktop-v*"

  jobs:
    build:
      runs-on: macos-14
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: "20"
            cache: "npm"
        - run: npm ci
        - run: npm run icons
        - run: npm run prisma:generate:all
        - run: npm run build
        - run: npm run build:desktop
        - name: Package + publish DMG
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: npx electron-builder --mac dmg --publish always
  ```

- [ ] **Step 2: Release tag convention**
  Bump version in `package.json`:
  ```
  npm version minor --no-git-tag-version
  ```
  Commit, then tag:
  ```
  git tag desktop-v0.2.0 && git push origin desktop-v0.2.0
  ```
  GitHub Actions builds, signs (once certs added), and publishes.

- [ ] **Step 3: Commit**
  ```
  git add .github/workflows/release-desktop.yml
  git commit -m "ci(desktop): GitHub Actions workflow to build + publish DMG on tag"
  ```

### Task 6.3: First release

- [ ] **Step 1: Push a release tag**
  ```
  git tag desktop-v0.1.0
  git push origin desktop-v0.1.0
  ```

- [ ] **Step 2: Watch the workflow**
  GitHub → Actions tab → confirm build succeeds.

- [ ] **Step 3: Verify the release**
  GitHub → Releases → confirm `BogglTrack-0.1.0-arm64.dmg`, `BogglTrack-0.1.0-x64.dmg`, `latest-mac.yml` all uploaded.

- [ ] **Step 4: Update the homepage README**
  Add a "Download for Mac" button linking to the latest release URL.

- [ ] **Step 5: Tag the phase**
  ```
  git tag phase-6-release-ready
  git push origin main phase-6-release-ready
  ```

---

## Phase 7 — QA checklist before public launch

Not task-by-task implementation — a manual verification sweep.

- [ ] **Install experience**
  - [ ] DMG opens with custom background, logo + arrow visible
  - [ ] Drag-to-Applications works
  - [ ] Eject DMG, open from Applications
  - [ ] (Unsigned v1) Right-click → Open → Open Anyway works
  - [ ] App appears in Launchpad with correct icon

- [ ] **First launch**
  - [ ] Dock icon is the new logo
  - [ ] Window opens centered or at saved position
  - [ ] Traffic lights visible
  - [ ] Sign-in page renders

- [ ] **Auth**
  - [ ] Sign in with existing web credentials works
  - [ ] Session persists across app restart
  - [ ] Sign out clears local DB and returns to sign-in
  - [ ] "Forgot password?" email link opens in default browser

- [ ] **Local DB + sync**
  - [ ] Creating a project writes to SQLite in <20ms
  - [ ] Web app shows the project within 30s
  - [ ] Offline: 5 writes queue, reconnect, all 5 appear on web
  - [ ] Conflict: web edit at T, desktop edit at T+10s → desktop wins
  - [ ] Sync status indicator shows "Synced Xs ago" / "Offline"

- [ ] **Native feel**
  - [ ] Menu bar shows all 7 menus with correct shortcuts
  - [ ] Cmd+1..4 navigates
  - [ ] Cmd+T toggles timer
  - [ ] Cmd+Shift+T works from another app (global shortcut)
  - [ ] Cmd+, opens Settings
  - [ ] Cmd+Shift+D toggles dark mode
  - [ ] Right-click in text field shows native menu with Look Up
  - [ ] Cmd+W hides window, Dock click re-shows
  - [ ] Cmd+Q fully quits
  - [ ] About dialog shows correct version

- [ ] **Tray**
  - [ ] Tray icon visible in system menu bar
  - [ ] Click toggles main window
  - [ ] Tray menu shows timer state
  - [ ] Starting timer from tray works
  - [ ] Tray title shows MM:SS when running (or empty when idle)

- [ ] **Dock**
  - [ ] Badge shows elapsed time when running
  - [ ] Right-click Dock → Start/Stop Timer works

- [ ] **Notifications**
  - [ ] 4h notification fires
  - [ ] 8h notification fires
  - [ ] Notifications respect macOS Do Not Disturb

- [ ] **Theme**
  - [ ] Light → Dark switch applies to title bar vibrancy + traffic-light background
  - [ ] System Default follows OS setting live

- [ ] **Window state**
  - [ ] Resize, move, Cmd+Q → relaunch → window in same place
  - [ ] Fullscreen survives restart

- [ ] **Auto-update**
  - [ ] Bump version, tag, push
  - [ ] Running app detects update
  - [ ] Prompt on quit, installs, relaunches new version

---

## Appendix A — Dependency summary

**Added deps (runtime):** `electron-updater`, `electron-context-menu`
**Added deps (build):** `electron`, `electron-builder`, `concurrently`, `cross-env`, `wait-on`, `tsx`, `sharp`, `png2icons`

**No changes to existing deps.** Prisma 5, Next 16, React 19, Zustand 5 all untouched.

## Appendix B — Rollback plan

Every phase has a tag (`phase-1-shell-working`, `phase-2-local-db-working`, ...). If something breaks mid-phase, `git reset --hard <previous-phase-tag>` restores a known-good state. The web app is unaffected by any of this work until Phase 3 lands the `/api/sync/*` routes — and even those are additive (no existing routes change).

## Appendix C — Security notes

- The embedded Next.js server listens only on `127.0.0.1:<random>` — not reachable from the network.
- Session cookies live in Electron's default session, scoped to `boggl-track.vercel.app`. No token leakage into the local SQLite.
- The sync worker attaches the user's session cookie to every request; if the cookie is expired, the server returns 401 and the worker pauses until the renderer re-authenticates.
- `hardenedRuntime: true` in the builder config enables macOS sandbox-friendly flags; the entitlements plist whitelists only what Prisma + Node need.
- No custom protocol handlers (e.g. `boggltrack://`) — avoids deeplink-spoofing surface area. Reset-password links open in the default browser.





