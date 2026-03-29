import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const user = await getDefaultUser();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: true,
        _count: {
          select: { timeEntries: true },
        },
        timeEntries: {
          select: { duration: true },
          where: { duration: { not: null } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = projects.map((project) => {
      const totalSeconds = project.timeEntries.reduce(
        (sum, entry) => sum + (entry.duration || 0),
        0
      );
      const { timeEntries, ...rest } = project;
      return { ...rest, totalSeconds };
    });

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
  try {
    const user = await getDefaultUser();
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
