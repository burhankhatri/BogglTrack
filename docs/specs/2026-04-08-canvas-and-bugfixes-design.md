# Canvas Page + Bug Fixes — Design Spec

**Date:** 2026-04-08
**Goal:** Fix dropdown overflow and calendar mobile bugs, then add a Canvas page for visually linking entries to projects and projects to clients via draggable node-edge connections.

---

## Part A: Bug Fixes

### Bug 1: Dropdown Overflow

**Root cause:** Both `timer/page.tsx` (line 646) and `calendar/page.tsx` (line 130) apply `overflow-hidden` to the Card wrapping the entry list. The custom `Select` component (`select.tsx` line 122) renders the dropdown as `position: absolute` inside the card — it gets clipped.

**Fix:** Replace `overflow-hidden` with `overflow-clip` on those two Cards. `overflow-clip` still clips content to rounded corners but does NOT create a new scroll container, so absolutely-positioned children inside relatively-positioned parents can still escape via z-index. Alternatively, simply remove `overflow-hidden` since the rounded corners are already handled by `rounded-[var(--radius-xl)]` on the Card itself — the only visual purpose of `overflow-hidden` was to enforce rounded corners on child borders, but each entry row does not actually overflow the Card border radius in practice.

**Simpler approach:** Remove `overflow-hidden` from both Cards entirely.

### Bug 2: Calendar Mobile UI

**Root cause:** The Calendar component uses fixed `h-9 w-9` (36px) for day cells. On mobile the grid collapses to single column but the calendar card + cells don't resize.

**Fix:** Make the calendar responsive:
- On mobile: full-width calendar, reduce cell size to `h-8 w-8`
- Center the calendar in its container
- Remove the two-column grid on mobile (already handled by `md:grid-cols-[auto_1fr]`)

---

## Part B: Canvas Page

### Data Model

New Prisma model — `DescriptionRule`:

```prisma
model DescriptionRule {
  id          String   @id @default(cuid())
  description String
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([description, userId])
  @@index([userId])
}
```

This creates a persistent rule: "all entries with description X belong to project Y for this user." The rule applies retroactively (bulk-update existing) and proactively (auto-assign on creation).

**Schema changes needed:**
- Add `DescriptionRule` model
- Add `descriptionRules DescriptionRule[]` to `User` model
- Add `descriptionRules DescriptionRule[]` to `Project` model

### API Routes

**`GET /api/description-rules`** — Returns all rules for the authenticated user, including project name/color.

**`POST /api/description-rules`** — Body: `{ description: string, projectId: string }`. Creates/upserts the rule, then bulk-updates ALL existing time entries matching that description to the project. Returns the rule + count of entries updated.

**`DELETE /api/description-rules/[id]`** — Deletes the rule. Does NOT unlink existing entries (they keep their project assignment).

**Modify `POST /api/time-entries`** — After creating a time entry, if no `projectId` was provided, check `DescriptionRule` for a matching description. If found, auto-assign the project.

### Canvas UI

**Library:** `@xyflow/react` (React Flow v12) — purpose-built for node-edge graph UIs with drag-to-connect.

**Layout — Three columns:**

```
┌──────────┐    ┌──────────┐    ┌──────────────┐
│ Clients  │    │ Projects │    │ Entries      │
│          │    │          │    │ (by desc)    │
│ ○ Acme   │───▶│ ○ WebApp │◀──│ ○ joshua (3) │
│ ○ BobCo  │───▶│ ○ Design │◀──│ ○ joshua1    │
│          │    │ ○ API    │◀──│ ○ joshua2    │
└──────────┘    └──────────┘    └──────────────┘
```

**Node types:**
- **Client node**: Name, edge count
- **Project node**: Name, color dot, hourly rate
- **Entry node**: Description, entry count badge (if grouped), total duration

**Grouping logic for entry nodes:**
- Entries with identical descriptions → ONE node (e.g., 5 "joshua" entries = 1 node showing "joshua (5)")
- Entries with different descriptions → separate nodes (e.g., "joshua1", "joshua2", "joshua3" = 3 nodes)

**Connecting:**
- Drag from an Entry node's left handle → drop on a Project node = link entries to project
- Drag from a Project node's left handle → drop on a Client node = link project to client
- Connection triggers instant API call (optimistic edge appears immediately)

**Disconnecting:**
- Click an edge → delete button appears → removes the link
- For entry→project: deletes the DescriptionRule (entries keep current project)
- For project→client: sets `clientId = null` on the project

**Data loading:**
- Fetch all clients, projects, time entries, and description rules on mount
- Build nodes and edges from the data
- Auto-layout: clients at x=0, projects at x=400, entries at x=800

### Reports Impact

Reports already query by `project.clientId` and `projectId`. When the canvas updates these relationships, reports will reflect changes on next load (SWR cache expires in 30s, or user can refresh). No changes needed to reports code.

### Navigation

- Add `/canvas` to sidebar nav (between Tracking and Projects)
- Add to mobile tab bar (replace Calendar with Canvas, or add as 5th tab)
- Add to `ROUTE_PREFETCH_MAP` in app-store

---

## Scope Exclusions

- No drag-to-reorder within columns
- No undo/redo for link changes
- No batch operations UI (the canvas IS the batch UI)
- No real-time collaboration
- Tag linking is out of scope (only entry→project and project→client)
