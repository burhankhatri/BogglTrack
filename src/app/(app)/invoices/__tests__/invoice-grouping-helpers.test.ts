import { describe, it, expect } from "vitest";
import {
  groupPreviewEntriesByDay,
  type GroupableInvoiceEntry,
} from "../invoice-grouping-helpers";

function make(
  id: string,
  overrides: Partial<GroupableInvoiceEntry> = {}
): GroupableInvoiceEntry {
  return {
    id,
    description: "joshuav10",
    startTime: "2026-04-19T10:00:00",
    duration: 3600,
    billable: true,
    earnings: 40,
    projectId: "proj-josh",
    tags: [],
    ...overrides,
  };
}

describe("groupPreviewEntriesByDay", () => {
  it("merges same-day entries with identical description + project + billable + tags", () => {
    const grouped = groupPreviewEntriesByDay([
      make("1", { duration: 6300, earnings: 70 }),
      make("2", { startTime: "2026-04-19T14:00:00", duration: 8835, earnings: 98.17 }),
      make("3", { startTime: "2026-04-19T18:00:00", duration: 18, earnings: 0.2 }),
    ]);

    expect(grouped).toHaveLength(1);
    const row = grouped[0];
    expect(row.entries).toHaveLength(3);
    expect(row.totalDuration).toBe(6300 + 8835 + 18);
    expect(row.totalEarnings).toBeCloseTo(70 + 98.17 + 0.2, 2);
    expect(row.date).toBe("2026-04-19");
  });

  it("does NOT merge entries with identical description on different days", () => {
    const grouped = groupPreviewEntriesByDay([
      make("1", { startTime: "2026-04-19T10:00:00" }),
      make("2", { startTime: "2026-04-20T10:00:00" }),
    ]);

    expect(grouped).toHaveLength(2);
    const dates = grouped.map((g) => g.date).sort();
    expect(dates).toEqual(["2026-04-19", "2026-04-20"]);
  });

  it("does NOT merge same-day entries on different projects", () => {
    const grouped = groupPreviewEntriesByDay([
      make("1", { projectId: "proj-a" }),
      make("2", { projectId: "proj-b" }),
    ]);

    expect(grouped).toHaveLength(2);
  });

  it("does NOT merge entries with different tag sets", () => {
    const grouped = groupPreviewEntriesByDay([
      make("1", { tags: [{ tagId: "t-design" }] }),
      make("2", { tags: [{ tagId: "t-dev" }] }),
    ]);

    expect(grouped).toHaveLength(2);
  });

  it("merges entries whose tag sets match regardless of order", () => {
    const grouped = groupPreviewEntriesByDay([
      make("1", { tags: [{ tagId: "t-a" }, { tagId: "t-b" }] }),
      make("2", { tags: [{ tagId: "t-b" }, { tagId: "t-a" }] }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].entries).toHaveLength(2);
  });

  it("sorts merged entries chronologically", () => {
    const grouped = groupPreviewEntriesByDay([
      make("late", { startTime: "2026-04-19T18:00:00" }),
      make("early", { startTime: "2026-04-19T09:00:00" }),
      make("mid", { startTime: "2026-04-19T13:00:00" }),
    ]);

    expect(grouped[0].entries.map((e) => e.id)).toEqual(["early", "mid", "late"]);
  });

  it("merges two no-project entries with the same description on the same day", () => {
    const grouped = groupPreviewEntriesByDay([
      make("1", { projectId: null }),
      make("2", { projectId: null }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].entries).toHaveLength(2);
  });
});
