import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        client: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Auto-generate invoice number if not provided
    let invoiceNumber = body.number;
    if (!invoiceNumber) {
      const count = await prisma.invoice.count({
        where: { userId: user.id },
      });
      invoiceNumber = `INV-${String(count + 1).padStart(4, "0")}`;
    }

    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        status: body.status || "draft",
        issueDate: new Date(body.issueDate),
        dueDate: new Date(body.dueDate),
        currency: body.currency,
        currencySymbol: body.currencySymbol,
        subtotal: body.subtotal,
        taxRate: body.taxRate || 0,
        taxAmount: body.taxAmount || 0,
        discountPercent: body.discountPercent || 0,
        discountAmount: body.discountAmount || 0,
        total: body.total,
        notes: body.notes || null,
        paymentTerms: body.paymentTerms || null,
        senderName: body.senderName || null,
        senderAddress: body.senderAddress || null,
        senderEmail: body.senderEmail || null,
        senderTaxId: body.senderTaxId || null,
        recipientName: body.recipientName || null,
        recipientAddress: body.recipientAddress || null,
        recipientEmail: body.recipientEmail || null,
        workSummary: body.workSummary || null,
        clientId: body.clientId || null,
        userId: user.id,
        lineItems: {
          create: (body.lineItems || []).map(
            (
              item: {
                description: string;
                quantity: number;
                rate: number;
                amount: number;
                sortOrder?: number;
                timeEntryId?: string;
              },
              index: number
            ) => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              sortOrder: item.sortOrder ?? index,
              timeEntryId: item.timeEntryId || null,
            })
          ),
        },
      },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        client: true,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
