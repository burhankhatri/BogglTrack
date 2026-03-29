import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const entry = await prisma.timeEntry.findFirst({
      where: { id, userId: user.id },
      include: {
        project: {
          include: { client: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to fetch time entry:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entry" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { tagIds, description, startTime, endTime, billable, projectId } = body;

    // Verify ownership
    const existing = await prisma.timeEntry.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    // Build whitelisted update data
    const updateData: Record<string, unknown> = {};
    if (description !== undefined) updateData.description = description;
    if (billable !== undefined) updateData.billable = billable;
    if (projectId !== undefined) updateData.projectId = projectId;

    // Handle date fields and recompute duration
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);

    if (startTime !== undefined || endTime !== undefined) {
      const resolvedStart = startTime ? new Date(startTime) : existing.startTime;
      const resolvedEnd = endTime ? new Date(endTime) : existing.endTime;
      if (resolvedEnd) {
        updateData.duration = Math.floor(
          (resolvedEnd.getTime() - resolvedStart.getTime()) / 1000
        );
      }
    }

    // Handle tag updates
    if (tagIds !== undefined) {
      await prisma.timeEntryTag.deleteMany({
        where: { timeEntryId: id },
      });

      if (tagIds.length > 0) {
        await prisma.timeEntryTag.createMany({
          data: tagIds.map((tagId: string) => ({
            timeEntryId: id,
            tagId,
          })),
        });
      }
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: updateData,
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
    console.error("Failed to update time entry:", error);
    return NextResponse.json(
      { error: "Failed to update time entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    await prisma.timeEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete time entry:", error);
    return NextResponse.json(
      { error: "Failed to delete time entry" },
      { status: 500 }
    );
  }
}
