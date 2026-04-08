# Reports Page UI Redesign

**Goal:** Redesign the reports page from single-column to a two-panel layout with insights sidebar, more contrasty colors, and cleaner filter bar — inspired by Productive.io's timesheets view.

**Scope:** UI/layout only. No new features, no new API endpoints.

---

## Color Changes (Global)

Update CSS variables in `globals.css` for higher contrast:

| Token | Current | New | Reason |
|-------|---------|-----|--------|
| `--bg-sage` | `#C5CEB5` | `#E8ECE3` | Lighter page bg for more card contrast |
| `--bg-cream` | `#FAF8F2` | `#FFFFFF` | Pure white cards pop against bg |
| `--bg-cream-hover` | `#F2EDE4` | `#F5F5F0` | Slightly warmer hover |
| `--bg-muted` | `#E2E8D5` | `#EAEDE4` | Slightly lighter muted |
| `--text-forest` | `#1B3A2D` | `#1A1A2E` | Near-black, more neutral |
| `--text-olive` | `#5C7A5E` | `#6B7280` | Neutral gray secondary text |
| `--accent-teal` | `#2D6B5A` | `#16A34A` | Brighter green for charts/accents |
| `--border-subtle` | `rgba(27,58,45,0.08)` | `rgba(0,0,0,0.08)` | Neutral border |
| `--border-medium` | `rgba(27,58,45,0.15)` | `rgba(0,0,0,0.15)` | Neutral border |
| `--shadow-card` | `...0.06` | `0 1px 3px rgba(0,0,0,0.08)` | Slightly stronger shadow |

Keep unchanged: `--accent-olive`, `--accent-coral`, `--accent-gold`, `--text-cream`, fonts.

## Layout

Desktop (>=1024px):
```
┌─────────────────────────────────────────────────────────┐
│  "Reports"  📅 All Time              [CSV] [PDF]        │
├───────────────────────────────────┬─────────────────────┤
│  Filter chips (inline)            │  Insights           │
│                                   │                     │
│  Tabs: Summary | Detailed | Weekly│  Total Hours        │
│                                   │  ██ 130:30          │
│  [tab content]                    │                     │
│                                   │  Earnings           │
│                                   │  $2,450.00          │
│                                   │                     │
│                                   │  Projects           │
│                                   │  Project A ███ 4:30 │
│                                   │  Project B ██  2:30 │
└───────────────────────────────────┴─────────────────────┘
```

Mobile (<1024px): Sidebar below main content, full width.

## Insights Sidebar

- Sticky (`sticky top-8`)
- Width: `w-80` on desktop
- Shows data from `summaryData` (always fetched alongside active tab)
- Sections:
  1. **Total hours** — large text (text-3xl font-bold)
  2. **Total earnings** — below hours, accent color
  3. **Project breakdown** — each project with color dot, name, ProgressBar, hours

## Filter Bar Changes

- Remove the Card wrapper — use a simple flex row
- Remove explicit labels — use placeholder text in selects
- Remove "Apply" button — already auto-fetches on change
- Pill-style chips with rounded-full borders

## Files Changed

1. `src/app/globals.css` — color variable updates
2. `src/app/(app)/reports/page.tsx` — layout + InsightsPanel + filter bar
