import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      include: { lineItems: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Invoice is already finalized" },
        { status: 400 }
      );
    }

    // Collect all time entry IDs linked via line items
    const timeEntryIds = invoice.lineItems
      .map((item) => item.timeEntryId)
      .filter((id): id is string => id !== null);

    await prisma.$transaction([
      // Mark invoice as sent
      prisma.invoice.update({
        where: { id },
        data: { status: "sent" },
      }),
      // Mark linked time entries as invoiced
      ...(timeEntryIds.length > 0
        ? [
            prisma.timeEntry.updateMany({
              where: { id: { in: timeEntryIds } },
              data: { invoiceId: id },
            }),
          ]
        : []),
    ]);

    const updated = await prisma.invoice.findFirst({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        client: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to finalize invoice:", error);
    return NextResponse.json(
      { error: "Failed to finalize invoice" },
      { status: 500 }
    );
  }
}
