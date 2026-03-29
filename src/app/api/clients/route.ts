import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";
import { getApplicableRate, calculateEarnings } from "@/lib/earnings";

export async function GET() {
  try {
    const user = await getDefaultUser();

    const clients = await prisma.client.findMany({
      where: { userId: user.id },
      include: {
        projects: {
          include: {
            timeEntries: {
              select: {
                duration: true,
                billable: true,
              },
              where: { duration: { not: null } },
            },
          },
        },
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = clients.map((client) => {
      let totalHours = 0;
      let totalEarnings = 0;

      client.projects.forEach((project) => {
        const rate = getApplicableRate(project.hourlyRate, user.defaultHourlyRate);
        project.timeEntries.forEach((entry) => {
          const duration = entry.duration || 0;
          totalHours += duration;
          totalEarnings += calculateEarnings(duration, rate, entry.billable);
        });
      });

      const { projects, ...rest } = client;
      return {
        ...rest,
        projectCount: client._count.projects,
        totalHours,
        totalEarnings,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getDefaultUser();
    const body = await request.json();
    const { name, email, notes } = body;

    const client = await prisma.client.create({
      data: {
        name,
        email: email || null,
        notes: notes || null,
        userId: user.id,
      },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    return NextResponse.json(
      { ...client, projectCount: 0, totalHours: 0, totalEarnings: 0 },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
