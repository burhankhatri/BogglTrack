"use client";

import "temporal-polyfill/global";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScheduleXCalendar,
  useNextCalendarApp,
} from "@schedule-x/react";
import {
  viewMonthGrid,
  viewWeek,
  viewDay,
  viewMonthAgenda,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "@schedule-x/theme-default/dist/calendar.css";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatCurrency, calculateEarnings, getApplicableRate } from "@/lib/earnings";

interface TimeEntryAPI {
  id: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  project: {
    id: string;
    name: string;
    color: string;
    hourlyRate: number | null;
  } | null;
}

interface CalendarEntry {
  id: string;
  start: string;
  end: string;
  title: string;
  calendarId: string;
  // Raw data we keep around so the detail panel can render without refetching.
  _entry: TimeEntryAPI;
}

const tz = (() => {
  if (typeof Intl === "undefined") return "UTC";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

// Convert a JS ISO string ("2026-05-25T10:00:00.000Z") to the form
// Temporal.ZonedDateTime.from() expects: "2026-05-25T06:00:00-04:00[America/New_York]".
function toZoned(iso: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(tz);
}

// hash → hsl color for projects without a stored color (e.g. when grouped by
// client in the future). Today every project has a color, but this keeps the
// component robust to nulls.
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 45%)`;
}

// Darken a hex/hsl color for the "on container" text. Schedule-X expects
// 3 color slots per calendar; we derive them from the project color.
function deriveCalendarColors(color: string): {
  main: string;
  container: string;
  onContainer: string;
} {
  // For hex inputs, fall back to neutral container colors. The "main" is the
  // strong project color; "container" is a tinted background; "onContainer"
  // is dark text that reads on the container.
  return {
    main: color,
    container: `${color}26`, // 15% alpha
    onContainer: "var(--text-forest)",
  };
}

export function DashboardCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [selected, setSelected] = useState<TimeEntryAPI | null>(null);
  // The view name we boot the calendar with — chosen once based on
  // viewport. Re-mounting on resize is intentional: Schedule-X reads the
  // default view at create time. The user can switch views inside the
  // calendar's own toolbar.
  const [bootView] = useState<string>(() => {
    if (typeof window === "undefined") return viewMonthGrid.name;
    return window.matchMedia("(max-width: 640px)").matches
      ? viewMonthAgenda.name
      : viewMonthGrid.name;
  });

  const eventsService = useRef(createEventsServicePlugin());

  const load = useMemo(
    () => async () => {
      // ±60 days around today — covers the typical browse range without
      // pulling thousands of entries.
      const from = new Date();
      from.setDate(from.getDate() - 60);
      const to = new Date();
      to.setDate(to.getDate() + 30);
      const r = await fetch(
        `/api/time-entries?from=${from.toISOString()}&to=${to.toISOString()}&limit=500`
      );
      if (!r.ok) {
        setEntries([]);
        return;
      }
      const raw = (await r.json()) as TimeEntryAPI[];
      const mapped: CalendarEntry[] = raw
        .filter((e) => e.endTime !== null)
        .map((e) => ({
          id: e.id,
          start: e.startTime,
          end: e.endTime!,
          title: (e.description?.trim() || e.project?.name || "Untitled"),
          calendarId: e.project?.id ?? "no-project",
          _entry: e,
        }));
      setEntries(mapped);
    },
    []
  );

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("timer-entry-confirmed", refresh);
    window.addEventListener("timer-entry-completed", refresh);
    return () => {
      window.removeEventListener("timer-entry-confirmed", refresh);
      window.removeEventListener("timer-entry-completed", refresh);
    };
  }, [load]);

  // Build the per-project `calendars` config. We need this even when entries
  // is still null so the calendar can mount; we'll populate it once data
  // arrives. Schedule-X looks up calendarId on each event into this record
  // to color it.
  const calendars = useMemo(() => {
    const map: Record<string, { colorName: string; lightColors: { main: string; container: string; onContainer: string } }> = {
      "no-project": {
        colorName: "no-project",
        lightColors: deriveCalendarColors("#9aa39a"),
      },
    };
    for (const e of entries ?? []) {
      const proj = e._entry.project;
      if (!proj) continue;
      if (map[proj.id]) continue;
      map[proj.id] = {
        colorName: proj.id,
        lightColors: deriveCalendarColors(proj.color || colorFor(proj.id)),
      };
    }
    return map;
  }, [entries]);

  const calendarApp = useNextCalendarApp(
    {
      views: [viewMonthGrid, viewWeek, viewDay, viewMonthAgenda],
      defaultView: bootView,
      firstDayOfWeek: 1,
      events: [],
      calendars,
      callbacks: {
        onEventClick: (event) => {
          const raw = (event as unknown as { _entry?: TimeEntryAPI })._entry;
          if (raw) setSelected(raw);
        },
      },
    },
    [eventsService.current]
  );

  // Push entries into the events service whenever they change. Calling .set()
  // is the canonical way to replace the visible event list without rebuilding
  // the calendar instance.
  useEffect(() => {
    if (!calendarApp || !entries) return;
    const events = entries.map((e) => ({
      id: e.id,
      title: e.title,
      start: toZoned(e.start),
      end: toZoned(e.end),
      calendarId: e.calendarId,
      _entry: e._entry,
    }));
    eventsService.current.set(events);
  }, [calendarApp, entries]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
            Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries === null ? (
            <Skeleton className="h-[560px] w-full rounded-lg" />
          ) : entries.length === 0 ? (
            <p className="text-[13px] text-[var(--text-olive)] py-8 text-center">
              No tracked time in this window yet. Start a timer or convert
              untracked commits to see entries here.
            </p>
          ) : (
            <div className="sx-react-calendar-wrapper h-[560px] sm:h-[640px]">
              <ScheduleXCalendar calendarApp={calendarApp} />
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <EntryDetailDialog
          entry={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function EntryDetailDialog({
  entry,
  onClose,
}: {
  entry: TimeEntryAPI;
  onClose: () => void;
}) {
  const duration = entry.duration ?? 0;
  const rate = getApplicableRate(entry.project?.hourlyRate ?? null, 0);
  const earnings = calculateEarnings(duration, rate, entry.billable);
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-cream)] rounded-[var(--radius-lg)] shadow-[var(--shadow-dropdown)] p-5 w-full max-w-[420px] space-y-3 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text-forest)] break-words">
              {entry.description?.trim() || entry.project?.name || "Untitled"}
            </p>
            {entry.project && (
              <p className="mt-1 text-[12px] text-[var(--text-olive)] flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.project.color }}
                />
                {entry.project.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12px] pt-1">
          <div>
            <p className="text-[var(--text-olive)] uppercase tracking-wide text-[10px] font-medium">Duration</p>
            <p className="font-mono text-[13px] text-[var(--text-forest)] tabular-nums mt-0.5">
              {formatDuration(duration)}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-olive)] uppercase tracking-wide text-[10px] font-medium">Earnings</p>
            <p className="font-mono text-[13px] text-[var(--text-forest)] tabular-nums mt-0.5">
              {entry.billable ? formatCurrency(earnings) : "Non-billable"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
