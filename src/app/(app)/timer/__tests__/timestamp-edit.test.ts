import { describe, it, expect } from "vitest";
import {
  parseEntryTimestamp,
  buildTimestampISO,
  validateTimeRange,
  resolveTimeRange,
} from "../timestamp-helpers";

describe("parseEntryTimestamp", () => {
  it("parses ISO string into local date and time parts", () => {
    // Create a date in local time: April 8, 2026 at 09:30
    const localDate = new Date(2026, 3, 8, 9, 30, 0);
    const iso = localDate.toISOString();

    const { date, time } = parseEntryTimestamp(iso);

    expect(date).toBe("2026-04-08");
    expect(time).toBe("09:30");
  });

  it("pads single-digit months and hours", () => {
    const localDate = new Date(2026, 0, 5, 8, 5, 0); // Jan 5, 08:05
    const iso = localDate.toISOString();

    const { date, time } = parseEntryTimestamp(iso);

    expect(date).toBe("2026-01-05");
    expect(time).toBe("08:05");
  });
});

describe("buildTimestampISO", () => {
  it("combines date and time into an ISO string", () => {
    const result = buildTimestampISO("2026-04-08", "09:30");
    const d = new Date(result);

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });
});

describe("validateTimeRange", () => {
  it("returns null when end is after start", () => {
    const error = validateTimeRange("2026-04-08", "09:00", "10:00");
    expect(error).toBeNull();
  });

  it("returns error when end equals start", () => {
    const error = validateTimeRange("2026-04-08", "09:00", "09:00");
    expect(error).toBe("End time must be after start time");
  });

  it("returns error when end is before start", () => {
    const error = validateTimeRange("2026-04-08", "10:00", "09:00");
    expect(error).toBe("End time must be after start time");
  });
});

describe("resolveTimeRange", () => {
  it("returns ok for a same-day range with end after start", () => {
    const result = resolveTimeRange("2026-04-08", "09:00", "10:00");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.crossesMidnight).toBe(false);
    // Both timestamps should be on 2026-04-08 in local time.
    const start = new Date(result.startISO);
    const end = new Date(result.endISO);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(8);
    expect(start.getHours()).toBe(9);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(8);
    expect(end.getHours()).toBe(10);
  });

  it("rolls end to the next day when end is before start (23:00 -> 00:30)", () => {
    const result = resolveTimeRange("2026-04-08", "23:00", "00:30");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.crossesMidnight).toBe(true);
    const start = new Date(result.startISO);
    const end = new Date(result.endISO);
    expect(start.getDate()).toBe(8);
    expect(start.getHours()).toBe(23);
    expect(end.getDate()).toBe(9);
    expect(end.getHours()).toBe(0);
    expect(end.getMinutes()).toBe(30);
  });

  it("rolls end to the next day for a larger overnight range (22:00 -> 06:00)", () => {
    const result = resolveTimeRange("2026-04-08", "22:00", "06:00");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.crossesMidnight).toBe(true);
    const end = new Date(result.endISO);
    expect(end.getDate()).toBe(9);
    expect(end.getHours()).toBe(6);
  });

  it("rolls end to the next day across a month boundary (30th -> 1st)", () => {
    // 2026-04-30 23:30 -> 00:15 should roll to 2026-05-01
    const result = resolveTimeRange("2026-04-30", "23:30", "00:15");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.crossesMidnight).toBe(true);
    const end = new Date(result.endISO);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(4); // May
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(0);
    expect(end.getMinutes()).toBe(15);
  });

  it("returns an error when end equals start", () => {
    const result = resolveTimeRange("2026-04-08", "09:00", "09:00");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("End time must be after start time");
  });
});
