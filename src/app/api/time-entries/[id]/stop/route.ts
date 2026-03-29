import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getDefaultUser();

    const existing = await prisma.timeEntry.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    if (existing.endTime) {
      return NextResponse.json(
        { error: "Time entry is already stopped" },
        { status: 400 }
      );
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - existing.startTime.getTime()) / 1000
    );

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: { endTime, duration },
      include: {
        project: {
          include: { client: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to stop time entry:", error);
    return NextResponse.json(
      { error: "Failed to stop time entry" },
      { status: 500 }
    );
  }
}
