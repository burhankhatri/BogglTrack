# Canvas Page + Bug Fixes — Implementation Plan

**Goal:** Fix dropdown overflow and calendar mobile bugs, add Canvas page for visual entity linking.
**Architecture:** New `DescriptionRule` Prisma model, 3 new API routes, `@xyflow/react` Canvas page, modify time-entry creation to auto-apply rules.
**Tech Stack:** Next.js 16, React 19, @xyflow/react, Prisma, Zustand, Tailwind CSS 4

---

## Task 1: Fix dropdown overflow on timer and calendar pages

**Files:**
- Modify: `src/app/(app)/timer/page.tsx`
- Modify: `src/app/(app)/calendar/page.tsx`

- [ ] **Step 1: Remove `overflow-hidden` from timer page entry list Card**
  In `src/app/(app)/timer/page.tsx`, find the Card at ~line 646:
  ```
  <Card className="border border-[var(--border-subtle)] shadow-[var(--shadow-card)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)] overflow-hidden">
  ```
  Remove `overflow-hidden` so it becomes:
  ```
  <Card className="border border-[var(--border-subtle)] shadow-[var(--shadow-card)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
  ```

- [ ] **Step 2: Remove `overflow-hidden` from calendar page entry list Card**
  In `src/app/(app)/calendar/page.tsx`, find the Card at ~line 130:
  ```
  <Card className="border border-[var(--border-subtle)] shadow-[var(--shadow-card)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)] overflow-hidden">
  ```
  Remove `overflow-hidden`.

- [ ] **Step 3: Verify and commit**
  Run: `npx tsc --noEmit`
  Commit: `git commit -m "fix: remove overflow-hidden clipping Select dropdowns"`

---

## Task 2: Fix calendar mobile UI

**Files:**
- Modify: `src/components/ui/calendar.tsx`
- Modify: `src/app/(app)/calendar/page.tsx`

- [ ] **Step 1: Make calendar cells responsive**
  In `src/components/ui/calendar.tsx`, change cell and day sizes to be smaller on mobile:
  ```
  cell: "h-8 w-8 sm:h-9 sm:w-9 text-center text-sm p-0 m-0"
  day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal ..."
  head_cell: "text-[var(--text-olive)] rounded-md w-8 sm:w-9 font-normal text-[0.8rem]"
  ```

- [ ] **Step 2: Center calendar on mobile in calendar page**
  In `src/app/(app)/calendar/page.tsx`, add centering to the Calendar Card:
  ```
  <Card className="p-2 ... self-start mx-auto md:mx-0">
  ```

- [ ] **Step 3: Verify and commit**
  Run: `npx tsc --noEmit`
  Commit: `git commit -m "fix: make calendar responsive on mobile"`

---

## Task 3: Add DescriptionRule to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add DescriptionRule model**
  Add to `prisma/schema.prisma`:
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

- [ ] **Step 2: Add reverse relations to User and Project**
  In the `User` model, add: `descriptionRules DescriptionRule[]`
  In the `Project` model, add: `descriptionRules DescriptionRule[]`

- [ ] **Step 3: Push schema and generate client**
  Run: `npx prisma db push`
  Run: `npx prisma generate`

- [ ] **Step 4: Commit**
  `git commit -m "feat: add DescriptionRule schema for auto-linking entries"`

---

## Task 4: Create description-rules API routes

**Files:**
- Create: `src/app/api/description-rules/route.ts`
- Create: `src/app/api/description-rules/[id]/route.ts`
- Test: `src/app/api/description-rules/__tests__/description-rules.test.ts`

- [ ] **Step 1: Write failing tests**
  Create `src/app/api/description-rules/__tests__/description-rules.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { buildRuleRequestBody, validateRuleBody } from "../helpers";

  describe("validateRuleBody", () => {
    it("returns null for valid body", () => {
      expect(validateRuleBody({ description: "joshua", projectId: "proj-1" })).toBeNull();
    });
    it("returns error for missing description", () => {
      expect(validateRuleBody({ projectId: "proj-1" })).toBe("description is required");
    });
    it("returns error for missing projectId", () => {
      expect(validateRuleBody({ description: "test" })).toBe("projectId is required");
    });
    it("returns error for empty description", () => {
      expect(validateRuleBody({ description: "", projectId: "p" })).toBe("description is required");
    });
  });
  ```

- [ ] **Step 2: Run tests — expect FAIL**
  Run: `npx vitest run src/app/api/description-rules/__tests__/description-rules.test.ts`

- [ ] **Step 3: Create helpers**
  Create `src/app/api/description-rules/helpers.ts`:
  ```typescript
  export function validateRuleBody(body: Record<string, unknown>): string | null {
    if (!body.description || typeof body.description !== "string" || body.description.trim() === "") {
      return "description is required";
    }
    if (!body.projectId || typeof body.projectId !== "string") {
      return "projectId is required";
    }
    return null;
  }
  ```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Create GET/POST route**
  Create `src/app/api/description-rules/route.ts`:
  - `GET`: Return all rules for user with `include: { project: true }`
  - `POST`: Validate body, upsert rule, then `prisma.timeEntry.updateMany({ where: { description, userId }, data: { projectId } })` to bulk-link existing entries. Return `{ rule, entriesUpdated: count }`.

