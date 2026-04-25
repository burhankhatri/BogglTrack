import { describe, expect, it } from "vitest";
import {
  buildInvoicePDFDoc,
  prepareSinglePageInvoiceContent,
  type InvoicePDFData,
} from "../invoice-pdf";

function makeInvoice(overrides: Partial<InvoicePDFData> = {}): InvoicePDFData {
  return {
    number: "INV-0001",
    issueDate: "Apr 26, 2026",
    dueDate: "May 26, 2026",
    currency: "USD",
    currencySymbol: "$",
    recipientName: "Client",
    lineItems: Array.from({ length: 30 }, (_, index) => ({
      description: `Line item ${index + 1}`,
      quantity: 1,
      rate: 100,
      amount: 100,
      commits: [
        {
          sha: `abcdef${index}`,
          message: `Commit message ${index + 1}`,
          repo: "owner/repo",
        },
      ],
    })),
    subtotal: 3000,
    discountPercent: 0,
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 3000,
    workSummary:
      "Long summary. ".repeat(80),
    paymentTerms:
      "Payment terms line. ".repeat(40),
    notes:
      "Notes line. ".repeat(40),
    senderName: "Sender",
    senderAddress:
      "Sender address line. ".repeat(40),
    ...overrides,
  };
}

describe("prepareSinglePageInvoiceContent", () => {
  it("caps invoice sections so the PDF renderer can stay on one page", () => {
    const content = prepareSinglePageInvoiceContent(makeInvoice());

    expect(content.lineItems).toHaveLength(10);
    expect(content.omittedLineItemCount).toBe(20);
    expect(content.workSummaryLines.length).toBeLessThanOrEqual(4);
    expect(content.commitLines.length).toBeLessThanOrEqual(6);
    expect(content.paymentLines.length).toBeLessThanOrEqual(5);
    expect(content.senderLines.length).toBeLessThanOrEqual(5);
  });
});

describe("buildInvoicePDFDoc", () => {
  it("produces exactly one page with worst-case data (30 items, long summary, many commits)", () => {
    const doc = buildInvoicePDFDoc(makeInvoice());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("produces exactly one page with a typical small invoice", () => {
    const doc = buildInvoicePDFDoc(
      makeInvoice({
        lineItems: [
          { description: "Frontend work", quantity: 4, rate: 100, amount: 400 },
          { description: "Backend API", quantity: 6, rate: 100, amount: 600 },
        ],
        subtotal: 1000,
        total: 1000,
        workSummary: "Implemented auth flow and dashboard tweaks.",
        paymentTerms: "Net 30",
        notes: "Thanks!",
        senderAddress: "123 Main St\nNew York, NY 10001",
      })
    );
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("produces exactly one page with no work summary or commits", () => {
    const doc = buildInvoicePDFDoc(
      makeInvoice({
        workSummary: null,
        lineItems: Array.from({ length: 10 }, (_, i) => ({
          description: `Item ${i + 1}`,
          quantity: 1,
          rate: 50,
          amount: 50,
        })),
        subtotal: 500,
        total: 500,
      })
    );
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
