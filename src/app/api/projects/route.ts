import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;

    const [projects, durations] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          client: true,
          _count: {
            select: { timeEntries: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.timeEntry.groupBy({
        by: ["projectId"],
        where: { userId: user.id, duration: { not: null } },
        _sum: { duration: true },
      }),
    ]);

    const durationMap = new Map(
      durations.map((d) => [d.projectId, d._sum.duration ?? 0])
    );

    const result = projects.map((project) => ({
      ...project,
      totalSeconds: durationMap.get(project.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, color, hourlyRate, estimatedHours, clientId } = body;

    const project = await prisma.project.create({
      data: {
        name,
        color: color || "#4F46E5",
        hourlyRate: hourlyRate ?? null,
        estimatedHours: estimatedHours ?? null,
        clientId: clientId || null,
        userId: user.id,
      },
      include: {
        client: true,
        _count: {
          select: { timeEntries: true },
        },
      },
    });

    return NextResponse.json({ ...project, totalSeconds: 0 }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
