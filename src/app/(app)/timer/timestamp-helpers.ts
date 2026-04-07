import { format } from "date-fns";

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
