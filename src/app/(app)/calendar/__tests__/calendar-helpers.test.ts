import { describe, it, expect } from "vitest";
import { getDateRange, filterCompletedEntries, groupEntriesByDescription } from "../calendar-helpers";

describe("getDateRange", () => {
  it("returns start and end of day in ISO for a given date", () => {
    const date = new Date(2026, 3, 8); // April 8, 2026
    const { from, to } = getDateRange(date);

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // from should be start of day
    expect(fromDate.getFullYear()).toBe(2026);
    expect(fromDate.getMonth()).toBe(3); // April
    expect(fromDate.getDate()).toBe(8);
    expect(fromDate.getHours()).toBe(0);
    expect(fromDate.getMinutes()).toBe(0);

    // to should be end of day
    expect(toDate.getFullYear()).toBe(2026);
    expect(toDate.getMonth()).toBe(3);
    expect(toDate.getDate()).toBe(8);
    expect(toDate.getHours()).toBe(23);
    expect(toDate.getMinutes()).toBe(59);
  });

  it("handles month boundaries", () => {
    const date = new Date(2026, 0, 31); // Jan 31
    const { from, to } = getDateRange(date);

    expect(new Date(from).getDate()).toBe(31);
    expect(new Date(to).getDate()).toBe(31);
  });
});

describe("filterCompletedEntries", () => {
  it("excludes entries without endTime (running)", () => {
    const entries = [
      { id: "1", endTime: "2026-04-08T11:00:00Z" },
      { id: "2", endTime: null }, // running
      { id: "3", endTime: "2026-04-08T15:00:00Z" },
    ];

    const result = filterCompletedEntries(entries as any);
    expect(result).toHaveLength(2);
    expect(result.map((e: any) => e.id)).toEqual(["1", "3"]);
  });

  it("returns empty array when all entries are running", () => {
    const entries = [
      { id: "1", endTime: null },
    ];

    const result = filterCompletedEntries(entries as any);
    expect(result).toHaveLength(0);
  });
});

describe("groupEntriesByDescription", () => {
  const makeEntry = (id: string, description: string, duration: number, projectId: string | null = "proj-1", project: any = { id: "proj-1", name: "Test", color: "#2D6B5A", hourlyRate: 100, client: null }) => ({
    id,
    description,
    startTime: "2026-04-08T09:00:00Z",
    endTime: "2026-04-08T10:00:00Z",
    duration,
    billable: true,
    projectId,
    project,
    tags: [],
  });

  it("groups entries with the same description into one row", () => {
    const entries = [
      makeEntry("1", "test1", 4),
      makeEntry("2", "test1", 4),
      makeEntry("3", "test1", 2),
    ];

    const grouped = groupEntriesByDescription(entries);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].description).toBe("test1");
    expect(grouped[0].totalDuration).toBe(10);
    expect(grouped[0].entryCount).toBe(3);
  });

  it("keeps entries with different descriptions separate", () => {
    const entries = [
      makeEntry("1", "design work", 3600),
      makeEntry("2", "coding", 7200),
      makeEntry("3", "design work", 1800),
    ];

    const grouped = groupEntriesByDescription(entries);
    expect(grouped).toHaveLength(2);

    const design = grouped.find((g) => g.description === "design work")!;
    const coding = grouped.find((g) => g.description === "coding")!;

    expect(design.totalDuration).toBe(5400);
    expect(design.entryCount).toBe(2);
    expect(coding.totalDuration).toBe(7200);
    expect(coding.entryCount).toBe(1);
  });

  it("uses the earliest startTime and latest endTime from the group", () => {
    const entries = [
      { ...makeEntry("1", "work", 3600), startTime: "2026-04-08T14:00:00Z", endTime: "2026-04-08T15:00:00Z" },
      { ...makeEntry("2", "work", 3600), startTime: "2026-04-08T09:00:00Z", endTime: "2026-04-08T10:00:00Z" },
    ];

    const grouped = groupEntriesByDescription(entries);
    expect(grouped[0].startTime).toBe("2026-04-08T09:00:00Z");
    expect(grouped[0].endTime).toBe("2026-04-08T15:00:00Z");
  });

  it("preserves the project from the first entry in the group", () => {
    const entries = [
      makeEntry("1", "test1", 100, "proj-1", { id: "proj-1", name: "Alpha", color: "#f00", hourlyRate: 50, client: null }),
      makeEntry("2", "test1", 200, "proj-1", { id: "proj-1", name: "Alpha", color: "#f00", hourlyRate: 50, client: null }),
    ];

    const grouped = groupEntriesByDescription(entries);
    expect(grouped[0].project?.name).toBe("Alpha");
  });

  it("groups entries with no description together", () => {
    const entries = [
      makeEntry("1", "", 60),
      makeEntry("2", "", 120),
    ];

    const grouped = groupEntriesByDescription(entries);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].totalDuration).toBe(180);
  });
});
