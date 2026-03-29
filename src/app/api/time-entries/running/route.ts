import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
