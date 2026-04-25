# Anonymous-First Time Tracking — Implementation Plan

**Goal:** Users start tracking immediately on landing in `/timer` without signup; data lives in localStorage and syncs to cloud on sign-in.
**Architecture:** New `local-store` module mirrors API surface; `data-adapter` switches between local and remote based on auth state; new `/api/sync/import` endpoint atomically imports local data on signup.
**Tech Stack:** Next.js, Prisma + Postgres (Neon), Zustand, Neon Auth, Vitest, Playwright.

**See spec:** [`docs/specs/anonymous-mode.md`](../specs/anonymous-mode.md). Read it before starting.

**Workflow:** Each task is bite-sized (write test → red → minimal impl → green → commit). Use `/tdd` skill if uncertain. Commit after each green.

**Branch:** Work in `.worktrees/anon-mode` to keep `main` clean.
```bash
git worktree add .worktrees/anon-mode -b feat/anonymous-mode
cd .worktrees/anon-mode
npm install
npm run test:run  # baseline green
```

---

## Phase 1 — Local store foundation

### Task 1: client-id helper

**Files:**
- Create: `src/lib/local-store/id.ts`
- Test: `src/lib/local-store/__tests__/id.test.ts`

Test (RED first):
```ts
import { generateLocalId, getOrCreateClientId, isLocalId } from "../id";

describe("local id helpers", () => {
  beforeEach(() => localStorage.clear());

  it("generates ids prefixed with 'local-'", () => {
    const id = generateLocalId();
    expect(isLocalId(id)).toBe(true);
    expect(id).toMatch(/^local-[0-9a-f-]{36}$/);
  });

  it("returns same client id on repeat calls", () => {
    const a = getOrCreateClientId();
    const b = getOrCreateClientId();
    expect(a).toBe(b);
  });

  it("isLocalId returns false for db ids", () => {
    expect(isLocalId("clxabc123")).toBe(false);
  });
});
```

Implementation:
```ts
const CLIENT_ID_KEY = "boggltrack.client-id";

export const isLocalId = (id: string): boolean => id.startsWith("local-");

export const generateLocalId = (): string => `local-${crypto.randomUUID()}`;

export const getOrCreateClientId = (): string => {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, fresh);
  return fresh;
};
```

Commit: `feat(local-store): add id helpers (clientId, generateLocalId, isLocalId)`

---

### Task 2: LocalStore types

**Files:**
- Create: `src/lib/local-store/types.ts`

No tests — pure types. Mirror Prisma shapes minus DB-only fields:

```ts
export interface LocalSettings {
  defaultHourlyRate?: number | null;
  currency?: string;
  currencySymbol?: string;
  dateFormat?: string;
  timeFormat?: string;
  weekStartDay?: number;
  theme?: string;
  senderName?: string | null;
  senderAddress?: string | null;
  senderEmail?: string | null;
  senderTaxId?: string | null;
}
export interface LocalProject { id: string; name: string; color: string; hourlyRate?: number | null; estimatedHours?: number | null; status: string; clientId?: string | null; createdAt: string; }
export interface LocalClient { id: string; name: string; email?: string | null; notes?: string | null; billingAddress?: string | null; createdAt: string; }
export interface LocalTag { id: string; name: string; color: string; createdAt: string; }
export interface LocalDescriptionRule { id: string; description: string; projectId: string; createdAt: string; }
export interface LocalCommit { sha: string; message: string; repo: string; url?: string; committedAt?: string; }
export interface LocalTimeEntry {
  id: string; description: string; startTime: string; endTime?: string | null;
  duration?: number | null; billable: boolean; projectId?: string | null;
  invoiceId?: string | null; tagIds: string[]; commits?: LocalCommit[]; createdAt: string;
}
export interface LocalInvoiceLineItem { id: string; description: string; quantity: number; rate: number; amount: number; sortOrder: number; timeEntryId?: string | null; }
export interface LocalInvoice {
  id: string; number: string; status: string; issueDate: string; dueDate: string;
  currency: string; currencySymbol: string;
  subtotal: number; taxRate: number; taxAmount: number; discountPercent: number; discountAmount: number; total: number;
  notes?: string | null; paymentTerms?: string | null; workSummary?: string | null;
  senderName?: string | null; senderAddress?: string | null; senderEmail?: string | null; senderTaxId?: string | null;
  recipientName?: string | null; recipientAddress?: string | null; recipientEmail?: string | null;
  clientId?: string | null; lineItems: LocalInvoiceLineItem[]; createdAt: string;
}

export interface LocalStore {
  schemaVersion: 1;
  clientId: string;
  createdAt: string;
  settings: LocalSettings;
  projects: LocalProject[];
  clients: LocalClient[];
  tags: LocalTag[];
  descriptionRules: LocalDescriptionRule[];
  timeEntries: LocalTimeEntry[];
  invoices: LocalInvoice[];
}
```

