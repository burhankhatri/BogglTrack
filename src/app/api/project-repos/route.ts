import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/project-repos — all repo links for the signed-in user's projects.
// Used by the canvas to render repo nodes.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
