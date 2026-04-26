import { describe, expect, it } from "vitest";
import { pickTimeEntryIdsToMark } from "../helpers";

describe("pickTimeEntryIdsToMark", () => {
  it("uses explicit body.timeEntryIds when provided", () => {
    // This is the path the page now takes — it sends the full set of
    // selected source entries so grouped-mode invoices mark every entry,
    // not just the ones that happened to back a line item.
    const invoice = { lineItems: [{ timeEntryId: null }] };
    const body = { timeEntryIds: ["e-1", "e-2"] };
    expect(pickTimeEntryIdsToMark(invoice, body)).toEqual(["e-1", "e-2"]);
  });

  it("falls back to lineItems[].timeEntryId when body has none (legacy clients)", () => {
    const invoice = {
      lineItems: [
        { timeEntryId: "e-1" },
        { timeEntryId: null },
        { timeEntryId: "e-2" },
      ],
    };
    expect(pickTimeEntryIdsToMark(invoice, {})).toEqual(["e-1", "e-2"]);
  });

  it("filters out non-string ids when using body", () => {
    const invoice = { lineItems: [] };
    const body = { timeEntryIds: ["e-1", null, "e-2", undefined, 42] };
    expect(pickTimeEntryIdsToMark(invoice, body)).toEqual(["e-1", "e-2"]);
  });

  it("returns empty array for malformed body and no line items", () => {
    expect(pickTimeEntryIdsToMark({ lineItems: [] }, {})).toEqual([]);
    expect(
      pickTimeEntryIdsToMark({ lineItems: [] }, { timeEntryIds: "not array" })
    ).toEqual([]);
  });

  it("regression: grouped-mode invoice with body.timeEntryIds marks every source entry", () => {
    // Bug repro: pre-fix, the line items had timeEntryId: null because
    // grouped mode collapses entries, so finalize marked NOTHING and the
    // uninvoiced filter still listed them.
    const invoice = {
      lineItems: [
        { timeEntryId: null }, // grouped "Frontend work" merged 3 entries
        { timeEntryId: null }, // grouped "Backend work" merged 2 entries
      ],
    };
    const body = { timeEntryIds: ["src-1", "src-2", "src-3", "src-4", "src-5"] };
    expect(pickTimeEntryIdsToMark(invoice, body)).toEqual([
      "src-1",
      "src-2",
      "src-3",
      "src-4",
      "src-5",
    ]);
  });
});
