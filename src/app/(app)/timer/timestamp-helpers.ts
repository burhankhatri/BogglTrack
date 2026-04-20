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

export function validateTimeRange(
  date: string,
  startTime: string,
  endTime: string
): string | null {
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (end <= start) {
    return "End time must be after start time";
  }

  return null;
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
