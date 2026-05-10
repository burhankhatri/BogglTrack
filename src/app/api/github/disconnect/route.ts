import { NextResponse } from "next/server";
import { requireUserOrErrorResponse } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/github/disconnect — removes the GitHub link for the current user.
// We don't revoke the token on GitHub's side; the user can do that from their
// GitHub settings → Applications if they want a full revoke.
export async function POST() {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  await prisma.gitHubAccount.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