Commit: `feat(local-store): add LocalStore type definitions`

---

### Task 3: LocalStore IO + migrations

**Files:**
- Create: `src/lib/local-store/store.ts`
- Test: `src/lib/local-store/__tests__/store.test.ts`

API: `loadStore()`, `saveStore(s)`, `clearStore()`, `isStoreEmpty()`.

Tests cover: empty load returns initial blob with new clientId; save then load round-trips; clear removes the key; corrupted JSON returns initial blob (graceful); QuotaExceededError throws a typed error `LocalStoreQuotaError`.

Key impl details:
- Storage key: `"boggltrack.local-store.v1"`
- On load: parse, check `schemaVersion === 1`, otherwise run migrations (none for v1; placeholder for future).
- On save: try/catch QuotaExceeded → throw `LocalStoreQuotaError`.

Commit: `feat(local-store): add load/save/clear with schema versioning`

---

### Task 4: Per-entity local CRUD

**Files:**
- Create: `src/lib/local-store/entries.ts`, `projects.ts`, `clients.ts`, `tags.ts`, `description-rules.ts`, `settings.ts`, `invoices.ts`
- Tests: co-located `__tests__/*.test.ts`

Each module exports `list*()`, `get*ById()`, `create*()`, `update*()`, `delete*()`. All operate by loading the store, mutating, and saving. Generate ids via `generateLocalId()`. Cascade deletes locally too (deleting a project nulls its `projectId` on entries; deleting a tag removes from `entry.tagIds[]`; deleting an entry removes from any draft invoice line items).

Test pattern (same shape per entity):
```ts
describe("local entries", () => {
  beforeEach(() => clearStore());
  it("creates and lists entries", () => {
    const e = createLocalEntry({ description: "code", startTime: new Date().toISOString(), billable: true, tagIds: [] });
    expect(e.id).toMatch(/^local-/);
    expect(listLocalEntries()).toHaveLength(1);
  });
  // … delete cascades from project deletion, etc.
});
```

Commit per entity: `feat(local-store): add CRUD for {entity}`

---

## Phase 2 — Auth state + middleware

### Task 5: useAuthState hook

**Files:**
- Create: `src/lib/auth/state.ts`
- Test: `src/lib/auth/__tests__/state.test.ts`

```ts
type AuthState = { status: "loading" } | { status: "anonymous"; clientId: string } | { status: "authenticated"; user: { id: string; email: string; name: string | null } };

export function useAuthState(): AuthState;
```

Implementation: hits `/api/auth/me` (new tiny route returning the result of `getAuthUser()` or null), caches via SWR-style. Falls back to anonymous if 401 / null. Returns `loading` until first response.

New API route: `src/app/api/auth/me/route.ts`:
```ts
export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({ user: user ? { id: user.id, email: user.email, name: user.name } : null });
}
```

Tests: mock fetch returning user → state becomes `authenticated`; mock null → `anonymous` with clientId from `getOrCreateClientId()`.

Commit: `feat(auth): add useAuthState hook + /api/auth/me route`

---

### Task 6: Update middleware to allow anonymous app access

**Files:**
- Modify: `middleware.ts`

