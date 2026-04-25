import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAuthUserMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/user", () => ({
  getAuthUser: getAuthUserMock,
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
    getAuthUserMock.mockReset();
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const { DELETE } = await import("../route");

    const response = await DELETE(new NextRequest("http://localhost"), params);

    expect(response.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("removes the matching commit from the user's time entry", async () => {
    getAuthUserMock.mockResolvedValue({ id: "user-1" });
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
    getAuthUserMock.mockResolvedValue({ id: "user-1" });
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
