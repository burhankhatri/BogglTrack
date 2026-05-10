import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const findFirstMock = vi.fn();
const createMock = vi.fn();

vi.mock("../auth/server", () => ({
  auth: {
    getSession: () => getSessionMock(),
  },
}));

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findFirst: findFirstMock,
      create: createMock,
    },
  },
}));

describe("getAuthUser / requireUserOrErrorResponse", () => {
  beforeEach(async () => {
    vi.resetModules();
    getSessionMock.mockReset();
    findFirstMock.mockReset();
    createMock.mockReset();
  });

  it("returns null when there is no session (legitimate signed-out user)", async () => {
    getSessionMock.mockResolvedValue({ data: null });
    const { getAuthUser } = await import("../user");
    expect(await getAuthUser()).toBeNull();
  });

  it("returns the user when session and DB lookup succeed", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: { email: "x@example.com", name: "X" } },
    });
    findFirstMock.mockResolvedValue({ id: "u1", email: "x@example.com" });
    const { getAuthUser } = await import("../user");
    const user = await getAuthUser();
    expect(user).toEqual({ id: "u1", email: "x@example.com" });
  });

  it("throws AuthSessionError when getSession itself rejects", async () => {
    getSessionMock.mockRejectedValue(new Error("cookie decode failed"));
    const { getAuthUser, AuthSessionError } = await import("../user");
    await expect(getAuthUser()).rejects.toBeInstanceOf(AuthSessionError);
  });

  it("throws AuthBackendError when prisma findFirst rejects", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: { email: "y@example.com", name: "Y" } },
    });
    findFirstMock.mockRejectedValue(
      new Error('column "defaultProjectId" does not exist')
    );
    const { getAuthUser, AuthBackendError } = await import("../user");
    await expect(getAuthUser()).rejects.toBeInstanceOf(AuthBackendError);
  });

  it("requireUserOrErrorResponse returns 401 unauthorized for no session", async () => {
    getSessionMock.mockResolvedValue({ data: null });
    const { requireUserOrErrorResponse } = await import("../user");
    const { user, error } = await requireUserOrErrorResponse();
    expect(user).toBeNull();
    expect(error?.status).toBe(401);
    expect(await error?.json()).toEqual({ error: "unauthorized" });
  });

  it("requireUserOrErrorResponse returns 401 session_invalid on decode failure", async () => {
    getSessionMock.mockRejectedValue(new Error("bad cookie"));
    const { requireUserOrErrorResponse } = await import("../user");
    const { user, error } = await requireUserOrErrorResponse();
    expect(user).toBeNull();
    expect(error?.status).toBe(401);
    expect(await error?.json()).toEqual({ error: "session_invalid" });
  });

  it("requireUserOrErrorResponse returns 503 auth_backend_unavailable on DB error", async () => {
    getSessionMock.mockResolvedValue({
      data: { user: { email: "z@example.com" } },
    });
    findFirstMock.mockRejectedValue(new Error("connection refused"));
    const { requireUserOrErrorResponse } = await import("../user");
    const { user, error } = await requireUserOrErrorResponse();
    expect(user).toBeNull();
    expect(error?.status).toBe(503);
    expect(await error?.json()).toEqual({ error: "auth_backend_unavailable" });
  });
});