Current `PUBLIC_ROUTES = new Set(["/"])`. Change to: app routes (`/timer`, `/tracking`, `/calendar`, `/canvas`, `/overview`, `/projects`, `/clients`, `/tags`, `/invoices`, `/settings`) are public at the **middleware** level. The middleware no longer redirects unauthenticated users away from these. API routes continue to 401 via `getAuthUser()`.

```ts
const PUBLIC_PREFIXES = ["/", "/timer", "/tracking", "/calendar", "/canvas", "/overview", "/projects", "/clients", "/tags", "/invoices", "/settings"];
function isPublic(pathname: string) {
  if (PUBLIC_PREFIXES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => p !== "/" && pathname.startsWith(p + "/"));
}
```

Test: integration test with `npm run test:run` — write a vitest unit test for `isPublic()` covering all listed prefixes.

Commit: `feat(middleware): allow anonymous access to app routes`

---

## Phase 3 — Data adapter

### Task 7: Adapter for time entries

**Files:**
- Create: `src/lib/data-adapter/entries.ts`
- Test: `src/lib/data-adapter/__tests__/entries.test.ts`

```ts
export async function listEntries(filters?: EntryFilters): Promise<TimeEntryDTO[]> {
  if (isAnonymous()) return listLocalEntries(filters);
  const res = await fetch(`/api/time-entries?${qs(filters)}`);
  return res.json();
}
// same for createEntry, updateEntry, deleteEntry, getEntryById, stopEntry
```

`isAnonymous()` reads from useAuthState's underlying cache (export a vanilla `getAuthSnapshot()` for non-React callers). When anonymous, calls flow to `local-store/entries.ts`. When authenticated, calls flow to existing API. Shape returned must match in both branches; add a thin `toLocalDTO()` mapper.

Test: mock `getAuthSnapshot()` returning anonymous → adapter calls local-store; returning authenticated → adapter calls fetch.

Commit: `feat(data-adapter): route time entries through adapter`

---

### Task 8: Adapter for projects/clients/tags

**Files:**
- Create: `src/lib/data-adapter/projects.ts`, `clients.ts`, `tags.ts`, `description-rules.ts`, `settings.ts`, `invoices.ts`
- Tests: co-located

Same pattern as Task 7. Per entity. Commit per entity.

---

### Task 9: Migrate Zustand stores to use adapter

**Files:**
- Modify: `src/stores/app-store.ts`
- Modify: `src/stores/timer-store.ts` (only the persistence side — local-store calls)
- Modify: `src/lib/timer-actions.ts` (skip server POST when anonymous; persist to local entries)

`app-store.ts`'s SWR cache replaces direct `fetch("/api/...")` calls with adapter calls. Most lines are 1-line changes. The timer `resumeTimerOptimistic` flow already uses temp ids — when anonymous, instead of POSTing, call `createLocalEntry()` and use the returned id.

Tests: existing tests pass; add tests showing anonymous calls hit local-store.

Commit: `feat(stores): route reads/writes through data-adapter`

---

## Phase 4 — UI entry points

### Task 10: Landing page CTAs

**Files:**
- Modify: `src/app/page.tsx`

Change `webAppHref` for unsigned users from `/sign-up` to `/timer`. Update copy: "Use on the web" → "Open app" (same as signed-in). The "Sign in" / "Sign up" links remain in nav for users who already have accounts.

Commit: `feat(landing): route anonymous users to /timer`

---

### Task 11: AnonymousBanner component

**Files:**
- Create: `src/components/layout/anonymous-banner.tsx`
- Test: visual / behavior unit test if useful (mostly E2E)

```tsx
export function AnonymousBanner() {
  const auth = useAuthState();
  const entryCount = useLocalEntryCount();

  if (auth.status !== "anonymous" || entryCount === 0) return null;

  return (
    <div className="bg-[var(--accent)] text-[var(--accent-fg)] text-[12px] py-2 px-4 flex items-center justify-between border-b">
      <span>
        <strong>{entryCount}</strong> {entryCount === 1 ? "entry" : "entries"} saved locally · sign in to back them up
      </span>
      <div className="flex gap-2">
        <Link href="/sign-up" className="underline font-medium">Save your progress</Link>
        <Link href="/sign-in" className="opacity-70 hover:opacity-100">Sign in</Link>
      </div>
    </div>
  );
}
```

