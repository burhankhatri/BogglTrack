import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireUserMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/user", () => ({
  requireUserOrErrorResponse: requireUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: {
      findFirst: findFirstMock,
      update: updateMock,
    },
  },
}));

const params = {
  params: Promise.resolve({ id: "entry-1", sha: "abc123456789" }),
};

describe("DELETE /api/time-entries/[id]/commits/[sha]", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const { DELETE } = await import("../route");

    const response = await DELETE(new NextRequest("http://localhost"), params);

    expect(response.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("removes the matching commit from the user's time entry", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    findFirstMock.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      commits: [
        {
          sha: "abc123456789",
          message: "Remove me",
          repo: "owner/repo",
        },
        {
          sha: "def987654321",
          message: "Keep me",
          repo: "owner/repo",
        },
      ],
    });
    updateMock.mockResolvedValue({
      id: "entry-1",
      commits: [
        {
          sha: "def987654321",
          message: "Keep me",
          repo: "owner/repo",
        },
      ],
    });
    const { DELETE } = await import("../route");

    const response = await DELETE(new NextRequest("http://localhost"), params);

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry-1" },
        data: {
          commits: [
            {
              sha: "def987654321",
              message: "Keep me",
              repo: "owner/repo",
            },
          ],
        },
      })
    );
    expect(await response.json()).toEqual({
      entry: {
        id: "entry-1",
        commits: [
          {
            sha: "def987654321",
            message: "Keep me",
            repo: "owner/repo",
          },
        ],
      },
      removed: true,
    });
  });

  it("returns 404 when the commit is not attached to the entry", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    findFirstMock.mockResolvedValue({
      id: "entry-1",
      commits: [],
    });
    const { DELETE } = await import("../route");

    const response = await DELETE(new NextRequest("http://localhost"), params);

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
