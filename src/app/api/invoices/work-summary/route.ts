import { NextRequest, NextResponse } from "next/server";
import {
  generateInvoiceWorkSummary,
  hasSummaryEligibleCommits,
  type InvoiceSummaryEntry,
} from "@/lib/groq-summary";
import { requireUserOrErrorResponse } from "@/lib/user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntries(body: unknown): InvoiceSummaryEntry[] | null {
  if (!isRecord(body) || !Array.isArray(body.entries)) return null;

  return body.entries
    .filter(isRecord)
    .map((entry) => ({
      id: String(entry.id ?? ""),
      description: String(entry.description ?? ""),
      projectName:
        typeof entry.projectName === "string" ? entry.projectName : null,
      startTime: typeof entry.startTime === "string" ? entry.startTime : undefined,
      durationSeconds:
        typeof entry.durationSeconds === "number" ? entry.durationSeconds : null,
      commits: Array.isArray(entry.commits)
        ? entry.commits.filter(isRecord).map((commit) => ({
            sha: String(commit.sha ?? ""),
            message: String(commit.message ?? ""),
            repo: String(commit.repo ?? ""),
            url: typeof commit.url === "string" ? commit.url : undefined,
            committedAt:
              typeof commit.committedAt === "string"
                ? commit.committedAt
                : undefined,
          }))
        : [],
    }))
    .filter((entry) => entry.id);
}

export async function POST(request: NextRequest) {
  const { error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const entries = parseEntries(await request.json());
    if (!entries) {
      return NextResponse.json({ error: "entries is required" }, { status: 400 });
    }

    if (!hasSummaryEligibleCommits(entries)) {
      return NextResponse.json({ workSummary: null });
    }

    const workSummary = await generateInvoiceWorkSummary({ entries });

    return NextResponse.json({ workSummary });
  } catch (error) {
    console.error("Failed to generate invoice work summary:", error);
    return NextResponse.json({ workSummary: null });
  }
}
