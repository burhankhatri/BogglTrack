import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTimerStore } from "@/stores/timer-store";
import { resumeTimerOptimistic } from "@/lib/timer-actions";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

const makeEntry = (overrides = {}) => ({
  id: "entry-123",
  description: "Client meeting",
  startTime: "2026-03-09T10:00:00.000Z",
  endTime: "2026-03-09T11:30:00.000Z",
  duration: 5400,
  billable: true,
  projectId: "proj-1",
  project: { id: "proj-1", name: "MattBrown", color: "#2D6B5A", hourlyRate: 100, client: null },
  ...overrides,
});

describe("resumeTimerOptimistic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.getState().stopTimer();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts timer immediately with temp- prefixed ID", () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "server-id-456", startTime: new Date().toISOString() }),
    });

    resumeTimerOptimistic(makeEntry(), 50);

    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.entryId).toMatch(/^temp-/);
    expect(state.description).toBe("Client meeting");
    expect(state.projectId).toBe("proj-1");
    expect(state.billable).toBe(true);
  });

  it("carries over hourlyRate from project when available", () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "server-id", startTime: new Date().toISOString() }),
    });

    resumeTimerOptimistic(makeEntry(), 50);

    expect(useTimerStore.getState().hourlyRate).toBe(100);
  });

  it("falls back to user default rate when project has no rate", () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "server-id", startTime: new Date().toISOString() }),
    });

    resumeTimerOptimistic(makeEntry({ project: null, projectId: null }), 75);

    expect(useTimerStore.getState().hourlyRate).toBe(75);
  });

  it("replaces temp ID with server ID on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "server-id-456", startTime: new Date().toISOString() }),
    });

    resumeTimerOptimistic(makeEntry(), 50);

    // Wait for the background fetch to resolve
    await vi.waitFor(() => {
      expect(useTimerStore.getState().entryId).toBe("server-id-456");
    });
  });

  it("stops timer and shows error toast on fetch failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    resumeTimerOptimistic(makeEntry(), 50);

    // Initially running
    expect(useTimerStore.getState().isRunning).toBe(true);

    // After fetch rejects, timer should stop
    await vi.waitFor(() => {
      expect(useTimerStore.getState().isRunning).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith("Failed to start timer");
  });

  it("stops timer on non-ok response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    resumeTimerOptimistic(makeEntry(), 50);

    await vi.waitFor(() => {
      expect(useTimerStore.getState().isRunning).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith("Failed to start timer");
  });

  it("sends correct POST body to /api/time-entries", () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "server-id", startTime: new Date().toISOString() }),
    });

    resumeTimerOptimistic(makeEntry(), 50);

    expect(fetch).toHaveBeenCalledWith("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining('"description":"Client meeting"'),
    });

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.projectId).toBe("proj-1");
    expect(body.billable).toBe(true);
    expect(body.startTime).toBeDefined();
  });
});
