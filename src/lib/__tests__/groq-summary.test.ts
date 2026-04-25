import { describe, expect, it, vi } from "vitest";
import {
  buildInvoiceWorkSummaryPrompt,
  generateInvoiceWorkSummary,
  hasSummaryEligibleCommits,
  type InvoiceSummaryEntry,
} from "../groq-summary";

function makeEntry(
  overrides: Partial<InvoiceSummaryEntry> = {}
): InvoiceSummaryEntry {
  return {
    id: "entry-1",
    description: "Implement invoice flow",
    projectName: "BogglTrack",
    startTime: "2026-04-25T10:00:00.000Z",
    durationSeconds: 3600,
    commits: [
      {
        sha: "abc123456789",
        message: "Add invoice PDF summary",
        repo: "burhankhatri/BogglTrack",
      },
    ],
    ...overrides,
  };
}

describe("hasSummaryEligibleCommits", () => {
  it("returns true when at least one entry has commits", () => {
    expect(hasSummaryEligibleCommits([makeEntry()])).toBe(true);
  });

  it("returns false when no selected entries have commits", () => {
    expect(
      hasSummaryEligibleCommits([
        makeEntry({ commits: [] }),
        makeEntry({ id: "entry-2", commits: null }),
      ])
    ).toBe(false);
  });
});

describe("buildInvoiceWorkSummaryPrompt", () => {
  it("groups commit context by project for the model prompt", () => {
    const prompt = buildInvoiceWorkSummaryPrompt([
      makeEntry(),
      makeEntry({
        id: "entry-2",
        description: "Fix timer resume",
        projectName: "Timer",
        durationSeconds: 1800,
        commits: [
          {
            sha: "def987654321",
            message: "Fix optimistic resume state",
            repo: "burhankhatri/BogglTrack",
          },
        ],
      }),
    ]);

    expect(prompt).toContain("Project: BogglTrack");
    expect(prompt).toContain("Add invoice PDF summary");
    expect(prompt).toContain("Project: Timer");
    expect(prompt).toContain("Fix optimistic resume state");
  });
});

describe("generateInvoiceWorkSummary", () => {
  it("returns null without calling fetch when no commits are present", async () => {
    const fetchMock = vi.fn();

    const result = await generateInvoiceWorkSummary({
      entries: [makeEntry({ commits: [] })],
      apiKey: "test-key",
      fetchImpl: fetchMock,
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the generated summary text from Groq", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "Worked on BogglTrack by adding invoice summaries and improving timer reliability.",
            },
          },
        ],
      }),
    });

    const result = await generateInvoiceWorkSummary({
      entries: [makeEntry()],
      apiKey: "test-key",
      fetchImpl: fetchMock,
    });

    expect(result).toBe(
      "Worked on BogglTrack by adding invoice summaries and improving timer reliability."
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );
  });
});
