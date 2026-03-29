# BogglTrack - Product Specification

## Overview
BogglTrack is a time tracking and earnings management app for freelancers, contractors, and small teams. It lets users track hours across projects, assign hourly rates, and see exactly how much money they've earned — in real time.

Inspired by [Toggl Track](https://track.toggl.com/), but focused on simplicity and earnings visibility.

---

## 1. Core Features

### 1.1 Time Tracking

#### One-Click Timer
- Large, prominent **Start/Stop button** in the header area (always visible)
- Timer displays elapsed time in `HH:MM:SS` format, updating every second
- User can type a **description** before or during tracking
- Assign a **project**, **client**, and **tags** to the running entry
- Mark entry as **billable** or **non-billable** (toggle switch)
- **Resume** — click on any past entry to start a new timer with the same details
- Timer state persists across page refreshes (saved to DB/localStorage)

#### Manual Time Entry
- Switch between **Timer mode** and **Manual mode** via toggle
- In manual mode, user picks **start time**, **end time**, and **date**
- Same fields: description, project, client, tags, billable toggle
- Inline duration calculator shows total hours as user picks times

#### Time Entry List (Main View)
- Entries grouped by **day** with daily total hours and daily earnings
- Each entry row shows: description | project (color dot) | duration | earnings ($)
- Inline editing — click any field to edit directly
- Bulk actions: select multiple entries → delete, change project, toggle billable
- Running weekly total and earnings displayed at the top

---

### 1.2 Projects

#### Project Management
- Create projects with: **name**, **color** (color picker), **client** (optional), **hourly rate** (optional, overrides default)
- **Project-level hourly rate** — if set, overrides the user's default rate for entries in this project
- **Budget/estimate** — set an estimated number of hours for the project; show progress bar (tracked hours / estimate)
- **Status**: Active or Archived (archived projects hidden from dropdowns but data preserved)
- Project list view with: name, client, total hours tracked, total earnings, budget progress

#### Project Dashboard
- Per-project detail page showing:
  - Total hours tracked
  - Total earnings (hours × rate)
  - Budget progress bar (if estimate set)
  - Time entries for this project (filterable by date range)
  - Weekly breakdown chart (bar chart)

---

### 1.3 Clients

- Create clients with: **name**, **email** (optional), **notes** (optional)
- Assign clients to one or more projects
- Client summary view: total hours across all projects, total earnings
- Filter time entries and reports by client

---

### 1.4 Tags

- Create reusable tags (e.g., "design", "meeting", "development", "admin")
- Assign multiple tags per time entry
- Filter entries and reports by tags
- Color-coded tag chips

---

### 1.5 Hourly Rates & Earnings

This is BogglTrack's key differentiator — **earnings are front and center**.

#### Rate Hierarchy (highest priority wins)
1. **Project-specific rate** — set on the project, applies to all entries in that project
2. **Default hourly rate** — user's global fallback rate (set in Settings)

#### Earnings Calculation
- `earnings = duration_hours × applicable_rate`
- Only **billable** entries contribute to earnings
- Non-billable entries show `$0.00` in the earnings column

#### Earnings Display (Everywhere)
- **Timer bar**: shows live earnings ticking up as timer runs (e.g., "$12.50 and counting")
- **Daily groups**: each day shows total earnings for that day
- **Weekly summary**: top of the main view shows "This week: 32.5 hrs — $1,625.00"
- **Project cards**: each project shows total earned
- **Dashboard**: big number showing total earnings for selected period

---

### 1.6 Dashboard / Home

- **Today's summary**: hours tracked, earnings, number of entries
- **This week summary**: total hours, total earnings, bar chart by day
- **This month summary**: total hours, total earnings
- **Top projects**: ranked by hours or earnings (toggle)
- **Recent entries**: last 5 time entries with quick-resume buttons
- **Earnings trend**: line chart showing daily/weekly earnings over time

---

### 1.7 Reports

#### Report Types
- **Summary Report**: grouped by project, client, or tag — shows hours + earnings per group
- **Detailed Report**: line-by-line list of all entries with all fields
- **Weekly Report**: 7-day grid showing hours per project per day

#### Filters
- Date range picker (presets: today, this week, this month, last month, custom)
- Filter by: project, client, tag, billable status
- All filters combinable

#### Visualizations
- **Bar chart**: hours/earnings by project or by day
- **Pie/donut chart**: time distribution across projects
- **Line chart**: earnings trend over time

#### Export
- Export to **CSV** and **PDF**

---

### 1.8 Settings

- **Default hourly rate** — global rate used when project has no specific rate
- **Currency** — select currency symbol ($, €, £, etc.)
- **Date format** — MM/DD/YYYY or DD/MM/YYYY
- **Time format** — 12h or 24h
- **Week start day** — Sunday or Monday
- **Theme** — Light / Dark mode
- **Profile** — name, email, avatar

---

## 2. Data Model

### User
- id, name, email, avatar_url, default_hourly_rate, currency, preferences (JSON)

### Client
- id, name, email, notes, created_at

### Project
- id, name, color (hex), client_id (FK, nullable), hourly_rate (nullable), estimated_hours (nullable), status (active/archived), created_at

### Tag
- id, name, color (hex)

### TimeEntry
- id, description, start_time (datetime), end_time (datetime, nullable if running), duration (seconds, computed), project_id (FK, nullable), billable (boolean, default true), created_at, updated_at

### TimeEntryTag (join table)
- time_entry_id, tag_id

---

## 3. UI/UX Guidelines

### Layout
- **Sidebar navigation** (collapsible): Timer, Dashboard, Projects, Clients, Tags, Reports, Settings
- **Header bar**: always-visible timer with start/stop, current entry description, live earnings
- **Main content area**: context-dependent based on selected nav item

### Visual Style
- Clean, modern, minimal — similar to Toggl's purple/white aesthetic but with a unique color palette
- Color palette: Deep indigo primary (#4F46E5), warm accent, neutral grays
- Rounded corners, subtle shadows, smooth transitions
- Color-coded project dots throughout the UI for quick identification

### Responsiveness
- Fully responsive: desktop, tablet, mobile
- On mobile: bottom tab navigation, full-screen timer

---

## 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui components |
| Database | SQLite via Prisma ORM |
| Charts | Recharts |
| State | React Context + hooks (or Zustand for timer state) |
| Auth | NextAuth.js (optional, can start without) |
| Export | jsPDF + csv export utility |

---

## 5. Pages / Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard / Home |
| `/timer` | Full timer view with entry list (main working view) |
| `/projects` | Project list + create/edit |
| `/projects/[id]` | Project detail with entries and stats |
| `/clients` | Client list + create/edit |
| `/tags` | Tag management |
| `/reports` | Reports with filters and charts |
| `/settings` | User preferences and rate config |

---

## 6. Non-Goals (v1)

- Team/multi-user features
- Invoicing / payment processing
- Native mobile app (responsive web is sufficient)
- Third-party integrations (Slack, Jira, etc.)
- GPS / location tracking
- Shift scheduling
