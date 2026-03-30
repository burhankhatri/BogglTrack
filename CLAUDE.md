@AGENTS.md
# Proactive Engine v2: Autonomous Brain with Calendar/Gmail Intelligence

## Context
The current proactive engine sends **one daily nudge** at the user's preferred hour, treating all signals (browser, email, calendar) as flat weighted text. Calendar events like "Astera conference tomorrow" get the same treatment as a random domain visit. The user wants the proactive engine to be **its own autonomous system** — detecting upcoming events, sending timely nudges (e.g., "your Astera event is tomorrow, here's what you should know"), and having its own scheduling logic independent of the single daily cron.

**Goal**: Transform the proactive engine from a daily digest sender into an event-aware autonomous agent with multiple nudge types, smart timing, and its own cron infrastructure.

---

## Phase 1: Schema & Types

### 1.1 New table: `proactive_event_queue`
File: [db.ts](backend/lib/assumptions/db.ts) — add in `ensureAssumptionsTables()`

```sql
CREATE TABLE IF NOT EXISTS proactive_event_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,        -- 'calendar' | 'email'
  source_id TEXT NOT NULL,          -- cal_{id} or email_{id}
  event_title TEXT NOT NULL,
  event_start TIMESTAMPTZ,          -- NULL for emails without time anchor
  event_end TIMESTAMPTZ,
  event_metadata JSONB NOT NULL DEFAULT '{}',
  nudge_category TEXT NOT NULL,     -- event_prep | event_reminder | email_followup | travel_prep | meeting_prep
  earliest_nudge_at TIMESTAMPTZ NOT NULL,
  latest_nudge_at TIMESTAMPTZ NOT NULL,
  nudge_status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | skipped | expired
  nudge_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_event_queue_pending
  ON proactive_event_queue (nudge_status, earliest_nudge_at) WHERE nudge_status = 'pending';
```

### 1.2 New table: `proactive_throttle_log`
```sql
CREATE TABLE IF NOT EXISTS proactive_throttle_log (
  user_id TEXT NOT NULL,
  local_date DATE NOT NULL,
  nudge_count INTEGER NOT NULL DEFAULT 0,
  last_nudge_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, local_date)
);
```

### 1.3 Modify `proactive_nudges` — allow multiple per day
- **Drop** `UNIQUE (user_id, local_date)` constraint
- **Add** column `nudge_category TEXT NOT NULL DEFAULT 'daily_discovery'`
- **Add** column `event_queue_id BIGINT` (FK to event_queue)
- **Add** unique index on `(user_id, signal_key)` WHERE signal_key IS NOT NULL (prevents duplicate nudges for same event)

### 1.4 Add columns to `proactive_preferences`
- `max_daily_nudges INTEGER NOT NULL DEFAULT 4`
- `quiet_start_hour INTEGER NOT NULL DEFAULT 22`
- `quiet_end_hour INTEGER NOT NULL DEFAULT 7`

### 1.5 Add `metadata JSONB` column to `proactive_history_signals`
Stores structured data (event start/end times, location, attendees) alongside the flat signal text.

### 1.6 New types in [types.ts](backend/lib/assumptions/types.ts)
```ts
export type NudgeCategory =
  | "event_prep" | "event_reminder" | "email_followup"
  | "travel_prep" | "meeting_prep" | "daily_discovery";

export interface EventQueueItem { ... }
export interface NudgeDecision {
  type: NudgeCategory;
  eventQueueId: number | null;
  sourceId: string | null;
  eventTitle: string | null;
  eventMetadata: Record<string, unknown>;
  priority: number;  // 1=highest
}
```

Widen `ProactiveDeliveryLog.messageKind` from `"daily_nudge"` to `NudgeCategory`.
Add optional `metadata` field to `ProactiveSignalInput`.

---

## Phase 2: Event Scanner Cron (new)

### 2.1 New file: [event-classifier.ts](backend/lib/assumptions/event-classifier.ts)
Functions:
- `classifyCalendarEvent(signal)` → returns NudgeCategory based on title patterns and timing
- `classifyEmailSignal(signal)` → returns NudgeCategory | null (null = not actionable)
- `computeNudgeWindow(signal, category, timezone)` → `{ earliest, latest }`

