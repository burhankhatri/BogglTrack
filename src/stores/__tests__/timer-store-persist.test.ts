import { describe, it, expect, beforeEach } from "vitest";
import { useTimerStore } from "@/stores/timer-store";

const STORAGE_KEY = "boggltrack-timer";

describe("timer store persistence", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    useTimerStore.getState().stopTimer();
  });

  it("persists timer state to localStorage after startTimer", async () => {
    useTimerStore.getState().startTimer({
      entryId: "entry-1",
      startTime: "2026-04-08T10:00:00.000Z",
      description: "Test task",
      projectId: "proj-1",
      billable: true,
      tagIds: ["tag-1"],
      hourlyRate: 100,
    });

    // Zustand persist is async — wait for it
    await new Promise((r) => setTimeout(r, 50));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.isRunning).toBe(true);
    expect(parsed.state.entryId).toBe("entry-1");
    expect(parsed.state.description).toBe("Test task");
  });

  it("clears running state from localStorage after stopTimer", async () => {
    useTimerStore.getState().startTimer({
      entryId: "entry-1",
      startTime: "2026-04-08T10:00:00.000Z",
      description: "Test task",
      projectId: null,
      billable: true,
      tagIds: [],
      hourlyRate: 0,
    });

    await new Promise((r) => setTimeout(r, 50));

    useTimerStore.getState().stopTimer();

    await new Promise((r) => setTimeout(r, 50));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.isRunning).toBe(false);
  });

  it("does not persist elapsedSeconds (it is derived)", async () => {
    useTimerStore.getState().startTimer({
      entryId: "entry-1",
      startTime: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      description: "Test",
      projectId: null,
      billable: true,
      tagIds: [],
      hourlyRate: 0,
    });

    await new Promise((r) => setTimeout(r, 50));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    // elapsedSeconds should not be persisted (excluded via partialize)
    expect(stored.state.elapsedSeconds).toBeUndefined();
  });

  it("persists startTime as ISO string", async () => {
    const startISO = "2026-04-08T10:00:00.000Z";
    useTimerStore.getState().startTimer({
      entryId: "entry-1",
      startTime: startISO,
      description: "Test",
      projectId: null,
      billable: true,
      tagIds: [],
      hourlyRate: 0,
    });

    await new Promise((r) => setTimeout(r, 50));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    // startTime should be stored as an ISO string (not a Date object)
    expect(typeof stored.state.startTime).toBe("string");
    expect(stored.state.startTime).toBe(startISO);
  });
});
