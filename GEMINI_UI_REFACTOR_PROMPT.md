# BogglTrack — Gemini UI Refactor Prompt (Remove shadcn, Build Custom)

> Paste this into Gemini along with BOTH images:
> 1. The reference design (3-screen mobile mockup — the inspiration)
> 2. The current app screenshot (what it looks like now)

---

## Prompt

I have a working time tracking app called **BogglTrack** built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. It currently uses **shadcn/ui** components, but I don't like how they look. I want you to **completely rip out shadcn/ui** and replace every component with **custom-built components** that match the reference design I've attached.

**I've attached two images:**
1. **Reference design** — the 3-screen mobile mockup with the sage green/cream/olive aesthetic. THIS is the target look.
2. **Current app** — what it looks like right now. It's functional but the UI feels generic/template-y.

---

## CRITICAL RULES

### DO NOT TOUCH:
- Any file in `src/app/api/` — all API routes stay exactly as they are
- `src/stores/` — timer store logic stays as-is
- `src/lib/prisma.ts` — database client unchanged
- `src/lib/earnings.ts` — calculation logic unchanged
- `src/lib/user.ts` — user utility unchanged
- `prisma/schema.prisma` — schema unchanged
- `.env` — environment variables unchanged
- Any business logic, data fetching, state management, or API calls inside page components
- The auth system (`@neondatabase/auth`)

### ONLY TOUCH:
- `src/components/ui/` — delete ALL shadcn components, replace with custom ones
- `src/components/layout/` — restyle sidebar, timer bar, mobile tab bar
- `src/app/globals.css` — update CSS variables and global styles
- `src/app/layout.tsx` — update layout structure (remove shadcn providers like SidebarProvider)
- Page files (`src/app/**/page.tsx`) — ONLY change the JSX/markup and CSS classes, NOT the data fetching, state, or logic
- `components.json` — delete it
- `tailwind.config.ts` — update if needed
- `package.json` — remove shadcn-related deps

### THE RULE: If it's logic, don't touch it. If it's markup/styling, redesign it.

---

## What to Remove

### shadcn Dependencies to Uninstall
```
shadcn
@base-ui/react
class-variance-authority
cmdk
```

### Keep These (they're not shadcn-specific):
```
lucide-react (icons — keep using these)
recharts (charts — keep using these)
sonner (toast notifications — keep using this, just restyle)
next-themes (theme switching — keep)
tailwind-merge (utility — keep)
date-fns (dates — keep)
zustand (state — keep)
jspdf (export — keep)
```

### shadcn Components to Replace (`src/components/ui/`)
Delete ALL 27 files in this directory and replace with custom components:

