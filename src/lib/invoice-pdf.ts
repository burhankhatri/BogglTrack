import jsPDF from "jspdf";

export interface InvoicePDFData {
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  senderName?: string | null;
  senderAddress?: string | null;
  senderEmail?: string | null;
  senderTaxId?: string | null;
  recipientName?: string | null;
  recipientAddress?: string | null;
  recipientEmail?: string | null;
  lineItems: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  paymentTerms?: string | null;
}

const ACCENT: [number, number, number] = [22, 163, 74]; // #16A34A — accent-teal
const TEXT_PRIMARY: [number, number, number] = [26, 26, 46]; // #1A1A2E — text-forest
const TEXT_SECONDARY: [number, number, number] = [107, 114, 128]; // #6B7280 — text-olive
const HEADER_BG: [number, number, number] = [26, 26, 46]; // dark header for table

export function generateInvoicePDF(data: InvoicePDFData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- HEADER ---
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text("INVOICE", margin, y + 8);

  // Invoice details (right-aligned)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_SECONDARY);
  const rightX = pageWidth - margin;
  doc.text(data.number, rightX, y, { align: "right" });
  y += 6;
  doc.text(`Issued: ${data.issueDate}`, rightX, y, { align: "right" });
  y += 5;
  doc.text(`Due: ${data.dueDate}`, rightX, y, { align: "right" });

  y += 12;

  // --- SENDER / RECIPIENT ---
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const colWidth = contentWidth / 2;

  // Sender
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text("FROM", margin, y);

  // Recipient
  doc.text("BILL TO", margin + colWidth, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_PRIMARY);

  if (data.senderName) {
    doc.text(data.senderName, margin, y);
  }
  if (data.recipientName) {
    doc.text(data.recipientName, margin + colWidth, y);
  }
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_SECONDARY);

  let senderY = y;
  let recipientY = y;

  if (data.senderAddress) {
    const lines = doc.splitTextToSize(data.senderAddress, colWidth - 10);
    doc.text(lines, margin, senderY);
    senderY += lines.length * 4;
  }
  if (data.senderEmail) {
    doc.text(data.senderEmail, margin, senderY);
    senderY += 4;
  }
  if (data.senderTaxId) {
    doc.text(`Tax ID: ${data.senderTaxId}`, margin, senderY);
    senderY += 4;
  }

  if (data.recipientAddress) {
    const lines = doc.splitTextToSize(data.recipientAddress, colWidth - 10);
    doc.text(lines, margin + colWidth, recipientY);
    recipientY += lines.length * 4;
  }
  if (data.recipientEmail) {
    doc.text(data.recipientEmail, margin + colWidth, recipientY);
    recipientY += 4;
  }

  y = Math.max(senderY, recipientY) + 10;

  // --- LINE ITEMS TABLE ---
  const colWidths = [10, contentWidth - 80, 20, 25, 25];
  const headers = ["#", "Description", "Qty", "Rate", "Amount"];

  // Table header
  doc.setFillColor(...HEADER_BG);
  doc.rect(margin, y - 4, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);

  let x = margin + 2;
  headers.forEach((h, i) => {
    const align = i >= 2 ? "right" : "left";
    const textX = i >= 2 ? x + colWidths[i] - 2 : x;
    doc.text(h, textX, y, { align });
    x += colWidths[i];
  });

  y += 7;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  data.lineItems.forEach((item, index) => {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }

    // Alternating row background
    if (index % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 4, contentWidth, 7, "F");
    }

    doc.setTextColor(...TEXT_PRIMARY);
    x = margin + 2;

    // #
    doc.text(String(index + 1), x, y);
    x += colWidths[0];

    // Description (truncate if too long)
    const desc = item.description.length > 60
      ? item.description.substring(0, 57) + "..."
      : item.description;
    doc.text(desc, x, y);
    x += colWidths[1];

    // Qty (right-aligned)
    doc.text(item.quantity.toFixed(1), x + colWidths[2] - 2, y, { align: "right" });
    x += colWidths[2];

    // Rate (right-aligned)
    doc.text(`${data.currencySymbol}${item.rate.toFixed(2)}`, x + colWidths[3] - 2, y, { align: "right" });
    x += colWidths[3];

    // Amount (right-aligned)
    doc.text(`${data.currencySymbol}${item.amount.toFixed(2)}`, x + colWidths[4] - 2, y, { align: "right" });

    y += 7;
  });

  y += 5;

  // --- TOTALS ---
  doc.setDrawColor(230, 230, 230);
  doc.line(margin + contentWidth - 80, y, margin + contentWidth, y);
  y += 6;

  const totalsX = margin + contentWidth - 80;
  const amountX = margin + contentWidth;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_SECONDARY);

  // Subtotal
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(`${data.currencySymbol}${data.subtotal.toFixed(2)}`, amountX, y, { align: "right" });
  y += 6;

  // Discount (if any)
  if (data.discountPercent > 0) {
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`Discount (${data.discountPercent}%)`, totalsX, y);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(`-${data.currencySymbol}${data.discountAmount.toFixed(2)}`, amountX, y, { align: "right" });
    y += 6;
  }

  // Tax (if any)
  if (data.taxRate > 0) {
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`Tax (${data.taxRate}%)`, totalsX, y);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(`${data.currencySymbol}${data.taxAmount.toFixed(2)}`, amountX, y, { align: "right" });
    y += 6;
  }

  // Total
  y += 2;
  doc.setDrawColor(230, 230, 230);
  doc.line(totalsX, y - 3, amountX, y - 3);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text("TOTAL", totalsX, y + 2);
  doc.text(`${data.currencySymbol}${data.total.toFixed(2)}`, amountX, y + 2, { align: "right" });

  y += 16;

  // --- NOTES & PAYMENT TERMS ---
  if (data.notes || data.paymentTerms) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(9);

    if (data.notes) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text("Notes", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_PRIMARY);
      const noteLines = doc.splitTextToSize(data.notes, contentWidth);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 4 + 4;
    }

    if (data.paymentTerms) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text("Payment Terms", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_PRIMARY);
      const termLines = doc.splitTextToSize(data.paymentTerms, contentWidth);
      doc.text(termLines, margin, y);
    }
  }

  // --- FOOTER ---
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("Generated by BogglTrack", pageWidth / 2, footerY, { align: "center" });

  // Download
  doc.save(`invoice-${data.number}-${data.issueDate}.pdf`);
}