- [ ] **Step 6: Create DELETE route**
  Create `src/app/api/description-rules/[id]/route.ts`:
  - `DELETE`: Verify ownership, delete rule. Return `{ success: true }`.

- [ ] **Step 7: Commit**
  `git commit -m "feat: add description-rules API with bulk entry linking"`

---

## Task 5: Auto-apply description rules on time entry creation

**Files:**
- Modify: `src/app/api/time-entries/route.ts`
- Test: `src/lib/__tests__/auto-link-rule.test.ts`

- [ ] **Step 1: Write failing test**
  ```typescript
  import { describe, it, expect } from "vitest";
  import { shouldAutoLink } from "@/lib/auto-link";

  describe("shouldAutoLink", () => {
    it("returns projectId when rule matches", () => {
      const rules = [{ description: "joshua", projectId: "proj-1" }];
      expect(shouldAutoLink("joshua", rules)).toBe("proj-1");
    });
    it("returns null when no rule matches", () => {
      const rules = [{ description: "other", projectId: "proj-1" }];
      expect(shouldAutoLink("joshua", rules)).toBeNull();
    });
    it("returns null when description is empty", () => {
      expect(shouldAutoLink("", [])).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**
  Create `src/lib/auto-link.ts`:
  ```typescript
  interface Rule { description: string; projectId: string }
  export function shouldAutoLink(description: string, rules: Rule[]): string | null {
    if (!description) return null;
    const match = rules.find((r) => r.description === description);
    return match?.projectId ?? null;
  }
  ```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Modify POST /api/time-entries**
  After `const { description, ... } = body;`, before creating the entry:
  ```typescript
  let resolvedProjectId = projectId || null;
  if (!resolvedProjectId && description) {
    const rule = await prisma.descriptionRule.findUnique({
      where: { description_userId: { description, userId: user.id } },
    });
    if (rule) resolvedProjectId = rule.projectId;
  }
  ```
  Use `resolvedProjectId` instead of `projectId` in the create call.

- [ ] **Step 6: Commit**
  `git commit -m "feat: auto-apply description rules on time entry creation"`

---

## Task 6: Install @xyflow/react

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**
  Run: `npm install @xyflow/react`

- [ ] **Step 2: Commit**
  `git commit -m "chore: add @xyflow/react for canvas page"`

---

## Task 7: Create Canvas page — data loading and node/edge builder

**Files:**
- Create: `src/app/(app)/canvas/canvas-helpers.ts`
- Test: `src/app/(app)/canvas/__tests__/canvas-helpers.test.ts`

- [ ] **Step 1: Write failing tests**
  ```typescript
  import { describe, it, expect } from "vitest";
  import { buildNodes, buildEdges, groupEntryDescriptions } from "../canvas-helpers";

  describe("groupEntryDescriptions", () => {
    it("groups identical descriptions into one node with count", () => {
      const entries = [
        { id: "1", description: "joshua", projectId: "p1" },
        { id: "2", description: "joshua", projectId: "p1" },
        { id: "3", description: "joshua", projectId: null },
      ];
      const grouped = groupEntryDescriptions(entries);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].description).toBe("joshua");
      expect(grouped[0].count).toBe(3);
      expect(grouped[0].entryIds).toEqual(["1", "2", "3"]);
    });

    it("keeps different descriptions as separate nodes", () => {
      const entries = [
        { id: "1", description: "joshua1", projectId: null },
        { id: "2", description: "joshua2", projectId: null },
        { id: "3", description: "joshua3", projectId: null },
      ];
      const grouped = groupEntryDescriptions(entries);
      expect(grouped).toHaveLength(3);
    });
  });

  describe("buildNodes", () => {
    it("creates client nodes at x=0", () => {
      const nodes = buildNodes(
        [{ id: "c1", name: "Acme" }],
        [],
        []
      );
      const clientNode = nodes.find((n) => n.id === "client-c1");
      expect(clientNode).toBeDefined();
      expect(clientNode!.position.x).toBe(0);
      expect(clientNode!.type).toBe("clientNode");
    });

    it("creates project nodes at x=400", () => {
      const nodes = buildNodes(
        [],
        [{ id: "p1", name: "Web", color: "#f00", clientId: null }],
        []
      );
      const projNode = nodes.find((n) => n.id === "project-p1");
      expect(projNode).toBeDefined();
      expect(projNode!.position.x).toBe(400);
    });

    it("creates entry nodes at x=800", () => {
      const nodes = buildNodes([], [], [{ description: "work", count: 3, entryIds: ["1","2","3"], projectId: "p1", totalDuration: 100 }]);
      const entryNode = nodes.find((n) => n.id === "entry-work");
      expect(entryNode).toBeDefined();
      expect(entryNode!.position.x).toBe(800);
    });
  });

  describe("buildEdges", () => {
    it("creates edge from project to client when clientId exists", () => {
      const edges = buildEdges(
        [{ id: "p1", name: "Web", color: "#f00", clientId: "c1" }],
        [{ description: "work", projectId: null, entryIds: [], count: 1, totalDuration: 0 }],
        []
      );
      const edge = edges.find((e) => e.source === "project-p1" && e.target === "client-c1");
      expect(edge).toBeDefined();
    });

    it("creates edge from entry to project via description rule", () => {
      const edges = buildEdges(
        [{ id: "p1", name: "Web", color: "#f00", clientId: null }],
        [{ description: "work", projectId: "p1", entryIds: ["1"], count: 1, totalDuration: 0 }],
        [{ id: "r1", description: "work", projectId: "p1" }]
      );
      const edge = edges.find((e) => e.source === "entry-work" && e.target === "project-p1");
      expect(edge).toBeDefined();
    });
  });
  ```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement canvas-helpers.ts**
  Build `groupEntryDescriptions`, `buildNodes`, `buildEdges` functions that transform raw data into React Flow nodes and edges.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**
  `git commit -m "feat: add canvas helpers for node/edge building"`

---

## Task 8: Create Canvas page component

**Files:**
- Create: `src/app/(app)/canvas/page.tsx`
- Modify: `src/components/layout/app-sidebar.tsx` (add Canvas nav item)
- Modify: `src/stores/app-store.ts` (add /canvas to prefetch map)

- [ ] **Step 1: Create the page**
  Build `src/app/(app)/canvas/page.tsx`:
  - Fetch clients, projects, time entries, description rules on mount
  - Use `buildNodes` and `buildEdges` to generate React Flow data
  - Render `<ReactFlow>` with three custom node types (clientNode, projectNode, entryNode)
  - Handle `onConnect` callback:
    - If source is entry node + target is project node: POST to `/api/description-rules`
    - If source is project node + target is client node: PATCH `/api/projects/{id}` with `clientId`
  - Handle edge deletion:
    - Entry→Project edge: DELETE `/api/description-rules/{id}`
    - Project→Client edge: PATCH `/api/projects/{id}` with `clientId: null`
  - Show toast on success/failure
  - Optimistic: add edge immediately, remove on failure

- [ ] **Step 2: Create custom node components**
  Inside the same file or split into `canvas-nodes.tsx`:
  - `ClientNode`: rounded card with name, connection handle on right
  - `ProjectNode`: rounded card with color dot + name, handles on left (for client) and right (for entries)
  - `EntryNode`: rounded card with description + count badge + duration, handle on left

- [ ] **Step 3: Add to sidebar and prefetch map**
  In `app-sidebar.tsx`: add `{ title: "Canvas", href: "/canvas", icon: GitBranchPlus }` after Tracking
  In `app-store.ts`: add `"/canvas": ["projects", "clients", "timerEntries"]` to ROUTE_PREFETCH_MAP

- [ ] **Step 4: Verify and commit**
  Run: `npx tsc --noEmit && npm run test:run`
  Commit: `git commit -m "feat: add Canvas page with visual entity linking"`

---

## Task 9: Add Canvas to mobile tab bar

**Files:**
- Modify: `src/components/layout/mobile-tab-bar.tsx`

- [ ] **Step 1: Add Canvas tab**
  Add `{ title: "Canvas", href: "/canvas", icon: GitBranchPlus }` to the `mobileTabs` array. Keep it to 5 tabs max (Home, Calendar, Canvas, Overview, Profile).

- [ ] **Step 2: Commit**
  `git commit -m "feat: add Canvas to mobile navigation"`

---

## Task 10: E2E tests

**Files:**
- Create: `tests/e2e/canvas.spec.ts`

- [ ] **Step 1: Write Playwright E2E tests**
  Cover:
  - Canvas page loads with nodes for clients, projects, entries
  - Dropdown on timer page is visible (not clipped) when editing
  - Calendar page renders correctly on mobile viewport

- [ ] **Step 2: Run and verify**
  Run: `npx playwright test --repeat-each=3`

- [ ] **Step 3: Commit**
  `git commit -m "test: add e2e tests for canvas and bug fixes"`

---

## Dependency Graph

```
Task 1 (dropdown fix)     ── independent
Task 2 (calendar mobile)  ── independent
Task 3 (schema)           ── independent
Task 4 (API routes)       ── depends on Task 3
Task 5 (auto-link)        ── depends on Task 3
Task 6 (install xyflow)   ── independent
Task 7 (canvas helpers)   ── depends on Task 3
Task 8 (canvas page)      ── depends on Tasks 4, 5, 6, 7
Task 9 (mobile nav)       ── depends on Task 8
Task 10 (e2e)             ── depends on all
```

Tasks 1, 2, 3, 6 can run in parallel.
Tasks 4, 5, 7 can run in parallel after Task 3.
Task 8 is the integration point.
