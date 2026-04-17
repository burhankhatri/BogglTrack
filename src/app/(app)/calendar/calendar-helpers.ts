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

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
}

interface GroupableEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: { id: string; name: string; color: string; hourlyRate: number | null; client: { id: string; name: string } | null } | null;
  tags: { tagId: string; tag: { id: string; name: string; color: string } }[];
  commits?: AttachedCommit[] | null;
}

export interface GroupedEntry {
  key: string;
  description: string;
  startTime: string;
  endTime: string | null;
  totalDuration: number;
  entryCount: number;
  billable: boolean;
  projectId: string | null;
  project: GroupableEntry["project"];
  tags: GroupableEntry["tags"];
  entryIds: string[];
  commits: AttachedCommit[];
}

export function groupEntriesByDescription(entries: GroupableEntry[]): GroupedEntry[] {
  const groups = new Map<string, GroupedEntry>();

  for (const entry of entries) {
    const key = entry.description;
    const existing = groups.get(key);

    if (existing) {
      existing.totalDuration += entry.duration ?? 0;
      existing.entryCount += 1;
      existing.entryIds.push(entry.id);
      // Use earliest startTime
      if (entry.startTime < existing.startTime) {
        existing.startTime = entry.startTime;
      }
      // Use latest endTime
      if (entry.endTime && (!existing.endTime || entry.endTime > existing.endTime)) {
        existing.endTime = entry.endTime;
      }
      if (Array.isArray(entry.commits)) {
        const seen = new Set(existing.commits.map((c) => c.sha));
        for (const c of entry.commits) {
          if (!seen.has(c.sha)) {
            existing.commits.push(c);
            seen.add(c.sha);
          }
        }
      }
    } else {
      groups.set(key, {
        key: entry.id,
        description: entry.description,
        startTime: entry.startTime,
        endTime: entry.endTime,
        totalDuration: entry.duration ?? 0,
        entryCount: 1,
        billable: entry.billable,
        projectId: entry.projectId,
        project: entry.project,
        tags: entry.tags,
        entryIds: [entry.id],
        commits: Array.isArray(entry.commits) ? [...entry.commits] : [],
      });
    }
  }

  return Array.from(groups.values());
}
