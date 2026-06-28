export interface InvoiceSummaryCommit {
  sha: string;
  message: string;
  repo: string;
  url?: string;
  committedAt?: string;
}

export interface InvoiceSummaryEntry {
  id: string;
  description: string;
  projectName: string | null;
  startTime?: string;
  durationSeconds?: number | null;
  commits?: InvoiceSummaryCommit[] | null;
}

interface GenerateInvoiceWorkSummaryOptions {
  entries: InvoiceSummaryEntry[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
  model?: string;
}

interface AnthropicMessage {
  content?: { type: string; text?: string }[];
}

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function hasSummaryEligibleCommits(entries: InvoiceSummaryEntry[]): boolean {
  return entries.some((entry) => (entry.commits?.length ?? 0) > 0);
}

export function buildInvoiceWorkSummaryPrompt(
  entries: InvoiceSummaryEntry[]
): string {
  const byProject = new Map<string, InvoiceSummaryEntry[]>();

  for (const entry of entries) {
    if (!entry.commits?.length) continue;
    const projectName = entry.projectName?.trim() || "No Project";
    const current = byProject.get(projectName) ?? [];
    current.push(entry);
    byProject.set(projectName, current);
  }

  const projectSections = Array.from(byProject.entries()).map(
    ([projectName, projectEntries]) => {
      const lines = projectEntries.flatMap((entry) => {
        const entryLabel = entry.description.trim() || "(no description)";
        return (entry.commits ?? []).map((commit) => {
          const sha = commit.sha.slice(0, 7);
          return `- ${entryLabel}: ${sha} ${commit.message} (${commit.repo})`;
        });
      });

      return [`Project: ${projectName}`, ...lines].join("\n");
    }
  );

  return [
    "Write a polished work summary for a client invoice.",
    "Translate the development activity below into a complete, thorough description of the work delivered — what was built, fixed, or improved — written so a non-engineer can follow it.",
    "Cover every project listed; do not omit anything. Do NOT mention commits, commit hashes, branch names, file paths, or any technical jargon. Do not quote commit messages verbatim — translate them into client-facing outcomes.",
    "Group by project. For each project write a short, flowing paragraph (3–5 sentences). Total length 4–10 sentences across the whole summary. Professional tone. Plain prose only — no bullet points, no headings, no markdown.",
    "",
    "Work evidence (for your reference only — do not echo this back):",
    projectSections.join("\n\n"),
  ].join("\n");
}

export async function generateInvoiceWorkSummary({
  entries,
  apiKey = process.env.ANTHROPIC_API_KEY,
  fetchImpl = fetch,
  model = DEFAULT_MODEL,
}: GenerateInvoiceWorkSummaryOptions): Promise<string | null> {
  if (!hasSummaryEligibleCommits(entries) || !apiKey) return null;

  try {
    const response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        system:
          "You summarize software development work for invoices. Be accurate, concise, and client-friendly.",
        messages: [
          {
            role: "user",
            content: buildInvoiceWorkSummaryPrompt(entries),
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as AnthropicMessage;
    const block = data.content?.find((b) => b.type === "text");
    const summary = block?.text?.trim();

    return summary || null;
  } catch (error) {
    console.error("Failed to generate invoice summary:", error);
    return null;
  }
}
