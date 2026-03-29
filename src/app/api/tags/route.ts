import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {

    const tags = await prisma.tag.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { timeEntries: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = tags.map((tag) => ({
      ...tag,
      usageCount: tag._count.timeEntries,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
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
    const { name, color } = body;

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || "#6B7280",
        userId: user.id,
      },
      include: {
        _count: {
          select: { timeEntries: true },
        },
      },
    });

    return NextResponse.json(
      { ...tag, usageCount: 0 },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
