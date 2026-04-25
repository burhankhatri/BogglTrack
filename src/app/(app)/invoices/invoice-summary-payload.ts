import type { InvoiceCommit } from "./page";

export interface InvoiceSummaryPayloadEntry {
  id: string;
  description: string;
  startTime: string;
  duration: number | null;
  commits?: InvoiceCommit[] | null;
  project: {
    name: string;
  } | null;
}

export function selectedEntriesHaveCommits(
  entries: InvoiceSummaryPayloadEntry[]
): boolean {
  return entries.some((entry) => (entry.commits?.length ?? 0) > 0);
}

export function buildInvoiceSummaryEntries(
  entries: InvoiceSummaryPayloadEntry[]
) {
  return entries.map((entry) => ({
    id: entry.id,
    description: entry.description,
    projectName: entry.project?.name ?? null,
    startTime: entry.startTime,
    durationSeconds: entry.duration,
    commits: (entry.commits ?? []).map((commit) => ({
      sha: commit.sha,
      message: commit.message,
      repo: commit.repo,
      url: commit.url,
      committedAt: commit.committedAt,
    })),
  }));
}
