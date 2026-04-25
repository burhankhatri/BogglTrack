import { describe, expect, it } from "vitest";
import {
  buildInvoiceSummaryEntries,
  selectedEntriesHaveCommits,
  type InvoiceSummaryPayloadEntry,
} from "../invoice-summary-payload";

function makeEntry(
  overrides: Partial<InvoiceSummaryPayloadEntry> = {}
): InvoiceSummaryPayloadEntry {
  return {
    id: "entry-1",
    description: "Build invoice generation",
    startTime: "2026-04-25T10:00:00.000Z",
    duration: 3600,
    commits: [
      {
        sha: "abc123456789",
        message: "Add invoice summary",
        repo: "burhankhatri/BogglTrack",
        url: "https://github.com/burhankhatri/BogglTrack/commit/abc1234",
        committedAt: "2026-04-25T10:30:00.000Z",
      },
    ],
    project: {
      name: "BogglTrack",
    },
    ...overrides,
  };
}

describe("selectedEntriesHaveCommits", () => {
  it("returns true when any selected entry has commits", () => {
    expect(selectedEntriesHaveCommits([makeEntry()])).toBe(true);
  });

  it("returns false when selected entries have no commits", () => {
    expect(selectedEntriesHaveCommits([makeEntry({ commits: [] })])).toBe(false);
  });
});

describe("buildInvoiceSummaryEntries", () => {
  it("keeps only the fields needed for server-side invoice summary generation", () => {
    expect(buildInvoiceSummaryEntries([makeEntry()])).toEqual([
      {
        id: "entry-1",
        description: "Build invoice generation",
        projectName: "BogglTrack",
        startTime: "2026-04-25T10:00:00.000Z",
        durationSeconds: 3600,
        commits: [
          {
            sha: "abc123456789",
            message: "Add invoice summary",
            repo: "burhankhatri/BogglTrack",
            url: "https://github.com/burhankhatri/BogglTrack/commit/abc1234",
            committedAt: "2026-04-25T10:30:00.000Z",
          },
        ],
      },
    ]);
  });
});
