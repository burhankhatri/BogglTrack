import { startOfDay, endOfDay } from "date-fns";

export function getDateRange(date: Date): { from: string; to: string } {
  return {
    from: startOfDay(date).toISOString(),
    to: endOfDay(date).toISOString(),
  };
}

interface EntryWithEndTime {
  endTime: string | null;
}

export function filterCompletedEntries<T extends EntryWithEndTime>(
  entries: T[]
): T[] {
  return entries.filter((e) => e.endTime !== null);
}
