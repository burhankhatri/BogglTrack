import { prisma } from "@/lib/prisma";
import type { AttachedCommit } from "./commits";

/**
 * Given a set of commits and a userId, find the best matching project by
 * looking up ProjectRepo rows whose repoFullName appears in the commits.
 *
 * Strategy: tally how many commits hit each linked repo, pick the project
 * with the most hits. If no linked repo matches, return null (caller should
 * leave projectId alone).
 */
export async function matchProjectIdForCommits(params: {
  userId: string;
  commits: AttachedCommit[];
}): Promise<string | null> {
  if (params.commits.length === 0) return null;

  const repos = Array.from(new Set(params.commits.map((c) => c.repo)));
  if (repos.length === 0) return null;

  // Fetch every ProjectRepo row for this user whose repoFullName is present
  // in the commit list. Scope by project.userId so we can't cross-match
  // another user's linked repos.
  const links = await prisma.projectRepo.findMany({
    where: {
      repoFullName: { in: repos },
      project: { userId: params.userId },
    },
    select: { projectId: true, repoFullName: true },
  });
  if (links.length === 0) return null;

  // Count commits per matched projectId
  const counts = new Map<string, number>();
  for (const c of params.commits) {
    for (const link of links) {
      if (link.repoFullName === c.repo) {
        counts.set(link.projectId, (counts.get(link.projectId) ?? 0) + 1);
      }
    }
  }

  // Return the projectId with the highest count; ties broken alphabetically
  // so the result is deterministic.
  let best: string | null = null;
  let bestCount = 0;
  for (const [pid, count] of counts) {
    if (count > bestCount || (count === bestCount && (best == null || pid < best))) {
      best = pid;
      bestCount = count;
    }
  }
  return best;
}
