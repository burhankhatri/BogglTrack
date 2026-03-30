import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {

    const clients = await prisma.client.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const clientIds = clients.map((c) => c.id);

    // Single SQL aggregation for all clients' time stats
    const stats =
      clientIds.length > 0
        ? await prisma.$queryRaw<
            { clientId: string; total_hours: number; total_earnings: number }[]
          >`
            SELECT p."clientId" as "clientId",
                   COALESCE(SUM(te.duration), 0) as total_hours,
                   COALESCE(SUM(CASE WHEN te.billable THEN te.duration * COALESCE(p."hourlyRate", ${user.defaultHourlyRate}) / 3600.0 ELSE 0 END), 0) as total_earnings
            FROM "TimeEntry" te
            JOIN "Project" p ON te."projectId" = p.id
            WHERE p."clientId" = ANY(${clientIds})
              AND te.duration IS NOT NULL
            GROUP BY p."clientId"
          `
        : [];

    const statsMap = new Map(
      stats.map((s) => [s.clientId, { totalHours: Number(s.total_hours), totalEarnings: Math.round(Number(s.total_earnings) * 100) / 100 }])
    );

    const result = clients.map((client) => {
      const s = statsMap.get(client.id);
      return {
        ...client,
        projectCount: client._count.projects,
        totalHours: s?.totalHours ?? 0,
        totalEarnings: s?.totalEarnings ?? 0,
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
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
