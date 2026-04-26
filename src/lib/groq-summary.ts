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