Commit: `feat(banner): add anonymous mode banner`

---

### Task 12: Mount banner in app layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`

Mount `<AnonymousBanner />` directly above `<GlobalTimerBar />` so it stays sticky at the top.

Commit: `feat(layout): mount AnonymousBanner above timer bar`

---

### Task 13: Update AppBoot for anonymous users

**Files:**
- Modify: `src/components/layout/app-boot.tsx`

When auth is `anonymous`, skip `fetchSettings()` / `fetchProjects()` (they'd 401) and instead hydrate from local store. Splash hides immediately if no local data; otherwise hides after local hydration completes (instant).

Commit: `feat(boot): skip server fetches when anonymous`

---

### Task 14: GitHub-locked features show sign-in CTA

**Files:**
- Modify: GitHub-related entry points (find via grep `github`):
  - Likely: `src/components/projects/repo-picker.tsx`, the Connect GitHub button on settings/projects, the untracked-commits page, weekly recap, contribution graph
- Modify: `src/app/(app)/invoices/page.tsx` work-summary button

Wrap each in a `useAuthState()` check. When anonymous, render the same button but `onClick` opens a modal with copy "Connect GitHub by signing in first" + a `/sign-up?redirect=<current-path>` link.

Commit: `feat(locked-features): show sign-in CTA for GitHub and AI summary in anonymous mode`

---

## Phase 5 — Sync

### Task 15: SyncImport Prisma model

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev --name add_sync_import`

```prisma
model SyncImport {
  id          String   @id @default(cuid())
  userId      String
  clientId    String
  importedAt  DateTime @default(now())
  idMap       Json
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, clientId])
}
```

Add `syncImports SyncImport[]` to User model.

Commit: `feat(db): add SyncImport model for idempotent local-data import`

---

### Task 16: /api/sync/import endpoint

**Files:**
- Create: `src/app/api/sync/import/route.ts`
- Create: `src/lib/sync/import.ts` — pure helper, easier to test
- Test: `src/lib/sync/__tests__/import.test.ts` (unit on the helper) + `src/app/api/sync/import/__tests__/route.test.ts` (integration)

Helper signature:
```ts
export async function importLocalStoreForUser(opts: {
  prisma: PrismaClient; userId: string; clientId: string; payload: LocalStore;
}): Promise<{ idMap: Record<string,string>; counts: Counts; alreadyImported: boolean }>;
```

Algorithm: 
1. Look up `SyncImport` for `(userId, clientId)`. If found → return its `idMap` and `alreadyImported: true`.
2. Inside `prisma.$transaction(async tx => …)`:
   - Insert clients (collect map), projects (mapping clientId refs), tags, description rules (mapping projectId refs).
   - Insert time entries (mapping projectId refs, with tags via TimeEntryTag, commits inline).
   - Insert invoices (mapping clientId refs) and line items (mapping timeEntryId refs).
   - Merge non-null settings into User row.
   - Insert SyncImport row with the idMap.
3. Return `{ idMap, counts, alreadyImported: false }`.

Route: thin wrapper that calls `getAuthUser()`, parses body, validates schema (zod), calls helper, returns JSON.

Tests:
- Helper unit: build a fake LocalStore, run against an in-memory or mocked Prisma, assert all rows created and mappings correct.
- Integration: real Prisma test DB; POST with payload; assert rows; POST same payload again → `alreadyImported: true`, no new rows.

Commit: `feat(sync): add /api/sync/import with idempotent bulk import`

---

### Task 17: Client-side sync orchestrator

**Files:**
- Create: `src/lib/sync/client.ts`
- Test: `src/lib/sync/__tests__/client.test.ts`

```ts
export async function syncLocalToCloud(): Promise<SyncResult> {
  const store = loadStore();
  if (isStoreEmpty(store)) return { ok: true, skipped: true };
  const res = await fetch("/api/sync/import", { method: "POST", body: JSON.stringify({ clientId: store.clientId, payload: store }) });
  if (!res.ok) return { ok: false, error: await res.text() };
  const { idMap } = await res.json();
  remapTimerStore(idMap); // update running entry id if present
  clearStore();
  return { ok: true, idMap };
}
```

Tests: mock fetch, assert clearStore called only on success.

Commit: `feat(sync): add client-side sync orchestrator`

---

### Task 18: Wire sync to sign-up flow

**Files:**
- Modify: `src/app/(auth)/sign-up/page.tsx`

After `authClient.signUp.email()` resolves with success:
1. Show "Syncing your work…" inline state on the form.
2. Call `await syncLocalToCloud()`.
3. On success, `router.push("/timer")`.
4. On failure: keep user signed in but show toast "Sync failed — your local data is preserved, retry from the banner".

Commit: `feat(sign-up): sync local data to cloud after successful signup`

---

### Task 19: Wire sync + merge prompt to sign-in flow

**Files:**
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/components/auth/merge-prompt.tsx`

