import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { validateRuleBody } from "./helpers";

export async function GET() {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const rules = await prisma.descriptionRule.findMany({
      where: { userId: user.id },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Failed to fetch description rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch description rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const body = await request.json();
    const validationError = validateRuleBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { description, projectId } = body as {
      description: string;
      projectId: string;
    };

    // Upsert the rule
    const rule = await prisma.descriptionRule.upsert({
      where: {
        description_userId: { description, userId: user.id },
      },
      create: {
        description,
        projectId,
        userId: user.id,
      },
      update: {
        projectId,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Bulk-update all existing time entries with this description
    const result = await prisma.timeEntry.updateMany({
      where: {
        description,
        userId: user.id,
      },
      data: {
        projectId,
      },
    });

    return NextResponse.json({
      rule,
      entriesUpdated: result.count,
    });
  } catch (error) {
    console.error("Failed to create description rule:", error);
    return NextResponse.json(
      { error: "Failed to create description rule" },
      { status: 500 }
    );
  }
}
