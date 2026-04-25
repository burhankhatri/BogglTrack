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
    /** Optional per-line commits rendered as indented sub-rows under the item. */
    commits?: { sha: string; message: string; repo: string; url?: string }[];
  }[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  workSummary?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
}

const PAPER: [number, number, number] = [247, 243, 230]; // warm cream
const INK: [number, number, number] = [0, 0, 0];
const MUTED_INK: [number, number, number] = [72, 72, 72];
const RULE: [number, number, number] = [120, 116, 104];
const MAX_LINE_ITEMS_ON_PAGE = 12;
const MAX_WORK_SUMMARY_LINES = 4;
const MAX_COMMIT_LINES = 6;
const MAX_FOOTER_LINES = 5;

function splitText(doc: jsPDF, text: string, width: number): string[] {
  return doc.splitTextToSize(text, width) as string[];
}

function wrapPlainText(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function capLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const capped = lines.slice(0, maxLines);
  capped[maxLines - 1] = `${capped[maxLines - 1].replace(/\.*$/, "")}...`;
  return capped;
}

export function prepareSinglePageInvoiceContent(data: InvoicePDFData) {
  const allCommitLines = data.lineItems.flatMap((item) =>
    (item.commits ?? []).map(
      (commit) =>
        `${commit.sha.slice(0, 7)} · ${item.description}: ${commit.message}`
    )
  );

  const paymentText = [data.paymentTerms, data.notes].filter(Boolean).join("\n");
  const senderText = [
    data.senderAddress,
    data.senderEmail,
    data.senderTaxId ? `Tax ID: ${data.senderTaxId}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    lineItems: data.lineItems.slice(0, MAX_LINE_ITEMS_ON_PAGE),
    omittedLineItemCount: Math.max(0, data.lineItems.length - MAX_LINE_ITEMS_ON_PAGE),
    workSummaryLines: capLines(
      wrapPlainText(data.workSummary ?? "", 120),
      MAX_WORK_SUMMARY_LINES
    ),
    commitLines: capLines(allCommitLines, MAX_COMMIT_LINES),
    omittedCommitCount: Math.max(0, allCommitLines.length - MAX_COMMIT_LINES),
    paymentLines: capLines(wrapPlainText(paymentText, 54), MAX_FOOTER_LINES),
    senderLines: capLines(wrapPlainText(senderText, 54), MAX_FOOTER_LINES),
  };
}

export function generateInvoicePDF(data: InvoicePDFData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const rightX = pageWidth - margin;
  const money = (amount: number) => `${data.currencySymbol}${amount.toFixed(2)}`;
  const fitted = prepareSinglePageInvoiceContent(data);
  let y = margin;

  const paintBackground = () => {
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  };

  const rule = (lineY: number) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(margin, lineY, rightX, lineY);
  };

  const renderTableHeader = () => {
    rule(y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text("Description", margin, y);
    doc.text("Rate", margin + 112, y, { align: "right" });
    doc.text("Hours", margin + 142, y, { align: "right" });
    doc.text("Amount", rightX, y, { align: "right" });
    y += 4;
    rule(y);
    y += 7;
    doc.setFont("helvetica", "normal");
  };

  paintBackground();

  // --- HEADER ---
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(50);
  doc.text("Invoice", margin, y + 24);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.issueDate, rightX, y + 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice No. ${data.number}`, rightX, y + 22, { align: "right" });

  y += 48;
  rule(y);
  y += 9;

  // --- BILLED TO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Billed to:", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  const billedLines = [
    data.recipientName,
    data.recipientEmail,
    data.recipientAddress,
  ]
    .filter(Boolean)
    .flatMap((value) => splitText(doc, String(value), 80));
  for (const line of billedLines) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 5;
  rule(y);

  // --- LINE ITEMS TABLE ---
  y = Math.max(y + 48, 126);
  renderTableHeader();

  doc.setFontSize(fitted.lineItems.length > 10 ? 8 : 9);
  for (const item of fitted.lineItems) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const descriptionLines = splitText(doc, item.description, 92).slice(0, 2);
    const rowHeight = Math.max(6, descriptionLines.length * 4.2);

    doc.text(descriptionLines, margin, y);
    doc.text(`${money(item.rate)}/hr`, margin + 112, y, { align: "right" });
    doc.text(item.quantity.toFixed(1), margin + 142, y, { align: "right" });
    doc.text(money(item.amount), rightX, y, { align: "right" });

    y += rowHeight;
    rule(y - 1.5);
    y += 2.2;
  }

  if (fitted.omittedLineItemCount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_INK);
    doc.text(
      `+ ${fitted.omittedLineItemCount} additional line items included in totals`,
      margin,
      y
    );
    y += 5;
  }

  // --- TOTALS ---
  y += 2;
  const totalsLabelX = rightX - 48;
  const totalsAmountX = rightX - 8;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...INK);
    doc.text(label, totalsLabelX, y, { align: "right" });
    doc.text(value, totalsAmountX, y, { align: "right" });
    y += 7;
  };

  totalRow("Subtotal", money(data.subtotal), true);
  if (data.discountPercent > 0) {
    totalRow(`Discount (${data.discountPercent}%)`, `-${money(data.discountAmount)}`, true);
  }
  totalRow(`Tax (${data.taxRate}%)`, money(data.taxAmount), true);
  doc.setDrawColor(...RULE);
  doc.line(totalsLabelX - 28, y - 3, rightX, y - 3);
  totalRow("Total", money(data.total), true);

  // --- SECONDARY WORK DETAIL ---
  if (fitted.workSummaryLines.length > 0 || fitted.commitLines.length > 0) {
    y += 6;
    if (y > 218) y = 218;
    rule(y);
    y += 6;
    doc.setFontSize(7.5);

    if (fitted.workSummaryLines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text("Work Summary", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED_INK);
      doc.text(fitted.workSummaryLines, margin, y);
      y += fitted.workSummaryLines.length * 3.6 + 4;
    }

    if (fitted.commitLines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text("Work Details", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED_INK);
      for (const line of fitted.commitLines) {
        doc.text(splitText(doc, line, contentWidth).slice(0, 1), margin, y);
        y += 3.6;
      }
      if (fitted.omittedCommitCount > 0) {
        doc.text(`+ ${fitted.omittedCommitCount} more commits`, margin, y);
        y += 3.6;
      }
    }
  }

  // --- FOOTER ---
  y = pageHeight - 58;

  rule(y);
  y += 10;

  const footerStartY = y;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Payment Information", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const line of fitted.paymentLines) {
    doc.text(line, margin, y);
    y += 5;
  }

  let senderY = footerStartY;
  const senderX = margin + contentWidth / 2 + 8;
  if (data.senderName) {
    doc.setFont("helvetica", "bold");
    doc.text(data.senderName, senderX, senderY);
    senderY += 7;
  }
  doc.setFont("helvetica", "normal");
  for (const line of fitted.senderLines) {
    doc.text(line, senderX, senderY);
    senderY += 5;
  }

  y = Math.max(y, senderY) + 8;
  rule(y);

  // Download
  doc.save(`invoice-${data.number}-${data.issueDate}.pdf`);
}
