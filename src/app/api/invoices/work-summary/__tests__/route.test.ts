import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getAuthUserMock = vi.fn();
const generateInvoiceWorkSummaryMock = vi.fn();

vi.mock("@/lib/user", () => ({
  getAuthUser: getAuthUserMock,
}));

vi.mock("@/lib/groq-summary", async () => {
  const actual = await vi.importActual<typeof import("@/lib/groq-summary")>(
    "@/lib/groq-summary"
  );
  return {
    ...actual,
    generateInvoiceWorkSummary: generateInvoiceWorkSummaryMock,
  };
});

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/invoices/work-summary", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/invoices/work-summary", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthUserMock.mockReset();
    generateInvoiceWorkSummaryMock.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const { POST } = await import("../route");

    const response = await POST(request({ entries: [] }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(generateInvoiceWorkSummaryMock).not.toHaveBeenCalled();
  });

  it("returns null without calling Groq when entries have no commits", async () => {
    getAuthUserMock.mockResolvedValue({ id: "user-1" });
    const { POST } = await import("../route");

    const response = await POST(
      request({
        entries: [
          {
            id: "entry-1",
            description: "Planning",
            projectName: "BogglTrack",
            commits: [],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workSummary: null });
    expect(generateInvoiceWorkSummaryMock).not.toHaveBeenCalled();
  });

  it("returns the Groq-generated work summary", async () => {
    getAuthUserMock.mockResolvedValue({ id: "user-1" });
    generateInvoiceWorkSummaryMock.mockResolvedValue(
      "Summarized invoice work by project."
    );
    const { POST } = await import("../route");

    const response = await POST(
      request({
        entries: [
          {
            id: "entry-1",
            description: "Build invoices",
            projectName: "BogglTrack",
            commits: [
              {
                sha: "abc123456789",
                message: "Add work summary",
                repo: "burhankhatri/BogglTrack",
              },
            ],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      workSummary: "Summarized invoice work by project.",
    });
    expect(generateInvoiceWorkSummaryMock).toHaveBeenCalledOnce();
  });
});
