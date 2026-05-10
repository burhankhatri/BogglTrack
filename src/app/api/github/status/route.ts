import { NextResponse } from "next/server";
import { requireUserOrErrorResponse } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/github/status — returns { connected: boolean, login?, avatarUrl?, name? }
// Public metadata only; never the access token.
export async function GET() {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

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