Timing logic:
| Category | Window |
|----------|--------|
| `event_reminder` | event_start - 2h → event_start - 15min |
| `event_prep` | event_start - 18h → event_start - 3h |
| `travel_prep` | now → now + 12h |
| `meeting_prep` | event_start - 18h → event_start - 2h |
| `email_followup` | now → now + 12h |

### 2.2 New cron: [/api/cron/proactive-event-scan/route.ts](backend/app/api/cron/proactive-event-scan/route.ts)
Schedule: `*/30 * * * *` (every 30 min) — add to [vercel.json](backend/vercel.json)

Logic:
1. Query `proactive_history_signals` for `calendar_event` signals with `observed_at` (event start) in next 24h, not yet in event_queue
2. Query `email_event` signals from last 24h with weight >= 3 (high-signal), not yet queued
3. Classify each → compute nudge window → INSERT into `proactive_event_queue` ON CONFLICT DO NOTHING
4. Expire stale items: UPDATE status='expired' WHERE latest_nudge_at < NOW()
5. Auth: same CRON_SECRET bearer token pattern

---

## Phase 3: Proactive Brain

### 3.1 New file: [proactive-brain.ts](backend/lib/assumptions/proactive-brain.ts)
The decision engine. Functions:

**`evaluateNudgeOpportunities(userId, timezone, preferences)`** → `NudgeDecision[]`
1. Query pending event_queue items where NOW() is in their nudge window
2. Check throttle: `proactive_throttle_log` count vs `max_daily_nudges`
3. Check quiet hours (exception: event_reminder can fire during quiet hours)
4. Check min 2h gap since last nudge
5. Return prioritized decisions:
   - Priority 1: `event_reminder` (event in < 3h)
   - Priority 2: `travel_prep`
   - Priority 3: `meeting_prep`
   - Priority 4: `event_prep` (event in 3-24h)
   - Priority 5: `email_followup`

**`recordNudgeSent(userId, localDate)`** — increment throttle counter

**`shouldSendDailyDiscovery(hour, sendHourLocal, userId, localDate)`** — true if hour matches AND no daily_discovery sent today AND under throttle limit

### 3.2 New file: [proactive-prompts.ts](backend/lib/assumptions/proactive-prompts.ts)
Extract prompt logic from [proactive.ts](backend/lib/assumptions/proactive.ts) and add category-specific prompts:

**`getSystemPrompt(category, eventContext)`** — returns category-specific system prompt:
- `event_prep`: "User has {title} coming up at {time}. Research the topic/company/person. Share 2-3 useful things they should know. End with a question."
- `event_reminder`: "User's event {title} starts in {timeUntil}. Quick heads-up — key thing to know, what to bring, or relevant context."
- `travel_prep`: "User has travel based on: {subject}. Practical tips — weather, local recs, things to know."
- `meeting_prep`: "User has a meeting about {title}. Research and share 2-3 prep points."
- `email_followup`: "User received: {subject}. Find something useful related to it."
- `daily_discovery`: (existing prompt, unchanged)

**`buildContextualUserPrompt(context, decision)`** — adds a `CURRENT FOCUS` section at the top of the existing user prompt with the specific event/email details.

---

## Phase 4: Modify Existing Cron

### 4.1 Refactor [proactive-telegram/route.ts](backend/app/api/cron/proactive-telegram/route.ts)
Replace the single `daily_nudge` flow with brain-driven logic:

```
for each user:
  // 1. Get event-driven opportunities (any hour)
  decisions = await evaluateNudgeOpportunities(...)

  // 2. Check daily discovery (only at preferred hour)
  if (shouldSendDailyDiscovery(...))
    decisions.push({ type: 'daily_discovery', priority: 6 })

  // 3. Process top decision
  for (decision of decisions.slice(0, 1)):  // max 1 per cron run
    context = await buildProactiveContext(...)
    prompt = getSystemPrompt(decision.type, decision)
    userPrompt = buildContextualUserPrompt(context, decision)
    result = await generateProactiveNudge(context, decision)
    if result.shouldSend:
      send via Telegram
      record in proactive_nudges (with nudge_category)
      record in throttle_log
      if event_queue_id: mark event_queue item as sent
```

### 4.2 Modify [proactive.ts](backend/lib/assumptions/proactive.ts)
- `generateProactiveNudge(context, decision?)` — accept optional NudgeDecision, use category-specific prompt when provided
- Keep existing `buildNudgeSystemPrompt()` and `buildNudgeUserPrompt()` as `daily_discovery` defaults
- Export them for use in `proactive-prompts.ts`

