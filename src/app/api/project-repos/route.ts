import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/project-repos — all repo links for the signed-in user's projects.
// Used by the canvas to render repo nodes.
export async function GET() {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  const repos = await prisma.projectRepo.findMany({
    where: { project: { userId: user.id } },
    select: {
      id: true,
      repoFullName: true,
      projectId: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(repos);
}
