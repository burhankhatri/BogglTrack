// Query the authenticated user's commits across all repos in a time window.
// Uses the GraphQL `contributionsCollection` endpoint as the canonical source,
// then enriches with REST calls for commit messages (the contributions API
// returns counts + timestamps but not messages; GitHub made that design choice
// deliberately because contribution data is aggregated).
//
// Strategy used here:
//   1. GraphQL: get `commitContributionsByRepository` for the window → list of
//      (repo, count, occurrence timestamps).
//   2. For each repo with contributions in the window, REST call
//      /repos/{owner}/{repo}/commits?author=<login>&since=<from>&until=<to> to
//      fetch the actual commits + messages + urls.
//
// We cap at 10 repos and 30 commits total per entry to keep things sane.

import { decryptToken } from "./crypto";

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;           // "owner/name"
  url: string;
  committedAt: string;    // ISO
}

interface ContribResponse {
  data?: {
    viewer: {
      login: string;
      contributionsCollection: {
        commitContributionsByRepository: Array<{
          contributions: { totalCount: number };
          repository: {
            nameWithOwner: string;
            isPrivate: boolean;
          };
        }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

const GQL = `
  query CommitsInWindow($from: DateTime!, $to: DateTime!) {
    viewer {
      login
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 25) {
          contributions(first: 1) { totalCount }
          repository { nameWithOwner isPrivate }
        }
      }
    }
  }
`;

export async function fetchCommitsInWindow(params: {
  encryptedAccessToken: string;
  from: Date;
  to: Date;
  /** Optional cap on total commits returned across all repos. */
  maxCommits?: number;
}): Promise<AttachedCommit[]> {
  const max = params.maxCommits ?? 30;
  const token = decryptToken(params.encryptedAccessToken);

  // 1. GraphQL: which repos had commits in the window?
  const gql = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      query: GQL,
      variables: {
        from: params.from.toISOString(),
        to: params.to.toISOString(),
      },
    }),
  });
  if (!gql.ok) {
    throw new Error(`GitHub GraphQL failed: ${gql.status}`);
  }
  const payload = (await gql.json()) as ContribResponse;
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${payload.errors[0].message}`);
  }
  const login = payload.data?.viewer.login;
  const repos =
    payload.data?.viewer.contributionsCollection.commitContributionsByRepository ?? [];
  if (!login || repos.length === 0) return [];

  // 2. REST: for each repo (cap 10), fetch the actual commits with messages.
  const topRepos = repos
    .filter((r) => r.contributions.totalCount > 0)
    .slice(0, 10);

  const since = params.from.toISOString();
  const until = params.to.toISOString();

  const results: AttachedCommit[] = [];
  for (const r of topRepos) {
    if (results.length >= max) break;
    const url =
      `https://api.github.com/repos/${r.repository.nameWithOwner}/commits` +
      `?author=${encodeURIComponent(login)}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=30`;
    try {
      const commitsRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!commitsRes.ok) continue;
      const commits = (await commitsRes.json()) as Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { date: string };
        };
      }>;
      for (const c of commits) {
        if (results.length >= max) break;
        results.push({
          sha: c.sha,
          message: c.commit.message.split("\n")[0].slice(0, 280),
          repo: r.repository.nameWithOwner,
          url: c.html_url,
          committedAt: c.commit.author.date,
        });
      }
    } catch {
      // Skip unreachable repos and keep going
      continue;
    }
  }

  // Sort newest-first so display is stable
  results.sort(
    (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
  );

  return results;
}
