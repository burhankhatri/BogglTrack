# Spec: Anonymous-First Time Tracking

**Status:** Draft, awaiting approval
**Date:** 2026-04-26
**Owner:** BurhanCantCode

## Goal

Users land in the app and start tracking time *immediately*, without signing up. All data stays in `localStorage` until they sign in. On sign-in/up, local data syncs to the cloud account. A persistent slim banner above the timer reminds them to save their progress.

## Why

Today, anyone hitting `/timer` (or any app route) is bounced to `/sign-in`. That's a hard friction wall before the user has felt any value. The first hit of the timer button is the activation moment — sign-up should come *after* that, not before.

## User stories

1. **First-time visitor** — clicks "Open app" on the landing page → arrives at `/timer` with an empty timer ready to start. No sign-in required.
2. **Anonymous power user** — tracks several days of work, creates projects/clients, generates invoice PDFs, all without an account. PDFs download with `boggltrack.com` tagline already shipped.
3. **Anonymous → signup conversion** — clicks "Save your progress" in the banner → standard sign-up form → on success, sees a brief "Syncing your work…" status, then everything they tracked is in the cloud account.
4. **Anonymous → existing account login** — already has an account elsewhere, signs in. Sees a modal: "You have N entries from anonymous use. Add them to your account, or discard?". User picks.
5. **Returning anonymous user** — closes browser, reopens, sees their data still there (localStorage persists).
6. **Sign-out** — modal asks "Keep local copy or clear?". Sensible default: clear, since most sign-outs are intentional.
7. **GitHub / AI summary attempts** — when anonymous, the GitHub button or "Generate summary" button is visible, but clicking shows a CTA "Sign in to connect GitHub" / "…to use AI summary". Discoverable, not hidden.

## Architecture

```
┌──────────────────── Browser ──────────────────────┐
│                                                   │
│  ┌──────────────────────────────────────┐         │
│  │ React UI (timer, invoices, etc.)     │         │
│  └──────────────┬───────────────────────┘         │
│                 │                                 │
│  ┌──────────────▼───────────────────────┐         │
│  │ Zustand stores (timer-store, app-    │         │
│  │ store) — unchanged shapes            │         │
│  └──────────────┬───────────────────────┘         │
│                 │                                 │
│  ┌──────────────▼───────────────────────┐         │
│  │ data-adapter.ts — switches based on  │         │
│  │ useAuthState():                      │         │
│  │   anonymous → local-store            │         │
│  │   authenticated → /api/* fetches     │         │
│  └─────┬────────────────────┬───────────┘         │
│        │                    │                     │
│  ┌─────▼─────┐         ┌────▼─────┐               │
│  │ local-    │         │ existing │               │
│  │ store/    │         │ /api/*   │               │
│  │ (LS)      │         │ routes   │               │
│  └───────────┘         └────┬─────┘               │
└────────────────────────────│──────────────────────┘
                             │
                  ┌──────────▼─────────────┐
                  │ Next.js API + Prisma   │
                  │ (unchanged) +          │
                  │ NEW /api/sync/import   │
                  └────────────────────────┘
```

### Auth state machine

```
anonymous ──signup──► syncing ──ok──► authenticated
   │                     │
   │                     └──fail──► syncFailed (retry/discard)
   │
   └──signin to existing acct──► promptMerge
                                   │
                                   ├──merge──► syncing → authenticated
                                   └──discard──► clearLocal → authenticated
```

### Anonymous identity

A single client-generated UUIDv4 stored under `boggltrack.client-id` on first visit. Used as a stable namespace for local data and as a dedupe key on the server when syncing (so re-running sync after a crash doesn't duplicate rows).

## Data model — local schema

`localStorage` key `boggltrack.local-store.v1` holds a JSON blob:

```ts
interface LocalStore {
  schemaVersion: 1;          // bump on incompatible shape changes
  clientId: string;          // UUIDv4, stable across sessions
  createdAt: string;         // ISO
  settings: LocalSettings;   // mirrors User table fields used in app
  projects: LocalProject[];  // {id: "local-...", ...}
  clients: LocalClient[];
  tags: LocalTag[];
  descriptionRules: LocalDescriptionRule[];
  timeEntries: LocalTimeEntry[]; // includes commits[] inline
  invoices: LocalInvoice[];      // includes lineItems[] inline
}
```

All ids generated locally use the prefix `local-` plus a UUID. `isLocalId(id)` helper lets the adapter decide whether a write is local or remote. Foreign keys use the same `local-` ids; on sync, the server returns a `{ localId → dbId }` map and the client rewrites refs in any cached state. After successful sync, the entire `boggltrack.local-store.v1` key is deleted.

Existing localStorage keys (`boggltrack-timer`, `boggltrack-invoice-draft`, `boggltrack-onboarding-dismissed`, `boggl.untracked.*`) are unaffected — they coexist with the new key.

## Sync flow

1. User completes sign-up (or sign-in for existing account, after merge prompt).
2. Client reads the entire `LocalStore` blob.
3. POST `/api/sync/import` with body `{ clientId, payload: LocalStore }`. Server:
   - Authenticates via the freshly minted Neon Auth session cookie.
   - Idempotency: stores `{ userId, clientId, importedAt }` in a `SyncImport` table. If a row exists for `(userId, clientId)`, returns the previous id-mapping (no double-create).
   - Inside one Prisma `$transaction`:
     - Insert clients, projects, tags, description rules — collect id maps.
     - Insert time entries (with commits JSON inline), referencing the new project/tag ids.
     - Insert invoices + line items, mapping `timeEntryId` references.
     - Settings: merge non-null local fields into the user's existing settings (don't overwrite cloud settings the user already had).
   - Returns `{ idMap: Record<string, string>, counts: {...} }`.
