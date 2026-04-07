import { describe, it, expect } from "vitest";
import {
  parseEntryTimestamp,
  buildTimestampISO,
  validateTimeRange,
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