### 4.3 Modify [db.ts](backend/lib/assumptions/db.ts)
New functions:
- `insertEventQueueItem(params)` — ON CONFLICT DO NOTHING
- `getPendingEventQueueItems(userId)` — pending items in current nudge window
- `markEventQueueSent(id)` / `markEventQueueExpired(ids)`
- `getOrIncrementThrottle(userId, localDate)` — upsert + return count
- Modify `createDailyProactiveNudge` to accept `nudge_category` and `event_queue_id`, change ON CONFLICT to use new unique index

---

## Phase 5: Extension Changes

### 5.1 Enrich signals with metadata — [background.js](extension/background.js)

**`fetchCalendarSignals()`** — add `metadata` field:
```js
metadata: {
  startTime: e.start.dateTime || e.start.date,
  endTime: e.end?.dateTime || e.end?.date || null,
  location: e.location || null,
  attendees: (e.attendees || []).slice(0, 5).map(a => a.displayName || a.email),
  isAllDay: !e.start.dateTime,
}
```

**`fetchGmailSignals()`** — add `metadata` field:
```js
metadata: { from, subject, labels, isHighSignal: bool }
```

### 5.2 Increase sync frequency
Change `PROACTIVE_SYNC_INTERVAL_MINUTES` from `360` (6h) to `120` (2h) so calendar events are picked up faster.

### 5.3 Modify [sync-signals/route.ts](backend/app/api/assumptions/proactive/sync-signals/route.ts)
Accept and pass through `metadata` field to DB ingestion.

---

## Phase 6: Vercel Config

### [vercel.json](backend/vercel.json)
```json
"crons": [
  { "path": "/api/cron/proactive-telegram", "schedule": "0 * * * *" },
  { "path": "/api/cron/proactive-event-scan", "schedule": "*/30 * * * *" }
]
```

---

## Implementation Order

1. **types.ts** — add NudgeCategory, EventQueueItem, NudgeDecision, widen messageKind, add metadata to ProactiveSignalInput
2. **db.ts** — new tables (event_queue, throttle_log), alter proactive_nudges + preferences + signals, new DB functions
3. **event-classifier.ts** — new file, classification + window logic
4. **proactive-event-scan/route.ts** — new cron
5. **proactive-prompts.ts** — new file, extract + add category prompts
6. **proactive-brain.ts** — new file, decision engine
7. **proactive.ts** — modify generateProactiveNudge to accept decision
8. **proactive-telegram/route.ts** — refactor to use brain
9. **background.js** — add metadata, increase sync frequency
10. **sync-signals/route.ts** — pass through metadata
11. **vercel.json** — add event-scan cron

---

## Verification

1. **Unit test event-classifier**: calendar event "Astera Conference" tomorrow → `event_prep` with window 18h before to 3h before
2. **Unit test proactive-brain**: mock event_queue with items, verify priority ordering and throttle enforcement
3. **Integration test**: seed signals with a calendar event 4h from now → run event-scan cron → verify event_queue populated → run telegram cron → verify nudge generated with event-prep prompt
4. **Manual test**: connect calendar with a real upcoming event → wait for sync → trigger event-scan → trigger telegram cron → verify Telegram message references the event with researched context
5. **Throttle test**: send 4 nudges → verify 5th is blocked
6. **Quiet hours test**: verify no nudges during 22:00-07:00 (except event_reminder)

---

## Key Files to Modify
- [backend/lib/assumptions/types.ts](backend/lib/assumptions/types.ts)
- [backend/lib/assumptions/db.ts](backend/lib/assumptions/db.ts)
- [backend/lib/assumptions/proactive.ts](backend/lib/assumptions/proactive.ts)
- [backend/app/api/cron/proactive-telegram/route.ts](backend/app/api/cron/proactive-telegram/route.ts)
- [backend/app/api/assumptions/proactive/sync-signals/route.ts](backend/app/api/assumptions/proactive/sync-signals/route.ts)
- [extension/background.js](extension/background.js)
- [backend/vercel.json](backend/vercel.json)

## New Files
- `backend/lib/assumptions/event-classifier.ts`
- `backend/lib/assumptions/proactive-brain.ts`
- `backend/lib/assumptions/proactive-prompts.ts`
- `backend/app/api/cron/proactive-event-scan/route.ts`