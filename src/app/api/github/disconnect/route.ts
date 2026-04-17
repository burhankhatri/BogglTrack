import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/github/disconnect — removes the GitHub link for the current user.
// We don't revoke the token on GitHub's side; the user can do that from their
// GitHub settings → Applications if they want a full revoke.
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await prisma.gitHubAccount.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
