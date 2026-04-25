import { describe, expect, it } from "vitest";
import {
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

    expect(content.lineItems).toHaveLength(12);
    expect(content.omittedLineItemCount).toBe(18);
    expect(content.workSummaryLines.length).toBeLessThanOrEqual(4);
    expect(content.commitLines.length).toBeLessThanOrEqual(6);
    expect(content.paymentLines.length).toBeLessThanOrEqual(5);
    expect(content.senderLines.length).toBeLessThanOrEqual(5);
  });
});
