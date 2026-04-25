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

function splitText(doc: jsPDF, text: string, width: number): string[] {
  return doc.splitTextToSize(text, width) as string[];
}

export function generateInvoicePDF(data: InvoicePDFData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const rightX = pageWidth - margin;
  const money = (amount: number) => `${data.currencySymbol}${amount.toFixed(2)}`;
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

  const addPage = () => {
    doc.addPage();
    paintBackground();
    y = margin;
  };

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - margin) addPage();
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

  doc.setFontSize(9);
  for (const item of data.lineItems) {
    ensureSpace(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const descriptionLines = splitText(doc, item.description, 92);
    const rowHeight = Math.max(8, descriptionLines.length * 5);

    doc.text(descriptionLines, margin, y);
    doc.text(`${money(item.rate)}/hr`, margin + 112, y, { align: "right" });
    doc.text(item.quantity.toFixed(1), margin + 142, y, { align: "right" });
    doc.text(money(item.amount), rightX, y, { align: "right" });

    y += rowHeight;
    rule(y - 2);
    y += 3;
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
  const commits = data.lineItems.flatMap((item) =>
    (item.commits ?? []).map((commit) => ({ ...commit, lineDescription: item.description }))
  );
  if (data.workSummary || commits.length > 0) {
    y += 10;
    ensureSpace(35);
    rule(y);
    y += 8;
    doc.setFontSize(8);

    if (data.workSummary) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text("Work Summary", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED_INK);
      const summaryLines = splitText(doc, data.workSummary, contentWidth);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 4 + 5;
    }

    if (commits.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text("Work Details", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED_INK);
      for (const commit of commits.slice(0, 12)) {
        ensureSpace(5);
        const line = `${commit.sha.slice(0, 7)} · ${commit.lineDescription}: ${commit.message}`;
        doc.text(splitText(doc, line, contentWidth), margin, y);
        y += 4;
      }
      if (commits.length > 12) {
        doc.text(`+ ${commits.length - 12} more commits`, margin, y);
        y += 4;
      }
    }
  }

  // --- FOOTER ---
  const footerTop = Math.max(y + 20, pageHeight - 58);
  if (footerTop + 42 > pageHeight - margin) addPage();
  else y = footerTop;

  rule(y);
  y += 10;

  const footerColWidth = contentWidth / 2 - 10;
  const footerStartY = y;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Payment Information", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const paymentLines = [data.paymentTerms, data.notes]
    .filter(Boolean)
    .flatMap((value) => splitText(doc, String(value), footerColWidth));
  for (const line of paymentLines) {
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
  const senderLines = [
    data.senderAddress,
    data.senderEmail,
    data.senderTaxId ? `Tax ID: ${data.senderTaxId}` : null,
  ]
    .filter(Boolean)
    .flatMap((value) => splitText(doc, String(value), footerColWidth));
  for (const line of senderLines) {
    doc.text(line, senderX, senderY);
    senderY += 5;
  }

  y = Math.max(y, senderY) + 8;
  rule(y);

  // Download
  doc.save(`invoice-${data.number}-${data.issueDate}.pdf`);
}
