import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";

export async function GET() {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {

    const entry = await prisma.timeEntry.findFirst({
      where: {
        userId: user.id,
        endTime: null,
      },
      include: {
        project: {
          include: { client: true },
        },
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to fetch running entry:", error);
    return NextResponse.json(
      { error: "Failed to fetch running entry" },
      { status: 500 }
    );
  }
}
