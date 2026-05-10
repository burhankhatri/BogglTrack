import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/projects/:id/repos — list linked repos for a project
// POST /api/projects/:id/repos { repoFullName } — link a new repo
// DELETE /api/projects/:id/repos?repoFullName=owner/name — unlink

async function assertOwnsProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return !!project;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;
  const { id } = await params;
  if (!(await assertOwnsProject(user.id, id))) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const repos = await prisma.projectRepo.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, repoFullName: true, createdAt: true },
  });
  return NextResponse.json(repos);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;
  const { id } = await params;
  if (!(await assertOwnsProject(user.id, id))) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const body = (await req.json()) as { repoFullName?: string };
  const repoFullName = body.repoFullName?.trim();
  if (!repoFullName || !/^[^/]+\/[^/]+$/.test(repoFullName)) {
    return NextResponse.json(
      { error: "repoFullName must be 'owner/name'" },
      { status: 400 }
    );
  }

  try {
    const row = await prisma.projectRepo.create({
      data: { projectId: id, repoFullName },
      select: { id: true, repoFullName: true, createdAt: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    // Unique violation → already linked. Return the existing row.
    const existing = await prisma.projectRepo.findFirst({
      where: { projectId: id, repoFullName },
      select: { id: true, repoFullName: true, createdAt: true },
    });
    if (existing) return NextResponse.json(existing);
    console.error("[projects/repos POST]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;
  const { id } = await params;
  if (!(await assertOwnsProject(user.id, id))) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const repoFullName = url.searchParams.get("repoFullName");
  if (!repoFullName) {
    return NextResponse.json({ error: "missing repoFullName" }, { status: 400 });
  }
  await prisma.projectRepo.deleteMany({
    where: { projectId: id, repoFullName },
  });
  return NextResponse.json({ ok: true });
}
