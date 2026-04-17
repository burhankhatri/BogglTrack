import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { startOfWeek, endOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

// GET /api/github/weekly-recap
// Summarizes the current week: total hours, total earnings, project breakdown,
// and all attached commits grouped by repo. Returns a ready-to-copy "standup"
// message alongside the raw data for custom rendering.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const from = startOfWeek(now, { weekStartsOn: 1 });
  const to = endOfWeek(now, { weekStartsOn: 1 });

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: user.id,
      endTime: { not: null },
      startTime: { gte: from, lte: to },
    },
    include: {
      project: { select: { id: true, name: true, color: true, hourlyRate: true } },
    },
    orderBy: { startTime: "asc" },
  });

  let totalSeconds = 0;
  let totalEarnings = 0;
  const projectBreakdown = new Map<
    string,
    { id: string; name: string; color: string; seconds: number; commits: number }
  >();
  const NO_PROJECT_KEY = "__none";

  interface CommitSnapshot {
    sha: string;
    message: string;
    repo: string;
    url: string;
    committedAt: string;
  }
  const commitsByRepo = new Map<string, CommitSnapshot[]>();
  const seenShas = new Set<string>();

  for (const e of entries) {
    const dur = e.duration ?? 0;
    totalSeconds += dur;
    if (e.billable) {
      const rate = e.project?.hourlyRate ?? user.defaultHourlyRate;
      totalEarnings += (dur / 3600) * (rate ?? 0);
    }

    // Project breakdown
    const key = e.project?.id ?? NO_PROJECT_KEY;
    const existing = projectBreakdown.get(key);
    const commits = Array.isArray(e.commits) ? (e.commits as unknown as CommitSnapshot[]) : [];
    if (existing) {
      existing.seconds += dur;
      existing.commits += commits.length;
    } else {
      projectBreakdown.set(key, {
        id: e.project?.id ?? "",
        name: e.project?.name ?? "No project",
        color: e.project?.color ?? "#71717A",
        seconds: dur,
        commits: commits.length,
      });
    }

    // Commits grouped by repo, deduped by sha
    for (const c of commits) {
      if (seenShas.has(c.sha)) continue;
      seenShas.add(c.sha);
      const list = commitsByRepo.get(c.repo) ?? [];
      list.push(c);
      commitsByRepo.set(c.repo, list);
    }
  }

  const projects = Array.from(projectBreakdown.values()).sort(
    (a, b) => b.seconds - a.seconds
  );

  const repos = Array.from(commitsByRepo.entries())
    .map(([repo, commits]) => ({
      repo,
      commits: commits.sort(
        (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
      ),
    }))
    .sort((a, b) => b.commits.length - a.commits.length);

  const totalCommits = Array.from(commitsByRepo.values()).reduce((s, cs) => s + cs.length, 0);

  // ---- Build standup text ----
  const lines: string[] = [];
  lines.push("**This week**");

  const hours = totalSeconds / 3600;
  const shipParts: string[] = [];

  for (const { repo, commits } of repos.slice(0, 5)) {
    // Take the most informative top 3 commit messages per repo, stripped of
    // conventional-commit prefix.
    const top = commits
      .slice(0, 3)
      .map((c) =>
        c.message
          .split("\n")[0]
          .replace(
            /^(feat|fix|chore|refactor|test|docs|style|perf|build|ci|revert)(\([^)]+\))?:\s*/i,
            ""
          )
          .trim()
      )
      .filter(Boolean);
    if (top.length === 0) continue;
    shipParts.push(`**${repo}** — ${top.join("; ")}`);
  }

  if (shipParts.length > 0) {
    lines.push("Shipped:");
    for (const s of shipParts) lines.push(`• ${s}`);
  }

  lines.push("");
  lines.push(
    `${hours.toFixed(1)}h tracked across ${projects.length} project${projects.length === 1 ? "" : "s"} · ${totalCommits} commit${totalCommits === 1 ? "" : "s"}`
  );

  const standupText = lines.join("\n");

  return NextResponse.json({
    weekStart: from.toISOString(),
    weekEnd: to.toISOString(),
    totalSeconds,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalCommits,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hours: Math.round((p.seconds / 3600) * 100) / 100,
      commits: p.commits,
    })),
    repos: repos.map((r) => ({
      repo: r.repo,
      commits: r.commits,
    })),
    standupText,
  });
}
