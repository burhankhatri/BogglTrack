import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const toastErrorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

import { useSessionHeartbeat } from "../use-session-heartbeat";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useSessionHeartbeat", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    toastErrorMock.mockReset();
    fetchMock = vi.fn();
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("pings heartbeat on mount", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/heartbeat",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("pings every 4 minutes while visible", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not ping while the tab is hidden", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    setVisibility("hidden");

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pings immediately when the tab becomes visible", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    setVisibility("hidden");

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      setVisibility("visible");
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a sign-in toast on 401 and does not duplicate while still expired", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 401 }));

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/signed out/i);

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("re-arms the toast after a recovery (200 between two 401s)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 401 }));

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      await Promise.resolve();
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
      await Promise.resolve();
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
  });

  it("stays silent when fetch itself rejects (offline)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderHook(() => useSessionHeartbeat());
    await act(async () => {
      await Promise.resolve();
    });

    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
