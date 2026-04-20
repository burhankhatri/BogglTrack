import { format } from "date-fns";

// Minimal shape: anything with these fields can be grouped. Matches the
// PreviewEntry shape the invoices page uses, without coupling to it.
export interface GroupableInvoiceEntry {
  id: string;
  description: string;
  startTime: string;
  duration: number | null;
  billable: boolean;
  earnings: number;
  projectId: string | null;
  tags: { tagId: string }[];
}

export interface InvoiceGroupedRow<T extends GroupableInvoiceEntry> {
  mergeKey: string;
  date: string;          // local yyyy-MM-dd, used for same-day bucketing
  entries: T[];          // sorted by startTime ascending
  totalDuration: number; // seconds
  totalEarnings: number; // currency
}

// Strict composite key — identical convention to timer + calendar grouping
// (description + project + billable + sorted tag ids). Prefixed with the
// local date string so entries on different days never collapse together.
function buildDayMergeKey(entry: GroupableInvoiceEntry): string {
  const tagIds = entry.tags.map((t) => t.tagId).sort().join(",");
  const localDate = format(new Date(entry.startTime), "yyyy-MM-dd");
  return [
    localDate,
    entry.description || "",
    entry.projectId ?? "",
    entry.billable ? "1" : "0",
    tagIds,
  ].join("|");
}

export function groupPreviewEntriesByDay<T extends GroupableInvoiceEntry>(
  entries: T[]
): InvoiceGroupedRow<T>[] {
  const map = new Map<string, InvoiceGroupedRow<T>>();

  for (const entry of entries) {
    const mergeKey = buildDayMergeKey(entry);
    const existing = map.get(mergeKey);
    if (existing) {
      existing.entries.push(entry);
      existing.totalDuration += entry.duration ?? 0;
      existing.totalEarnings += entry.earnings;
    } else {
      map.set(mergeKey, {
        mergeKey,
        date: format(new Date(entry.startTime), "yyyy-MM-dd"),
        entries: [entry],
        totalDuration: entry.duration ?? 0,
        totalEarnings: entry.earnings,
      });
    }
  }

  // Sort entries inside each row chronologically so the expanded view
  // reads top-to-bottom in the order the work was performed.
  for (const row of map.values()) {
    row.entries.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
  }

  return Array.from(map.values());
}
