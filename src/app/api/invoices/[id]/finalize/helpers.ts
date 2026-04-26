/**
 * Decide which time-entry IDs should be marked as invoiced when finalizing.
 *
 * The finalize endpoint historically derived this list from
 * `invoice.lineItems[].timeEntryId`. That works for "individual" group mode
 * (one line item per entry) but breaks for "grouped" mode, where multiple
 * entries collapse into one line item with `timeEntryId: null`. In that case
 * the source entries were never marked, so they kept showing up in the
 * "Uninvoiced only" filter.
 *
 * The page now sends the full set of source entry IDs as
 * `body.timeEntryIds`. We honor it when present and fall back to the legacy
 * derivation for older clients (e.g. cached frontends mid-deploy).
 */
export function pickTimeEntryIdsToMark(
  invoice: { lineItems: Array<{ timeEntryId: string | null }> },
  body: { timeEntryIds?: unknown }
): string[] {
  if (Array.isArray(body.timeEntryIds)) {
    return body.timeEntryIds.filter(
      (id): id is string => typeof id === "string"
    );
  }
  return invoice.lineItems
    .map((item) => item.timeEntryId)
    .filter((id): id is string => id !== null);
}
