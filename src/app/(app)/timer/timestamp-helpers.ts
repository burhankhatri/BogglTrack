import { addDays, format } from "date-fns";

export function parseEntryTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: format(d, "yyyy-MM-dd"),
    time: format(d, "HH:mm"),
  };
}

export function buildTimestampISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export type ResolvedTimeRange =
  | { ok: true; startISO: string; endISO: string; crossesMidnight: boolean }
  | { ok: false; error: string };

// Single point of truth for turning a date + start + end HH:mm into ISO
// timestamps. If the end HH:mm is lexically less than the start HH:mm, the
// end is treated as the next calendar day (e.g. 23:00 -> 00:30) so timers
// and manual entries spanning midnight save correctly.
export function resolveTimeRange(
  date: string,
  startTime: string,
  endTime: string
): ResolvedTimeRange {
  if (endTime === startTime) {
    return { ok: false, error: "End time must be after start time" };
  }

  const crossesMidnight = endTime < startTime;
  const endDate = crossesMidnight
    ? format(addDays(new Date(`${date}T00:00:00`), 1), "yyyy-MM-dd")
    : date;

  const startISO = new Date(`${date}T${startTime}:00`).toISOString();
  const endISO = new Date(`${endDate}T${endTime}:00`).toISOString();

  return { ok: true, startISO, endISO, crossesMidnight };
}

export type ExplicitRangeResult =
  | { ok: true; startISO: string; endISO: string }
  | { ok: false; error: string };

// Turns an explicit (startDate, startTime, endDate, endTime) quadruple into
// ISO timestamps. Unlike resolveTimeRange, the end date is picked by the
// user directly, so there is no midnight-rollover guess — we just verify
// that end strictly follows start.
export function buildExplicitRange(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): ExplicitRangeResult {
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(`${endDate}T${endTime}:00`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date or time" };
  }

  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: "End must be after start" };
  }

  return {
    ok: true,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}
