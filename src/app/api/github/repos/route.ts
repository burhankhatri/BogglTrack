import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { decryptToken } from "@/lib/github/crypto";

export const dynamic = "force-dynamic";

// GET /api/github/repos?q=<search>
// Returns up to 50 repos the signed-in user has access to, sorted by most
// recently pushed. Used to populate the repo-picker on the project page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await prisma.gitHubAccount.findUnique({
    where: { userId: user.id },
    select: { accessToken: true },
  });
  if (!account) {
    return NextResponse.json({ error: "not-connected" }, { status: 400 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";

  try {
    const token = decryptToken(account.accessToken);
    const res = await fetch(
      "https://api.github.com/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `github-${res.status}` },
        { status: res.status }
      );
    }
    const repos = (await res.json()) as Array<{
      full_name: string;
      private: boolean;
      pushed_at: string;
      description: string | null;
    }>;
    const filtered = q
      ? repos.filter((r) => r.full_name.toLowerCase().includes(q))
      : repos;
    return NextResponse.json(
      filtered.slice(0, 50).map((r) => ({
        fullName: r.full_name,
        private: r.private,
        pushedAt: r.pushed_at,
        description: r.description,
      }))
    );
  } catch (e) {
    console.error("[github/repos]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
