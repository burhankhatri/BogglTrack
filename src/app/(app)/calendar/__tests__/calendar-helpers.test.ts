import { describe, it, expect } from "vitest";
import { getDateRange, filterCompletedEntries } from "../calendar-helpers";

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
