import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { pickTimeEntryIdsToMark } from "./helpers";

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

    // Read explicit timeEntryIds from the body when present (grouped-mode
    // line items have null timeEntryId, so the legacy derivation misses
    // them — the page now sends the full source list).
    const body = await request.json().catch(() => ({}));
    const timeEntryIds = pickTimeEntryIdsToMark(invoice, body);

    await prisma.$transaction([
      // Mark invoice as sent
      prisma.invoice.update({
        where: { id },
        data: { status: "sent" },
      }),
      // Mark linked time entries as invoiced. Scope by userId for
      // defense-in-depth — even though IDs come from the user, never let
      // them mark another user's entries.
      ...(timeEntryIds.length > 0
        ? [
            prisma.timeEntry.updateMany({
              where: { id: { in: timeEntryIds }, userId: user.id },
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
