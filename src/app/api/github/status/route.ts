import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/github/status — returns { connected: boolean, login?, avatarUrl?, name? }
// Public metadata only; never the access token.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await prisma.gitHubAccount.findUnique({
    where: { userId: user.id },
    select: {
      githubLogin: true,
      githubName: true,
      githubAvatarUrl: true,
      scope: true,
      connectedAt: true,
      lastSyncedAt: true,
    },
  });

  if (!account) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    login: account.githubLogin,
    name: account.githubName,
    avatarUrl: account.githubAvatarUrl,
    scope: account.scope,
    connectedAt: account.connectedAt,
    lastSyncedAt: account.lastSyncedAt,
  });
}