| shadcn Component | Custom Replacement |
|---|---|
| `button.tsx` | Custom `Button` — pill-shaped, olive-green primary, rounded-full, no CVA |
| `card.tsx` | Custom `Card` — cream bg (#FAF8F2), rounded-2xl, subtle shadow |
| `input.tsx` | Custom `Input` — cream bg, rounded-xl, forest-green text, no ring focus |
| `label.tsx` | Custom `Label` — simple styled label |
| `select.tsx` | Custom `Select` — dropdown with cream bg, rounded-xl, custom arrow |
| `dialog.tsx` | Custom `Dialog` — modal with cream card on sage overlay |
| `badge.tsx` | Custom `Badge` — rounded-full pill, soft muted bg with colored text |
| `table.tsx` | Custom `Table` — clean, minimal, cream rows with subtle dividers |
| `tabs.tsx` | Custom `Tabs` — pill-style toggle (like "Ongoing/Previous day" in reference) |
| `skeleton.tsx` | Custom `Skeleton` — cream colored pulse animation |
| `textarea.tsx` | Custom `Textarea` — matches Input styling |
| `toggle.tsx` | Custom `Toggle` — rounded toggle button |
| `tooltip.tsx` | Custom `Tooltip` — simple tooltip, forest-green bg, cream text |
| `dropdown-menu.tsx` | Custom `DropdownMenu` — cream dropdown, rounded-xl, subtle shadow |
| `popover.tsx` | Custom `Popover` — cream popover, rounded-xl |
| `calendar.tsx` | Custom `Calendar` — clean date picker matching earthy palette |
| `command.tsx` | Custom `CommandPalette` — search/select component |
| `scroll-area.tsx` | Custom `ScrollArea` — thin olive scrollbar |
| `sheet.tsx` | Custom `Sheet` — slide-in panel, cream bg |
| `sidebar.tsx` | REMOVE — build sidebar from scratch in layout |
| `separator.tsx` | Custom `Separator` — thin muted line |
| `input-group.tsx` | Custom `InputGroup` — input with prefix/suffix |
| `sonner.tsx` | Custom `Toaster` — restyle sonner's toast to match palette |

---

## Design System to Implement

### Color Tokens (CSS Variables in globals.css)

```css
:root {
  /* Backgrounds */
  --bg-sage: #C5CEB5;           /* Page background */
  --bg-cream: #FAF8F2;          /* Cards, surfaces */
  --bg-cream-hover: #F2EDE4;    /* Card hover state */
  --bg-muted: #E2E8D5;          /* Muted backgrounds, dividers area */

  /* Text */
  --text-forest: #1B3A2D;       /* Primary text — dark forest green */
  --text-olive: #5C7A5E;        /* Secondary text — muted olive */
  --text-cream: #FAF8F2;        /* Text on dark/accent backgrounds */

  /* Accents */
  --accent-olive: #C8D84E;      /* Primary accent — buttons, active states */
  --accent-olive-hover: #B5C438; /* Accent hover */
  --accent-coral: #E8A5A0;      /* Secondary accent — destructive, some calendar blocks */
  --accent-gold: #D4D08E;       /* Tertiary accent — calendar blocks, highlights */
  --accent-teal: #2D6B5A;       /* Chart bars, dark accent */

  /* Borders */
  --border-subtle: rgba(27, 58, 45, 0.08);  /* Very subtle borders */
  --border-medium: rgba(27, 58, 45, 0.15);  /* Medium borders */

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(27, 58, 45, 0.06);
  --shadow-dropdown: 0 4px 16px rgba(27, 58, 45, 0.1);

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}
```

### Typography

```css
/* Serif — for headings, page titles, branding */
font-family: 'Lora', Georgia, serif;

/* Sans — for body, data, labels, UI */
font-family: 'Inter', system-ui, sans-serif;
```

| Usage | Font | Size | Weight | Color |
|-------|------|------|--------|-------|
| Page title ("Dashboard", "Calendar") | Lora serif | 28px / text-3xl | 600 (semibold) | --text-forest |
| Section heading ("Recent Entries") | Inter sans | 16px / text-base | 600 | --text-forest |
| Entry description | Inter sans | 15px | 500 | --text-forest |
| Project badge text | Inter sans | 13px | 500 | --text-olive |
| Duration / time | Inter sans | 15px | 600 (tabular-nums) | --text-forest |
| Large stat number ("20:37:16") | Inter sans | 36px / text-4xl | 700 | --text-forest |
| Earnings amount ("$230.80") | Inter sans | 36px / text-4xl | 700 | --accent-olive |
| Small label ("Total Hours") | Inter sans | 13px | 500 | --text-olive |
| Nav item | Inter sans | 14px | 500 | --text-olive (inactive), --text-forest (active) |

### Component Specs

**Button (Primary)**
```
bg: var(--accent-olive)
text: var(--text-forest)
border-radius: var(--radius-full) → fully rounded pill
padding: 10px 24px
font: Inter 14px 600
hover: var(--accent-olive-hover)
transition: all 150ms ease
```

**Button (Icon/Circular — the play button)**
```
bg: var(--accent-olive)
size: 40px x 40px (or 36px for compact)
border-radius: 50%
icon: dark forest green, centered
hover: var(--accent-olive-hover) + slight scale(1.05)
```

**Card**
```
bg: var(--bg-cream)
border-radius: var(--radius-xl) → 24px
box-shadow: var(--shadow-card)
border: 1px solid var(--border-subtle)
padding: 20px (or 16px compact)
```

**Input**
```
bg: var(--bg-cream)
border: 1px solid var(--border-subtle)
border-radius: var(--radius-md) → 12px
padding: 10px 14px
font: Inter 14px
color: var(--text-forest)
placeholder-color: var(--text-olive) at 50% opacity
focus: border-color var(--accent-olive), no ring/outline
```

**Badge/Pill (Project label)**
```
bg: var(--bg-muted) or project-color at 15% opacity
text: var(--text-olive) or project-color darkened
border-radius: var(--radius-full)
padding: 4px 12px
font: Inter 13px 500
```

**Tab Toggle (pill switcher)**
```
Container: bg var(--bg-muted), rounded-full, padding 4px
Active tab: bg var(--accent-olive), text var(--text-forest), rounded-full
Inactive tab: bg transparent, text var(--text-olive)
transition: background 200ms ease
```

**Time Entry Row**
```
Layout: flex, justify-between, items-center
Left side:
  - Description: Inter 15px 500, --text-forest
  - Project badge below: Badge component
Right side:
  - Duration: Inter 15px 600, --text-forest, tabular-nums
  - Play button: circular icon button (36px)
Divider: 1px solid var(--border-subtle), with padding-y 12px
```

**Sidebar (Desktop)**
```
Width: 240px (expanded), 64px (collapsed)
bg: var(--bg-cream)
border-right: 1px solid var(--border-subtle)
Logo: "BogglTrack" in Lora serif, --text-forest
Nav items:
  - Rounded-xl buttons, padding 10px 14px
  - Icon (20px) + label
  - Active: bg var(--accent-olive)/20, text --text-forest, icon --accent-olive
  - Inactive: text --text-olive
  - Hover: bg var(--bg-muted)
Settings at bottom, separated by divider
```

**Mobile Bottom Tab Bar**
```
Fixed bottom, bg var(--bg-cream)
border-top: 1px solid var(--border-subtle)
4 tabs: icon + label (12px)
Active: icon + label colored --accent-olive
Inactive: --text-olive
Safe area padding for iOS
```

**Dialog/Modal**
```
Overlay: rgba(27, 58, 45, 0.3), backdrop-blur(4px)
Modal card: var(--bg-cream), rounded-2xl, shadow-dropdown
Max-width: 480px (or 560px for forms)
Header: Lora serif title + close button
Body: padding 24px
Footer: right-aligned action buttons
Animation: scale from 0.95 + fade in
```

**Select/Dropdown**
```
Trigger: same as Input, with chevron-down icon right
Dropdown: bg var(--bg-cream), rounded-xl, shadow-dropdown
Option: padding 10px 14px, hover bg var(--bg-muted)
Selected: text --text-forest, font-weight 600
border: 1px solid var(--border-subtle)
```

**Chart Styling (Recharts)**
```
Bar chart:
  - Billable bars: var(--accent-teal) → #2D6B5A
  - Non-billable bars: var(--accent-olive) → #C8D84E
  - Bar radius: [4, 4, 0, 0] (rounded top)
  - Grid lines: var(--border-subtle)
  - Axis text: Inter 12px, --text-olive

Donut/Pie chart:
  - Colors cycle: accent-teal, accent-olive, accent-coral, accent-gold, #7BA68A, #A8C97F
  - No stroke between segments (or very thin cream stroke)

Line chart:
  - Line: var(--accent-teal), 2px stroke
  - Dots: var(--accent-teal), 4px radius
  - Area fill: var(--accent-teal) at 10% opacity
  - Grid: var(--border-subtle)
```

---

## Page-by-Page Refactoring Guide

For each page, replace shadcn components with custom ones. Preserve all `useState`, `useEffect`, `useCallback`, fetch calls, and business logic. Only change JSX markup and Tailwind classes.

### Layout (`src/app/layout.tsx`)
- Remove `SidebarProvider`, `SidebarInset` from shadcn
- Build a simple flex layout: `<div class="flex h-screen">` → sidebar + main area
- Sidebar: custom component, not shadcn's `Sidebar`
- Main area: `<div class="flex-1 flex flex-col overflow-hidden">`
  - `GlobalTimerBar` (sticky top)
  - `<main class="flex-1 overflow-y-auto bg-[var(--bg-sage)] p-6">`
  - `MobileTabBar` (fixed bottom, mobile only)

### Sidebar (`src/components/layout/app-sidebar.tsx`)
- Rewrite from scratch — no shadcn Sidebar components
- Simple `<aside>` with `<nav>` inside
- Collapsible with a toggle button (use state, not shadcn)
- Logo at top: "BogglTrack" in Lora serif with a small timer icon (Lucide)
- Nav items: map over routes array, render `<Link>` with active state detection via `usePathname()`
- Settings link pinned to bottom

### Timer Bar (`src/components/layout/global-timer-bar.tsx`)
- Replace shadcn `Button`, `Input`, `Select`, `Badge`, `Popover` with custom equivalents
- Keep all timer logic (zustand store calls, API fetches, state)
- Style the bar as a cream card with rounded-xl, sitting on the sage bg
- Play/stop button: large circular, olive-green / coral
- Timer display: Inter font, tabular-nums, large

### Dashboard (`/page.tsx`)
- Replace `Card` → custom Card component
- Replace summary stat cards styling
- Keep Recharts `AreaChart` but update colors to match palette (teal line, olive area)
- Style "Recent Entries" with custom TimeEntryRow component
- Style "Top Projects" with custom progress bars

### Timer Page (`/timer/page.tsx`)
- Replace `Tabs` → custom pill-style tab toggle
- Replace `Dialog` for manual entry → custom modal
- Time entries: custom `TimeEntryRow` component per the spec
- Day group headers: serif or bold sans, with right-aligned total
- Keep all the fetch/filter/CRUD logic untouched

### Projects (`/projects/page.tsx` + `/projects/[id]/page.tsx`)
- Replace `Card`, `Dialog`, `Input`, `Select`, `Badge` → custom
- Project cards: cream bg, color dot, progress bar
- Project detail: same pattern — keep logic, restyle markup
- Keep Recharts charts, update colors

### Clients (`/clients/page.tsx`)
- Replace `Table`, `Dialog`, `Input` → custom
- Clean table with cream rows and subtle dividers

### Tags (`/tags/page.tsx`)
- Replace `Dialog`, `Input`, `Badge` → custom
- Simple list with color dots

### Reports (`/reports/page.tsx`)
- Replace `Tabs`, `Select`, `Table`, `Badge` → custom
- Tab toggle: pill style
- Filter dropdowns: custom Select
- Keep Recharts charts, update colors
- Keep CSV/PDF export logic

### Settings (`/settings/page.tsx`)
- Replace `Input`, `Select`, `Label`, `Card` → custom
- Clean form layout in centered cream card
- Section headings in Lora serif
- Save button: olive-green pill

---

## File Structure After Refactor

```
src/components/
  ui/
    button.tsx        — Custom pill/icon button
    card.tsx          — Custom cream card
    input.tsx         — Custom text input
    label.tsx         — Custom label
    select.tsx        — Custom dropdown select
    dialog.tsx        — Custom modal dialog
    badge.tsx         — Custom pill badge
    table.tsx         — Custom minimal table
    tabs.tsx          — Custom pill tab toggle
    skeleton.tsx      — Custom loading skeleton
    textarea.tsx      — Custom textarea
    toggle.tsx        — Custom toggle
    tooltip.tsx       — Custom tooltip
    dropdown-menu.tsx — Custom dropdown menu
    separator.tsx     — Custom divider
    scroll-area.tsx   — Custom scrollable container
    toaster.tsx       — Restyled sonner wrapper
    calendar.tsx      — Custom date picker
    popover.tsx       — Custom popover
    time-entry-row.tsx — Reusable entry row component (NEW)
    progress-bar.tsx   — Custom progress bar (NEW)
    color-picker.tsx   — Custom color selector (NEW)
    stat-card.tsx      — Reusable stat display card (NEW)
  layout/
    app-sidebar.tsx   — Custom sidebar (rewritten)
    global-timer-bar.tsx — Restyled timer bar
    mobile-tab-bar.tsx — Restyled bottom nav
```

---

## Final Checklist

After refactoring, verify:
- [ ] No imports from `@base-ui/react` or `shadcn` anywhere
- [ ] No `components.json` file exists
- [ ] All pages render without errors
- [ ] Timer starts/stops/persists correctly (logic unchanged)
- [ ] All CRUD operations work (create/edit/delete projects, clients, tags, entries)
- [ ] Charts render with new color palette
- [ ] Forms submit correctly (settings, new project, new client, etc.)
- [ ] Navigation works (sidebar + mobile tab bar)
- [ ] Responsive: desktop sidebar, mobile bottom tabs
- [ ] Color palette matches reference: sage bg, cream cards, forest text, olive accents
- [ ] Serif headings (Lora) on page titles
- [ ] Rounded-full pills on badges and buttons
- [ ] Play/resume buttons are circular olive-green
- [ ] Toasts still appear on actions (restyle only)
- [ ] No functionality was broken — ONLY visuals changed