After successful sign-in, check `isStoreEmpty()`. If not empty, render `<MergePrompt entryCount={n}>` modal:
- "Add to your account" → `await syncLocalToCloud()` → push to `/timer`.
- "Discard local data" → `clearStore()` → push to `/timer`.

Commit: `feat(sign-in): prompt to merge or discard anonymous data on sign-in`

---

### Task 20: Sign-out prompt

**Files:**
- Find sign-out trigger (likely in user menu / sidebar) — update to open a modal first
- Create: `src/components/auth/signout-prompt.tsx`

Modal: "Keep a local copy of your work, or clear it?" with a "Clear (recommended)" primary button. After choice, complete the Neon Auth sign-out + optionally `clearStore()`.

Commit: `feat(sign-out): prompt to keep or clear local data`

---

## Phase 6 — Edge cases hardening

### Task 21: Multi-tab sync

**Files:**
- Modify: `src/lib/local-store/store.ts` to dispatch a `BroadcastChannel("boggltrack-local-store")` message after each save.
- Modify: stores subscribe to the channel and re-read.

Test (manual + E2E in Phase 7): open two tabs, create entry in one, see it appear in the other.

Commit: `feat(local-store): cross-tab sync via BroadcastChannel`

---

### Task 22: Quota exceeded UX

**Files:**
- Modify: `src/lib/local-store/store.ts` — already throws `LocalStoreQuotaError`
- Modify: stores' write paths to catch and toast "Storage full — sign in to continue."

Commit: `feat(local-store): graceful UX on QuotaExceeded`

---

### Task 23: Sync retry from banner

**Files:**
- Modify: `src/components/layout/anonymous-banner.tsx`

When `useAuthState()` is `authenticated` but `localStore` is non-empty (= deferred sync state from a failed sign-up sync), show a different banner: "Sync interrupted — N entries pending. [Retry]". Click → `syncLocalToCloud()`.

Commit: `feat(banner): retry deferred sync from banner`

---

## Phase 7 — E2E coverage (mandatory)

### Task 24: Anonymous happy path

**Files:**
- Create: `tests/e2e/anonymous-mode.spec.ts`

```ts
test("anonymous user tracks time, signs up, sees synced data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /open app/i }).click();
  await expect(page).toHaveURL(/\/timer/);
  await page.getByPlaceholder(/what are you working on/i).fill("Anonymous test entry");
  await page.getByRole("button", { name: /start timer/i }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /stop/i }).click();
  await expect(page.getByText(/anonymous test entry/i)).toBeVisible();
  await expect(page.getByText(/saved locally/i)).toBeVisible(); // banner
  await page.getByRole("link", { name: /save your progress/i }).click();
  // sign-up form
  await page.getByLabel(/name/i).fill("E2E User");
  await page.getByLabel(/email/i).fill(`e2e-${Date.now()}@test.local`);
  await page.getByLabel(/password/i).fill("P@ssw0rd-test-1");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/timer/, { timeout: 15_000 });
  await expect(page.getByText(/saved locally/i)).not.toBeVisible();
  await expect(page.getByText(/anonymous test entry/i)).toBeVisible(); // synced
});
```

Note: requires a test user cleanup or unique email per run.

