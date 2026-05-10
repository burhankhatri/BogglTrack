import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const { id } = await params;

    const existing = await prisma.descriptionRule.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    await prisma.descriptionRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete description rule:", error);
    return NextResponse.json(
      { error: "Failed to delete description rule" },
      { status: 500 }
    );
  }
}
