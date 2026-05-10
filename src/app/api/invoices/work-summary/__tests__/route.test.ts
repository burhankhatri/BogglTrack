import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireUserMock = vi.fn();
const generateInvoiceWorkSummaryMock = vi.fn();

vi.mock("@/lib/user", () => ({
  requireUserOrErrorResponse: requireUserMock,
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
    requireUserMock.mockReset();
    generateInvoiceWorkSummaryMock.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const { POST } = await import("../route");

    const response = await POST(request({ entries: [] }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(generateInvoiceWorkSummaryMock).not.toHaveBeenCalled();
  });

  it("returns null without calling Groq when entries have no commits", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
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
    requireUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
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
