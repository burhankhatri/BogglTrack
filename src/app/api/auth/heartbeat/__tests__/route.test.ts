import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: () => getSessionMock(),
  },
}));

describe("GET /api/auth/heartbeat", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
  });

  it("returns 200 with expiresAt when the session is valid", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    getSessionMock.mockResolvedValue({
      data: {
        user: { id: "u1", email: "a@b.com" },
        session: { expiresAt },
      },
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(new Date(body.expiresAt).toISOString()).toBe(expiresAt.toISOString());
  });

  it("returns 401 when the session is missing", async () => {
    getSessionMock.mockResolvedValue({ data: null });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("returns 401 when getSession throws (invalid / decode failure)", async () => {
    getSessionMock.mockRejectedValue(new Error("bad cookie"));

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("returns 401 when session exists but has no user", async () => {
    getSessionMock.mockResolvedValue({ data: { session: {} } });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(401);
  });
});
