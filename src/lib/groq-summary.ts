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

interface GroqChatCompletionResponse {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
}

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

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
    "Write an invoice-safe work summary for a client.",
    "Group the summary by project, focus on outcomes and completed work, and avoid mentioning commit hashes unless they clarify the work.",
    "Keep it concise: 2-5 bullets total, professional tone, no markdown table.",
    "",
    "Work evidence:",
    projectSections.join("\n\n"),
  ].join("\n");
}

export async function generateInvoiceWorkSummary({
  entries,
  apiKey = process.env.GROQ_API_KEY,
  fetchImpl = fetch,
  model = DEFAULT_GROQ_MODEL,
}: GenerateInvoiceWorkSummaryOptions): Promise<string | null> {
  if (!hasSummaryEligibleCommits(entries) || !apiKey) return null;

  try {
    const response = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You summarize software development work for invoices. Be accurate, concise, and client-friendly.",
          },
          {
            role: "user",
            content: buildInvoiceWorkSummaryPrompt(entries),
          },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as GroqChatCompletionResponse;
    const summary = data.choices?.[0]?.message?.content?.trim();

    return summary || null;
  } catch (error) {
    console.error("Failed to generate Groq invoice summary:", error);
    return null;
  }
}