Commit: `test(e2e): anonymous happy path`

---

### Task 25: Existing-account merge prompt

**Files:**
- Create: `tests/e2e/anonymous-merge-prompt.spec.ts`

Pre-create an account via API in fixture. In test: track anonymously, sign in to existing account, see merge modal, choose "Discard" first time / "Merge" second time. Assert end state.

Commit: `test(e2e): merge prompt on sign-in with existing account`

---

### Task 26: GitHub feature shows sign-in CTA when anonymous

**Files:**
- Create: `tests/e2e/anonymous-locked-features.spec.ts`

Anonymous user navigates to a project page → clicks "Connect GitHub" → sees sign-in modal. Same for AI summary in invoice flow.

Commit: `test(e2e): GitHub + AI summary show sign-in CTA when anonymous`

---

### Task 27: Sign-out prompt

**Files:**
- Create: `tests/e2e/signout-prompt.spec.ts`

Sign in (any account) → start tracking (will be live cloud data, so no anon banner) → sign out → confirm modal asks "keep or clear" → choose Clear → assert localStorage emptied.

Commit: `test(e2e): sign-out prompt clears or preserves local data`

---

## Phase 8 — Verification

### Task 28: Full test suite

```bash
npm run test:run                 # unit + integration via vitest
npx playwright test --repeat-each=2  # all E2E twice for flake check
```

All green required before merge.

### Task 29: Manual smoke

1. Open landing in incognito → click Open app → start timer → stop → see banner → close tab → reopen → data still there.
2. Sign up in same browser → entries sync → banner gone.
3. Sign out → choose Clear → banner reappears empty (no entries) → start fresh.

### Task 30: Merge to main

```bash
cd .worktrees/anon-mode
git push -u origin feat/anonymous-mode
gh pr create --title "feat: anonymous-first time tracking with cloud sync on signup" \
  --body "$(cat <<'EOF'
## Summary
- Users can track time without signing up; data lives in localStorage.
- Slim banner above the timer prompts sign-in; clicks "Save your progress".
- New /api/sync/import bulk-imports local data on sign-up; idempotent via SyncImport table.
- Sign-in to existing account shows merge-or-discard prompt.
- Sign-out asks whether to keep or clear local data.

## Test plan
- [ ] `npm run test:run` green
- [ ] `npx playwright test` green
- [ ] Manual: track anonymously, sign up, confirm sync
- [ ] Manual: sign-in with local data, see merge prompt
- [ ] Manual: sign-out prompts to keep/clear
EOF
)"
```

After merge, delete worktree:
```bash
cd /Users/burhankhatri/Documents/BogglTrack
git worktree remove .worktrees/anon-mode
```

---

## Spec coverage check

| Spec edge case | Covered by task |
|----------------|-----------------|
| 1, 17 First-visit / clear data | Tasks 1, 3 (clientId, banner doesn't show until first entry) |
| 2 Storage disabled | Task 22 (QuotaExceeded handler) — incognito test in manual smoke |
| 3 Quota exceeded | Task 22 |
| 4 Multi-tab | Task 21 |
| 5 Anon → signup happy | Tasks 18, 24 |
| 6 Anon → existing acct | Tasks 19, 25 |
| 7 Sync fails | Tasks 18 (toast), 23 (banner retry) |
| 8 Sign-out | Tasks 20, 27 |
| 9 Switching accts | Task 20 + manual smoke |
| 10, 11 GitHub/Groq | Tasks 14, 26 |
| 12 Invoice PDF anon | Already works (current PDF code is client-only) |
| 13 Live timer mid-sync | Task 17 (`remapTimerStore(idMap)`) |
| 14 Mid-sync mutation | Task 17 (UI lock during sync) |
| 15 Schema migration | Task 3 (placeholder) |
| 16 Electron | No code change — same web URL |
| 18 Repeat sync | Task 16 (idempotent SyncImport) |
| 19 Pre-cleared sync | Task 17 (`isStoreEmpty()` guard) |
| 20 LS tampering | Task 16 (zod validation server-side) |

All edge cases mapped to tasks. No "TBD" left.
