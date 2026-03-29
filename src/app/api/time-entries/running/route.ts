import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

export async function GET() {
  try {
    const user = await getDefaultUser();

    const entry = await prisma.timeEntry.findFirst({
      where: {
        userId: user.id,
        endTime: null,
      },
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
    console.error("Failed to fetch running entry:", error);
    return NextResponse.json(
      { error: "Failed to fetch running entry" },
      { status: 500 }
    );
  }
}
