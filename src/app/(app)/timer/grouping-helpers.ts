// Pure functions that group a day's time entries into display rows.
// Extracted from timer/page.tsx so the merge rules can be unit-tested
// in isolation.

interface Project {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
  client?: { id: string; name: string } | null;
}

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
}

export interface GroupableTimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: Project | null;
  commits?: AttachedCommit[] | null;
}

export interface GroupedEntry {
  key: string;
  mergeKey: string;
  description: string;
  entries: GroupableTimeEntry[];
  totalDuration: number;
  billable: boolean;
  projectId: string | null;
  project: Project | null;
  startTime: string;
  endTime: string | null;
}

// Strict merge key: two entries only merge when they represent the *same
// work* — same description, same project, same billable state. Client is
// derived from project (one-to-many), so projectId covers client too.
// Null projectId is stable as an empty string so two no-project entries
// with the same description still merge together.
function buildMergeKey(entry: GroupableTimeEntry): string {
  return [
    entry.description || "",
    entry.projectId ?? "",
    entry.billable ? "1" : "0",
  ].join("|");
}

// Given a merged group and the id of the entry the user is currently
// editing/deleting, return that underlying entry. Falls back to the first
// entry in the group (used as the "representative" when the header
// Edit/Delete buttons fire) if no id is provided or the id does not match.
// Keeping this as a pure helper makes it trivially unit-testable and
// prevents regressions where handlers target the wrong entry.
export function resolveActiveEntry<T extends GroupableTimeEntry>(
  group: { entries: T[] },
  activeId: string | null
): T {
  if (activeId) {
    const match = group.entries.find((e) => e.id === activeId);
    if (match) return match;
  }
  return group.entries[0];
}

export function groupEntriesByDesc<T extends GroupableTimeEntry>(
  dayEntries: T[]
): GroupedEntry[] {
  const map = new Map<string, GroupedEntry>();
  for (const entry of dayEntries) {
    const key = buildMergeKey(entry);
    const existing = map.get(key);
    if (existing) {
      existing.entries.push(entry);
      existing.totalDuration += entry.duration ?? 0;
      if (entry.startTime < existing.startTime) existing.startTime = entry.startTime;
      if (entry.endTime && (!existing.endTime || entry.endTime > existing.endTime))
        existing.endTime = entry.endTime;
    } else {
      map.set(key, {
        key: entry.id,
        mergeKey: key,
        description: entry.description,
        entries: [entry],
        totalDuration: entry.duration ?? 0,
        billable: entry.billable,
        projectId: entry.projectId,
        project: entry.project,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
    }
  }
  return Array.from(map.values());
}
