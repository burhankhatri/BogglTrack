import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getDefaultUser();

    const tag = await prisma.tag.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: { timeEntries: true },
        },
      },
    });

    if (!tag) {
      return NextResponse.json(
        { error: "Tag not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...tag, usageCount: tag._count.timeEntries });
  } catch (error) {
    console.error("Failed to fetch tag:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getDefaultUser();
    const body = await request.json();

    const existing = await prisma.tag.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Tag not found" },
        { status: 404 }
      );
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: body,
      include: {
        _count: {
          select: { timeEntries: true },
        },
      },
    });

    return NextResponse.json({ ...tag, usageCount: tag._count.timeEntries });
  } catch (error) {
    console.error("Failed to update tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getDefaultUser();

    const existing = await prisma.tag.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Tag not found" },
        { status: 404 }
      );
    }

    await prisma.tag.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