4. Client updates any in-memory references (mostly the timer-store's running entry id), then calls `localStore.clear()`.
5. UI redirects to `/timer` and the regular `app-store.fetchAll()` runs against the cloud.

### Sync failure handling

- Network drop mid-sync: the request times out client-side. Local data is *not* cleared. User sees "Sync interrupted — retry?" toast. Idempotency in step 3 makes retry safe.
- Quota exceeded on server (rare): same as above; user can email support / discard.
- 5xx / 4xx: same toast.

## Edge cases

| # | Scenario | Behavior |
|---|----------|----------|
| 1 | First visit, no localStorage | Generate clientId, init empty LocalStore on first write. Banner shows after first entry created (so a user who doesn't track anything isn't nagged). |
| 2 | Browser localStorage disabled (incognito + strict) | Detect on first write attempt; show inline error "Anonymous mode needs storage access — sign in to track your time." Block timer start. |
| 3 | Quota exceeded during use (~5MB) | Catch `QuotaExceededError`; toast "You've reached browser storage limits — sign in to keep going." Stop accepting new writes until sign-in or user clears. |
| 4 | Multi-tab open simultaneously | Use `storage` events + existing BroadcastChannel pattern in timer-store. Reads invalidate stores; writes propagate. Last-write-wins within the tab. |
| 5 | Anonymous → signup happy path | localStorage exists → call `/api/sync/import` → clear local → hydrate from API. |
| 6 | Anonymous → sign in to existing account | Show "Merge or discard?" modal. Merge = same sync flow. Discard = `localStore.clear()` then proceed. |
| 7 | Anonymous → signup but sync fails | Toast retry, keep localStorage intact. User stays signed in but app shows local data via adapter (so they don't lose the work; adapter can keep using local until sync succeeds — see "deferred sync"). |
| 8 | Sign-out with cloud account | Modal: "Keep a local copy of your work or clear it?". Default Clear. |
| 9 | Switching accounts on shared computer | Sign-out clears local (default) → sign-in to acct B starts fresh. |
| 10 | GitHub clicked while anonymous | Toast / modal: "Connect GitHub by signing in first." `/sign-up` link with redirect back. |
| 11 | AI summary clicked while anonymous | Same pattern — disabled with sign-in CTA. |
| 12 | Invoice PDF download anonymous | Works fully — PDF generation is client-side. The `workSummary` slot is empty (Groq is server-only). |
| 13 | Long-lived running timer when sync happens | Active timer's id is `local-…` — sync remaps it to the new DB id; the timer keeps running uninterrupted. |
| 14 | Mid-sync mutation (user clicks start while sync runs) | Sync runs in a "locked" state; UI shows a non-blocking spinner; mutations are queued and replayed against the cloud after sync completes. Practically: sync is fast (<2s for typical data), so just show a spinner and disable mutating buttons. |
| 15 | Old schema in localStorage after a deploy | `schemaVersion` mismatch → run migrations sequentially (or, if migration impossible, prompt user to sign in to keep data, else discard). v1 → v1 = no-op for now. |
| 16 | Electron desktop app | Behaves identically — Electron loads the same web URL; localStorage is per-app-session. No code change in `electron/`. |
| 17 | User clears site data manually | Anonymous data lost. Banner copy explicitly mentions this risk. |
| 18 | Repeat sync (network retry, double-click) | Idempotent via `(userId, clientId)` dedupe in `SyncImport` table. |
| 19 | Sign-up form filled while sync from a previous session is queued | Should not happen — sync only runs immediately after auth completes. But guard with `localStore.isClear()` check before the import call. |
| 20 | User opens devtools and edits localStorage | We trust the user — anonymous data is theirs. Sync does basic schema validation server-side and rejects malformed payloads. |

## Routes that work fully anonymously

`/timer`, `/tracking`, `/calendar`, `/canvas`, `/overview`, `/projects`, `/projects/[id]` (read), `/clients`, `/tags`, `/invoices` (create/preview/download), `/settings`.

## Routes that show a sign-in CTA when anonymous

`/projects/[id]` GitHub repos panel, "Connect GitHub" anywhere it appears, AI work-summary in the invoice flow, weekly recap, contribution graph, untracked-commits page.

## Out of scope

- Full offline-mode for *signed-in* users (a different feature; here we only persist when signed-out).
- Conflict resolution beyond "merge or discard" — no per-row conflict UI.
- Server-side anonymous user records (we deliberately don't create User rows until signup).
- Cross-device anonymous sync (would require a server endpoint, defeats the purpose).

## Test strategy

- **Unit:** local-store CRUD, id mapping, schema migrations, data-adapter routing decisions, sync orchestrator state machine.
- **Integration:** `/api/sync/import` with realistic payloads, idempotency, transaction rollback on partial failure.
- **E2E (Playwright):** the four user stories above, plus the merge-prompt and sign-out-prompt modals.

## Risks

- **Data loss perception** — biggest risk. Banner copy and clear, scary modal text on sign-out and incognito mitigate.
- **Adapter complexity** — every store call now goes through a dispatcher. We mitigate by keeping the adapter dead-simple (one if/else per call) and centralizing all logic.
- **Sync atomicity** — Prisma `$transaction` handles partial-failure rollback. Deferred-sync (edge case 7) is the trickiest path — keep it as fallback only.
