"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  CalendarIcon,
  Filter,
  ChevronRight,
  ChevronDown,
  Clock,
  Download,
  ArrowLeft,
} from "lucide-react";
import {
  format,
  startOfWeek,
  startOfMonth,
  subDays,
  subMonths,
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDuration } from "@/lib/earnings";
import { generateInvoicePDF, type InvoicePDFData } from "@/lib/invoice-pdf";
import { useAppStore } from "@/stores/app-store";
import { groupPreviewEntriesByDay } from "./invoice-grouping-helpers";
import {
  buildInvoiceSummaryEntries,
  selectedEntriesHaveCommits,
} from "./invoice-summary-payload";

// ---- Types ----

export interface InvoiceCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
}

interface PreviewEntry {
  id: string;
  description: string;
  startTime: string;
  duration: number | null;
  billable: boolean;
  earnings: number;
  rate: number;
  projectId: string | null;
  tags: { tagId: string }[];
  commits?: InvoiceCommit[] | null;
  project: {
    id: string;
    name: string;
    color: string;
    hourlyRate: number | null;
    client: { id: string; name: string; email?: string | null; billingAddress?: string | null } | null;
  } | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number; // hours
  rate: number;
  amount: number;
  timeEntryId: string | null;
  /** Commits derived from the entry/entries backing this line item. */
  commits?: InvoiceCommit[];
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Client {
  id: string;
  name: string;
}

type DatePreset = "all-time" | "this-week" | "this-month" | "last-month" | "last-30" | "custom";
type GroupMode = "individual" | "grouped";

// ---- Helpers ----

function getDateRange(preset: DatePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  const todayEnd = endOfDay(now);
  switch (preset) {
    case "all-time":
      return { from: null, to: null };
    case "this-week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: todayEnd };
    case "this-month":
      return { from: startOfMonth(now), to: todayEnd };
    case "last-month": {
      const lastMonth = subMonths(now, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfDay(new Date(startOfMonth(now).getTime() - 1)),
      };
    }
    case "last-30":
      return { from: startOfDay(subDays(now, 29)), to: todayEnd };
    default:
      return { from: null, to: null };
  }
}

// ---- Component ----

export default function InvoicesPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Entry selection
  const [datePreset, setDatePreset] = useState<DatePreset>("this-month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [uninvoicedOnly, setUninvoicedOnly] = useState(true);
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingEntries, setLoadingEntries] = useState(false);
  // Expanded grouped rows in the Step 1 entry table. Keyed on the stable
  // composite merge key so re-fetches don't collapse open rows.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroupExpanded = useCallback((mergeKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(mergeKey)) next.delete(mergeKey);
      else next.add(mergeKey);
      return next;
    });
  }, []);

  // Scenario 5 — invoice draft auto-persist. A browser crash mid-draft used
  // to wipe every field. Now the form state writes to localStorage and
  // offers a "Resume draft" banner on reopen.
  const [resumableDraft, setResumableDraft] = useState<{
    savedAt: number;
  } | null>(null);
  const draftHydratedRef = useRef(false);

  // Step 2: Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [groupMode, setGroupMode] = useState<GroupMode>("individual");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [workSummary, setWorkSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderTaxId, setSenderTaxId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Controls whether the commits attached to each line item are rendered
  // on the invoice (preview + PDF). Defaults to true; auto-hidden when no
  // line item has commits so the toggle doesn't clutter the UI for users
  // without GitHub connected.
  const [includeCommits, setIncludeCommits] = useState(true);

  // Step 3: Preview
  const [markAsInvoiced, setMarkAsInvoiced] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Reference data
  const projects = (useAppStore((s) => s.projects.data) ?? []) as Project[];
  const clients = (useAppStore((s) => s.clients.data) ?? []) as Client[];
  const settings = useAppStore((s) => s.settings.data);

  useEffect(() => {
    const store = useAppStore.getState();
    store.fetchProjects();
    store.fetchClients();
    store.fetchSettings();
  }, []);

  // Pre-fill sender from settings — one-shot on first arrival so the
  // auto-save effect below doesn't fight with the invalidate/refetch cycle.
  const senderHydratedRef = useRef(false);
  const senderSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [senderSaveStatus, setSenderSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  useEffect(() => {
    if (senderHydratedRef.current) return;
    if (settings) {
      setSenderName(settings.senderName || settings.name || "");
      setSenderAddress(settings.senderAddress || "");
      setSenderEmail(settings.senderEmail || settings.email || "");
      setSenderTaxId(settings.senderTaxId || "");
      senderHydratedRef.current = true;
    }
  }, [settings]);

  // Debounced auto-save of sender defaults — no more "Save as default" click.
  useEffect(() => {
    if (!senderHydratedRef.current) return;
    if (senderSaveTimerRef.current) clearTimeout(senderSaveTimerRef.current);
    setSenderSaveStatus("saving");
    senderSaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderName, senderAddress, senderEmail, senderTaxId }),
        });
        if (!res.ok) throw new Error();
        useAppStore.getState().invalidate("settings");
        setSenderSaveStatus("saved");
        setTimeout(() => setSenderSaveStatus("idle"), 1500);
      } catch {
        setSenderSaveStatus("idle");
        toast.error("Couldn't save sender defaults");
      }
    }, 800);
    return () => {
      if (senderSaveTimerRef.current) clearTimeout(senderSaveTimerRef.current);
    };
  }, [senderName, senderAddress, senderEmail, senderTaxId]);

  // Draft persistence — read on mount, offer resume if a recent (< 24h)
  // in-progress draft exists. We don't auto-restore to avoid surprising the
  // user; the banner gives them Resume or Discard.
  const DRAFT_KEY = "boggltrack-invoice-draft-v1";
  const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { savedAt?: number; step?: number };
      if (!d.savedAt || Date.now() - d.savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      // Only resumable if the user was past step 1 — otherwise there's
      // nothing worth restoring.
      if ((d.step ?? 1) < 2) return;
      setResumableDraft({ savedAt: d.savedAt });
    } catch {
      // Corrupt draft — drop it
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
  }, []);

  // Debounced write of every draft-relevant field. Skips until hydration
  // ref is set (either draft resumed or user interacted past step 1) to
  // avoid writing an empty skeleton on first mount.
  useEffect(() => {
    if (step < 2 && !draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    const t = setTimeout(() => {
      try {
        const payload = {
          savedAt: Date.now(),
          step,
          invoiceNumber,
          issueDate: issueDate.toISOString(),
          dueDate: dueDate.toISOString(),
          groupMode,
          lineItems,
          taxRate,
          discountPercent,
          notes,
          paymentTerms,
          workSummary,
          recipientName,
          recipientAddress,
          recipientEmail,
          selectedIds: Array.from(selectedIds),
          includeCommits,
          datePreset,
          customFrom: customFrom?.toISOString() ?? null,
          customTo: customTo?.toISOString() ?? null,
          selectedProjectId,
          selectedClientId,
          uninvoicedOnly,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {
        // localStorage full or disabled — swallow silently
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [
    step,
    invoiceNumber,
    issueDate,
    dueDate,
    groupMode,
    lineItems,
    taxRate,
    discountPercent,
    notes,
    paymentTerms,
    workSummary,
    recipientName,
    recipientAddress,
    recipientEmail,
    selectedIds,
    includeCommits,
    datePreset,
    customFrom,
    customTo,
    selectedProjectId,
    selectedClientId,
    uninvoicedOnly,
  ]);

  const resumeDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setStep(d.step ?? 2);
      setInvoiceNumber(d.invoiceNumber ?? "");
      if (d.issueDate) setIssueDate(new Date(d.issueDate));
      if (d.dueDate) setDueDate(new Date(d.dueDate));
      if (d.groupMode) setGroupMode(d.groupMode);
      if (Array.isArray(d.lineItems)) setLineItems(d.lineItems);
      setTaxRate(d.taxRate ?? 0);
      setDiscountPercent(d.discountPercent ?? 0);
      setNotes(d.notes ?? "");
      setPaymentTerms(d.paymentTerms ?? "");
      setWorkSummary(d.workSummary ?? null);
      setRecipientName(d.recipientName ?? "");
      setRecipientAddress(d.recipientAddress ?? "");
      setRecipientEmail(d.recipientEmail ?? "");
      if (Array.isArray(d.selectedIds)) setSelectedIds(new Set(d.selectedIds));
      if (typeof d.includeCommits === "boolean") setIncludeCommits(d.includeCommits);
      if (d.datePreset) setDatePreset(d.datePreset);
      if (d.customFrom) setCustomFrom(new Date(d.customFrom));
      if (d.customTo) setCustomTo(new Date(d.customTo));
      setSelectedProjectId(d.selectedProjectId ?? "");
      setSelectedClientId(d.selectedClientId ?? "");
      setUninvoicedOnly(d.uninvoicedOnly ?? true);
      draftHydratedRef.current = true;
      setResumableDraft(null);
    } catch {
      toast.error("Draft was corrupted — starting fresh");
      localStorage.removeItem(DRAFT_KEY);
      setResumableDraft(null);
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setResumableDraft(null);
  };

  // Compute date range
  const dateRange = useMemo(() => {
    if (datePreset === "custom" && customFrom && customTo) {
      return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    }
    return getDateRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from.toISOString());
      if (dateRange.to) params.set("to", dateRange.to.toISOString());
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      if (selectedClientId) params.set("clientId", selectedClientId);
      params.set("uninvoicedOnly", String(uninvoicedOnly));

      const res = await fetch(`/api/invoices/preview-entries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setSelectedIds(new Set(data.entries.map((e: PreviewEntry) => e.id)));
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setLoadingEntries(false);
    }
  }, [dateRange, selectedProjectId, selectedClientId, uninvoicedOnly]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Selected entries
  const selectedEntries = useMemo(
    () => entries.filter((e) => selectedIds.has(e.id)),
    [entries, selectedIds]
  );

  const totalHours = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + (e.duration || 0) / 3600, 0),
    [selectedEntries]
  );

  const totalAmount = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + e.earnings, 0),
    [selectedEntries]
  );

  // Toggle entry selection
  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  // Group entries by same-day + identical description/project/billable/tags
  // so the Step 1 table shows one row per unit of work instead of one row
  // per timer session.
  const groupedRows = useMemo(() => groupPreviewEntriesByDay(entries), [entries]);

  // Toggle every entry inside a grouped row together.
  const toggleGroup = (mergeKey: string) => {
    const row = groupedRows.find((r) => r.mergeKey === mergeKey);
    if (!row) return;
    const allSelected = row.entries.every((e) => selectedIds.has(e.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) row.entries.forEach((e) => next.delete(e.id));
      else row.entries.forEach((e) => next.add(e.id));
      return next;
    });
  };

  // Build line items when entering step 2.
  // We also surface commits: in "individual" mode the entry's commits flow
  // straight onto the line; in "grouped" mode we union all commits across
  // entries sharing a description, deduped by sha.
  const buildLineItems = useCallback(() => {
    const selected = entries.filter((e) => selectedIds.has(e.id));

    if (groupMode === "individual") {
      return selected.map((e, i) => ({
        id: `li-${i}`,
        description: e.description || "(no description)",
        quantity: Math.round(((e.duration || 0) / 3600) * 100) / 100,
        rate: e.rate,
        amount: e.earnings,
        timeEntryId: e.id,
        commits: (e.commits ?? []).slice(),
      }));
    } else {
      // Grouped: merge entries with the same description, union commits
      const byDescription = new Map<
        string,
        { description: string; hours: number; rate: number; amount: number; commits: InvoiceCommit[]; seen: Set<string> }
      >();
      for (const e of selected) {
        const desc = e.description || "(no description)";
        const existing = byDescription.get(desc);
        const hours = (e.duration || 0) / 3600;
        const commits = e.commits ?? [];
        if (existing) {
          existing.hours += hours;
          existing.amount += e.earnings;
          for (const c of commits) {
            if (existing.seen.has(c.sha)) continue;
            existing.seen.add(c.sha);
            existing.commits.push(c);
          }
        } else {
          const seen = new Set<string>();
          const starting: InvoiceCommit[] = [];
          for (const c of commits) {
            if (seen.has(c.sha)) continue;
            seen.add(c.sha);
            starting.push(c);
          }
          byDescription.set(desc, {
            description: desc,
            hours,
            rate: e.rate,
            amount: e.earnings,
            commits: starting,
            seen,
          });
        }
      }
      return Array.from(byDescription.values()).map((group, i) => ({
        id: `li-${i}`,
        description: group.description,
        quantity: Math.round(group.hours * 100) / 100,
        rate: group.rate,
        amount: Math.round(group.amount * 100) / 100,
        timeEntryId: null,
        commits: group.commits,
      }));
    }
  }, [entries, selectedIds, groupMode]);

  // Do any of the line items actually carry commits? Drives whether we
  // bother rendering the "Include commits" toggle at all.
  const hasAnyCommits = useMemo(
    () => lineItems.some((li) => li.commits && li.commits.length > 0),
    [lineItems]
  );

  // Computed totals
  const subtotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.amount, 0),
    [lineItems]
  );
  const discountAmount = Math.round(subtotal * discountPercent / 100 * 100) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = Math.round(afterDiscount * taxRate / 100 * 100) / 100;
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;

  const currSymbol = settings?.currencySymbol || "$";

  // Step transitions
  const goToStep2 = () => {
    const items = buildLineItems();
    setLineItems(items);

    // Auto-fill recipient from entries' client
    const clientIds = new Set(selectedEntries.map((e) => e.project?.client?.id).filter(Boolean));
    if (clientIds.size === 1) {
      const client = selectedEntries.find((e) => e.project?.client)?.project?.client;
      if (client) {
        setRecipientName(client.name || "");
        setRecipientEmail(client.email || "");
        setRecipientAddress(client.billingAddress || "");
      }
    }

    // Auto-generate invoice number
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((invoices: { id: string }[]) => {
        const num = `INV-${String(invoices.length + 1).padStart(4, "0")}`;
        setInvoiceNumber(num);
      })
      .catch(() => setInvoiceNumber("INV-0001"));

    setStep(2);
  };

  const generateWorkSummary = useCallback(async () => {
    if (!selectedEntriesHaveCommits(selectedEntries)) {
      setWorkSummary(null);
      return null;
    }

    setGeneratingSummary(true);
    try {
      const res = await fetch("/api/invoices/work-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: buildInvoiceSummaryEntries(selectedEntries),
        }),
      });

      if (!res.ok) throw new Error("Failed to generate work summary");
      const data = (await res.json()) as { workSummary: string | null };
      setWorkSummary(data.workSummary);
      return data.workSummary;
    } catch (error) {
      console.error("Failed to generate work summary:", error);
      setWorkSummary(null);
      toast.error("Couldn't generate work summary, continuing without it");
      return null;
    } finally {
      setGeneratingSummary(false);
    }
  }, [selectedEntries]);

  const goToStep3 = () => {
    // Advance immediately — the summary generates in the background and
    // populates the preview when ready. `generatingSummary` is already wired
    // up to display a placeholder/spinner where the summary will appear.
    void generateWorkSummary();
    setStep(3);
  };

  // Update line item field
  const updateLineItem = (id: string, field: "description" | "quantity" | "rate", value: string | number) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        if (field === "quantity" || field === "rate") {
          updated.amount = Math.round(updated.quantity * updated.rate * 100) / 100;
        }
        return updated;
      })
    );
  };

  // Rebuild line items when groupMode changes in step 2
  useEffect(() => {
    if (step === 2) {
      setLineItems(buildLineItems());
    }
  }, [groupMode]);

  // Download handler — generate the PDF locally first (instant), then persist
  // the invoice + finalize entries in the background. The PDF is what the
  // user actually wants; the server-side record is bookkeeping that can lag
  // a few hundred ms without anyone noticing.
  const handleDownload = async () => {
    setDownloading(true);

    // If the summary is still generating in the background, wait briefly so
    // the PDF includes it. If it's already there or generation already
    // failed, we'll use what we have.
    const summaryForInvoice =
      workSummary ?? (await generateWorkSummary());

    const pdfData: InvoicePDFData = {
      number: invoiceNumber,
      issueDate: format(issueDate, "MMM d, yyyy"),
      dueDate: format(dueDate, "MMM d, yyyy"),
      currency: settings?.currency || "USD",
      currencySymbol: currSymbol,
      senderName,
      senderAddress,
      senderEmail,
      senderTaxId,
      recipientName,
      recipientAddress,
      recipientEmail,
      lineItems: lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        amount: li.amount,
        commits: includeCommits && li.commits && li.commits.length > 0
          ? li.commits.map((c) => ({
              sha: c.sha,
              message: c.message,
              repo: c.repo,
              url: c.url,
            }))
          : undefined,
      })),
      subtotal,
      discountPercent,
      discountAmount,
      taxRate,
      taxAmount,
      total,
      workSummary: summaryForInvoice,
      notes,
      paymentTerms,
    };

    try {
      generateInvoicePDF(pdfData);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
      setDownloading(false);
      return;
    }

    toast.success("Invoice downloaded");

    // Persist + finalize in the background. The user is already moving on.
    const invoiceBody = {
      number: invoiceNumber,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      currency: settings?.currency || "USD",
      currencySymbol: currSymbol,
      subtotal,
      taxRate,
      taxAmount,
      discountPercent,
      discountAmount,
      total,
      notes: notes || null,
      paymentTerms: paymentTerms || null,
      workSummary: summaryForInvoice,
      senderName,
      senderAddress,
      senderEmail,
      senderTaxId,
      recipientName,
      recipientAddress,
      recipientEmail,
      clientId: selectedEntries[0]?.project?.client?.id || null,
      lineItems: lineItems.map((li, i) => ({
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        amount: li.amount,
        sortOrder: i,
        timeEntryId: li.timeEntryId,
      })),
    };

    const selectedIdsSnapshot = Array.from(selectedIds);
    const shouldFinalize = markAsInvoiced;
    void (async () => {
      try {
        const createRes = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoiceBody),
        });
        if (!createRes.ok) throw new Error("Failed to create invoice");
        const invoice = await createRes.json();

        if (shouldFinalize) {
          const finalizeRes = await fetch(`/api/invoices/${invoice.id}/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timeEntryIds: selectedIdsSnapshot }),
          });
          if (!finalizeRes.ok) throw new Error("Failed to finalize invoice");
        }
        fetchEntries();
      } catch (err) {
        console.error("Background invoice save failed:", err);
        toast.error("Saved PDF, but couldn't record the invoice — try again");
      }
    })();

    // Draft is no longer resumable once the invoice is finalized + downloaded.
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    draftHydratedRef.current = false;

    setStep(1);
    setSelectedIds(new Set());
    setWorkSummary(null);
    setDownloading(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight">
            {step === 1 ? "Create Invoice" : step === 2 ? "Customize Invoice" : "Preview Invoice"}
          </h1>
          <p className="text-[13px] text-[var(--text-olive)] mt-1">
            {step === 1
              ? "Select time entries to include on your invoice."
              : step === 2
                ? "Edit details, line items, and add tax or discount."
                : "Review your invoice and download as PDF."}
          </p>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center justify-center size-8 rounded-full text-sm font-semibold transition-colors ${
                step >= s
                  ? "bg-[var(--accent-teal)] text-white"
                  : "bg-[var(--bg-muted)] text-[var(--text-olive)]"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Resumable draft banner — shown on /invoices entry when an in-progress
          draft was saved within the last 24h. */}
      {resumableDraft && step === 1 && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-[var(--radius-md)] bg-[var(--accent-olive-soft)]/60 border border-[var(--border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--text-forest)]">
              You have an unsaved invoice draft
            </p>
            <p className="text-[12px] text-[var(--text-olive)] mt-0.5">
              Saved {Math.max(1, Math.round((Date.now() - resumableDraft.savedAt) / 60000))} min ago — resume to pick up where you left off.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={discardDraft}
              className="h-9 px-3 text-[12px] text-[var(--text-olive)] hover:text-[var(--accent-coral)] transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={resumeDraft}
              className="h-9 px-4 text-[13px] font-medium text-[var(--text-cream)] bg-[var(--text-forest)] rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
            >
              Resume draft
            </button>
          </div>
        </div>
      )}

      {/* ========== STEP 1: SELECT ENTRIES ========== */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Quick project select */}
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!selectedProjectId ? "default" : "outline"}
                size="sm"
                className="rounded-full h-9 text-[13px]"
                onClick={() => setSelectedProjectId("")}
              >
                All Projects
              </Button>
              {projects.map((p) => (
                <Button
                  key={p.id}
                  variant={selectedProjectId === p.id ? "default" : "outline"}
                  size="sm"
                  className="rounded-full h-9 text-[13px]"
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <span className="size-2 rounded-full shrink-0 mr-1.5" style={{ backgroundColor: p.color }} />
                  {p.name}
                </Button>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={datePreset}
              onValueChange={(val: string) => val && setDatePreset(val as DatePreset)}
            >
              <SelectTrigger className="h-9 rounded-full text-[13px] w-auto min-w-[130px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-time">All Time</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-30">Last 30 Days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {datePreset === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors border border-[var(--border-medium)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)] rounded-full h-9 text-[13px] px-3">
                    <CalendarIcon className="size-3.5 mr-1.5" />
                    {customFrom ? format(customFrom, "MMM d") : "From"}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={(d: Date | undefined) => setCustomFrom(d)} />
                  </PopoverContent>
                </Popover>
                <span className="text-[var(--text-olive)] text-xs">to</span>
                <Popover>
                  <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors border border-[var(--border-medium)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)] rounded-full h-9 text-[13px] px-3">
                    <CalendarIcon className="size-3.5 mr-1.5" />
                    {customTo ? format(customTo, "MMM d") : "To"}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={(d: Date | undefined) => setCustomTo(d)} />
                  </PopoverContent>
                </Popover>
              </>
            )}

            <div className="w-px h-5 bg-[var(--border-medium)]" />

            <Popover>
              <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors border border-[var(--border-medium)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)] rounded-full h-9 text-[13px] px-3">
                <Filter className="size-3.5 mr-1.5" />
                {selectedProjectId
                  ? projects.find((p) => p.id === selectedProjectId)?.name || "Project"
                  : "All Projects"}
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  <button
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-[var(--bg-muted)]"
                    onClick={() => setSelectedProjectId("")}
                  >
                    <span className="flex-1">All Projects</span>
                    {!selectedProjectId && <span className="text-[var(--accent-teal)] text-xs font-bold">&#10003;</span>}
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-[var(--bg-muted)]"
                      onClick={() => setSelectedProjectId(p.id)}
                    >
                      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="flex-1 truncate">{p.name}</span>
                      {selectedProjectId === p.id && <span className="text-[var(--accent-teal)] text-xs font-bold">&#10003;</span>}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors border border-[var(--border-medium)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)] rounded-full h-9 text-[13px] px-3">
                <Filter className="size-3.5 mr-1.5" />
                {selectedClientId
                  ? clients.find((c) => c.id === selectedClientId)?.name || "Client"
                  : "All Clients"}
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  <button
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-[var(--bg-muted)]"
                    onClick={() => setSelectedClientId("")}
                  >
                    <span className="flex-1">All Clients</span>
                    {!selectedClientId && <span className="text-[var(--accent-teal)] text-xs font-bold">&#10003;</span>}
                  </button>
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-[var(--bg-muted)]"
                      onClick={() => setSelectedClientId(c.id)}
                    >
                      <span className="flex-1 truncate">{c.name}</span>
                      {selectedClientId === c.id && <span className="text-[var(--accent-teal)] text-xs font-bold">&#10003;</span>}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-px h-5 bg-[var(--border-medium)]" />

            <label className="inline-flex items-center gap-2 text-[13px] text-[var(--text-forest)] cursor-pointer" data-testid="uninvoiced-toggle">
              <Checkbox checked={uninvoicedOnly} onCheckedChange={(c) => setUninvoicedOnly(c)} />
              Uninvoiced only
            </label>
          </div>

          {/* Entries table */}
          {loadingEntries ? (
            <Card>
              <CardContent className="pt-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={entries.length > 0 && selectedIds.size === entries.length}
                          onCheckedChange={toggleAll}
                          data-testid="select-all"
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedRows.map((row) => {
                      const first = row.entries[0];
                      const isMerged = row.entries.length > 1;
                      const isExpanded = expandedGroups.has(row.mergeKey);
                      const selectedInGroup = row.entries.filter((e) => selectedIds.has(e.id)).length;
                      const allSelected = selectedInGroup === row.entries.length;
                      const someSelected = selectedInGroup > 0 && !allSelected;
                      const sharedRate = first.rate;
                      return (
                        <React.Fragment key={row.mergeKey}>
                          <TableRow className={allSelected ? "bg-[var(--accent-teal)]/5" : someSelected ? "bg-[var(--accent-teal)]/[0.03]" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={allSelected}
                                ref={(el: HTMLInputElement | null) => {
                                  if (el) el.indeterminate = someSelected;
                                }}
                                onCheckedChange={() => toggleGroup(row.mergeKey)}
                              />
                            </TableCell>
                            <TableCell className="text-sm">{format(new Date(first.startTime), "MMM d")}</TableCell>
                            <TableCell className="text-sm max-w-[260px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{first.description || "(no description)"}</span>
                                {isMerged && (
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupExpanded(row.mergeKey)}
                                    aria-expanded={isExpanded}
                                    aria-label={`${isExpanded ? "Hide" : "Show"} ${row.entries.length} merged entries`}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-olive)] bg-[var(--bg-muted)] hover:bg-[var(--bg-cream-hover)] hover:text-[var(--text-forest)] px-2 py-0.5 rounded-full transition-colors shrink-0"
                                  >
                                    <ChevronDown
                                      className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    />
                                    {row.entries.length}
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {first.project ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: first.project.color }} />
                                  <span className="text-sm truncate">{first.project.name}</span>
                                </div>
                              ) : (
                                <span className="text-[var(--text-olive)] text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-sm">
                              {formatDuration(row.totalDuration)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {currSymbol}{sharedRate.toFixed(2)}/h
                            </TableCell>
                            <TableCell className="text-right font-medium text-[var(--accent-teal)] text-sm">
                              {formatCurrency(row.totalEarnings, currSymbol)}
                            </TableCell>
                          </TableRow>
                          {isMerged && isExpanded && row.entries.map((sub) => {
                            const subStart = new Date(sub.startTime);
                            const subDur = sub.duration ?? 0;
                            return (
                              <TableRow
                                key={sub.id}
                                className={`bg-[var(--bg-muted)]/25 ${selectedIds.has(sub.id) ? "bg-[var(--accent-teal)]/5" : ""}`}
                              >
                                <TableCell className="pl-10">
                                  <Checkbox
                                    checked={selectedIds.has(sub.id)}
                                    onCheckedChange={() => toggleEntry(sub.id)}
                                  />
                                </TableCell>
                                <TableCell className="text-[12px] text-[var(--text-olive)]" colSpan={3}>
                                  <span className="inline-flex items-center gap-2">
                                    <Clock className="h-3 w-3 opacity-50" />
                                    <span className="tabular-nums">{format(subStart, "h:mm a")}</span>
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-[12px] text-[var(--text-olive)]">
                                  {formatDuration(subDur)}
                                </TableCell>
                                <TableCell className="text-right text-[12px] text-[var(--text-olive)]">
                                  {currSymbol}{sub.rate.toFixed(2)}/h
                                </TableCell>
                                <TableCell className="text-right font-medium text-[var(--text-olive)] text-[12px]">
                                  {formatCurrency(sub.earnings, currSymbol)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-[var(--text-olive)] py-8">
                          No billable entries found for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Selection summary */}
                {entries.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <p className="text-sm text-[var(--text-olive)]">
                      <span className="font-semibold text-[var(--text-forest)]">{selectedIds.size}</span> of {entries.length} entries selected
                      &middot; {totalHours.toFixed(1)}h
                      &middot; <span className="text-[var(--accent-teal)] font-semibold">{formatCurrency(totalAmount, currSymbol)}</span>
                    </p>
                    <Button
                      disabled={selectedIds.size === 0}
                      onClick={goToStep2}
                      className="rounded-full"
                    >
                      Continue
                      <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== STEP 2: CUSTOMIZE ========== */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex gap-6 items-start">
            {/* Left: Line items & totals */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Invoice meta */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-olive)] mb-1 block">Invoice Number</label>
                      <Input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="INV-0001"
                        data-testid="invoice-number"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--text-olive)] mb-1 block">Issue Date</label>
                      <Popover>
                        <PopoverTrigger className="inline-flex items-center w-full justify-start whitespace-nowrap font-normal transition-colors border border-[var(--border-medium)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)] rounded-[var(--radius-sm)] h-10 text-sm px-3">
                          <CalendarIcon className="size-3.5 mr-2" />
                          {format(issueDate, "MMM d, yyyy")}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={issueDate} onSelect={(d: Date | undefined) => d && setIssueDate(d)} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--text-olive)] mb-1 block">Due Date</label>
                      <Popover>
                        <PopoverTrigger className="inline-flex items-center w-full justify-start whitespace-nowrap font-normal transition-colors border border-[var(--border-medium)] bg-[var(--bg-cream)] hover:bg-[var(--bg-cream-hover)] text-[var(--text-forest)] rounded-[var(--radius-sm)] h-10 text-sm px-3">
                          <CalendarIcon className="size-3.5 mr-2" />
                          {format(dueDate, "MMM d, yyyy")}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dueDate} onSelect={(d: Date | undefined) => d && setDueDate(d)} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Grouping toggle + Line items */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <span className="text-sm font-medium text-[var(--text-olive)]">Line Items</span>
                    <div className="flex items-center gap-3 flex-wrap">
                      {hasAnyCommits && (
                        <label
                          className="inline-flex items-center gap-2 text-[13px] text-[var(--text-forest)] cursor-pointer"
                          data-testid="include-commits-toggle"
                        >
                          <Checkbox
                            checked={includeCommits}
                            onCheckedChange={(c) => setIncludeCommits(c)}
                          />
                          Include commits
                        </label>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant={groupMode === "individual" ? "default" : "outline"}
                          size="sm"
                          className="h-8 px-3 text-xs rounded-full"
                          onClick={() => setGroupMode("individual")}
                          data-testid="group-individual"
                        >
                          Individual entries
                        </Button>
                        <Button
                          variant={groupMode === "grouped" ? "default" : "outline"}
                          size="sm"
                          className="h-8 px-3 text-xs rounded-full"
                          onClick={() => setGroupMode("grouped")}
                          data-testid="group-grouped"
                        >
                          Group by description
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24 text-right">Hours</TableHead>
                        <TableHead className="w-28 text-right">Rate</TableHead>
                        <TableHead className="w-28 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((li) => (
                        <React.Fragment key={li.id}>
                          <TableRow>
                            <TableCell>
                              <Input
                                value={li.description}
                                onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                                className="h-8 text-sm"
                                data-testid="line-item-description"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                value={li.quantity}
                                onChange={(e) => updateLineItem(li.id, "quantity", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm text-right w-20 ml-auto"
                                data-testid="line-item-hours"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={li.rate}
                                onChange={(e) => updateLineItem(li.id, "rate", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm text-right w-24 ml-auto"
                                data-testid="line-item-rate"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium text-[var(--accent-teal)]">
                              {formatCurrency(li.amount, currSymbol)}
                            </TableCell>
                          </TableRow>
                          {includeCommits && li.commits && li.commits.length > 0 && (() => {
                            const commits = li.commits;
                            const repos = new Set(commits.map((c) => c.repo));
                            const multi = repos.size > 1;
                            const shortRepo = (r: string) => r.split("/").slice(-1)[0];
                            return (
                              <TableRow>
                                <TableCell colSpan={4} className="!py-2 !pl-4 bg-[var(--bg-muted)]/40">
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-olive)]">
                                    <span className="font-medium">Work detail:</span>
                                    {commits.slice(0, 6).map((c) => (
                                      <a
                                        key={c.sha}
                                        href={c.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-cream)] hover:text-[var(--text-forest)] transition-colors"
                                        title={`${c.repo} · ${c.message}`}
                                      >
                                        <code className="font-mono text-[10px] text-[var(--text-forest)]">{c.sha.slice(0, 7)}</code>
                                        {multi && (
                                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                                            {shortRepo(c.repo)}
                                          </span>
                                        )}
                                        <span className="truncate max-w-[160px]">{c.message}</span>
                                      </a>
                                    ))}
                                    {commits.length > 6 && (
                                      <span>+{commits.length - 6} more</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })()}
                        </React.Fragment>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(subtotal, currSymbol)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>

                  {/* Tax & Discount */}
                  <div className="flex flex-col items-end mt-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[var(--text-olive)]">Discount %</label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        className="h-8 w-20 text-sm text-right"
                        data-testid="discount-input"
                      />
                      {discountPercent > 0 && (
                        <span className="text-sm text-[var(--text-olive)]">-{formatCurrency(discountAmount, currSymbol)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[var(--text-olive)]">Tax %</label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        className="h-8 w-20 text-sm text-right"
                        data-testid="tax-input"
                      />
                      {taxRate > 0 && (
                        <span className="text-sm text-[var(--text-olive)]">+{formatCurrency(taxAmount, currSymbol)}</span>
                      )}
                    </div>
                    <Separator className="w-48" />
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-[var(--text-forest)]">Total</span>
                      <span className="text-lg font-bold text-[var(--accent-teal)]" data-testid="invoice-total">
                        {formatCurrency(total, currSymbol)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Sender/Recipient/Notes */}
            <div className="hidden lg:block w-80 shrink-0 space-y-4">
              {/* Sender */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-olive)] uppercase tracking-wider">From</span>
                    <span className="text-[11px] text-[var(--text-olive)]/70">
                      {senderSaveStatus === "saving"
                        ? "Saving…"
                        : senderSaveStatus === "saved"
                        ? "Saved"
                        : "Auto-saves as default"}
                    </span>
                  </div>
                  <Input placeholder="Your name / business" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="text-sm" data-testid="sender-name" />
                  <Textarea placeholder="Address" value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} className="text-sm min-h-[60px]" />
                  <Input placeholder="Email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="text-sm" />
                  <Input placeholder="Tax ID (optional)" value={senderTaxId} onChange={(e) => setSenderTaxId(e.target.value)} className="text-sm" />
                </CardContent>
              </Card>

              {/* Recipient */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <span className="text-xs font-semibold text-[var(--text-olive)] uppercase tracking-wider">Bill To</span>
                  <Input placeholder="Client name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="text-sm" data-testid="recipient-name" />
                  <Textarea placeholder="Billing address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="text-sm min-h-[60px]" />
                  <Input placeholder="Email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="text-sm" />
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <span className="text-xs font-semibold text-[var(--text-olive)] uppercase tracking-wider">Additional</span>
                  <Textarea placeholder="Notes (e.g., payment instructions)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[60px]" data-testid="invoice-notes" />
                  <Textarea placeholder="Payment terms (e.g., Net 30)" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="text-sm min-h-[40px]" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mobile: Sender/Recipient/Notes below */}
          <div className="lg:hidden space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <span className="text-xs font-semibold text-[var(--text-olive)] uppercase tracking-wider">From</span>
                <Input placeholder="Your name / business" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="text-sm" />
                <Textarea placeholder="Address" value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} className="text-sm min-h-[60px]" />
                <Input placeholder="Email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="text-sm" />
                <Input placeholder="Tax ID" value={senderTaxId} onChange={(e) => setSenderTaxId(e.target.value)} className="text-sm" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <span className="text-xs font-semibold text-[var(--text-olive)] uppercase tracking-wider">Bill To</span>
                <Input placeholder="Client name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="text-sm" />
                <Textarea placeholder="Billing address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="text-sm min-h-[60px]" />
                <Input placeholder="Email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="text-sm" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <span className="text-xs font-semibold text-[var(--text-olive)] uppercase tracking-wider">Additional</span>
                <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[60px]" />
                <Textarea placeholder="Payment terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="text-sm min-h-[40px]" />
              </CardContent>
            </Card>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button className="rounded-full" onClick={goToStep3}>
              Preview
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 3: PREVIEW & EXPORT ========== */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Invoice preview card */}
          <Card className="max-w-[820px] mx-auto border-none shadow-sm bg-[#F7F3E6]" data-testid="invoice-preview">
            <CardContent className="px-8 py-8 sm:px-12 sm:py-10 text-black">
              <div className="flex items-start justify-between gap-8">
                <h2 className="font-serif text-[64px] sm:text-[86px] leading-none font-bold tracking-[-0.06em] text-black">
                  Invoice
                </h2>
                <div className="pt-8 text-right text-[13px] leading-tight">
                  <p>{format(issueDate, "d MMMM yyyy")}</p>
                  <p className="font-semibold">Invoice No. {invoiceNumber}</p>
                </div>
              </div>

              <div className="mt-8 border-t border-black/35 pt-5">
                <p className="text-[13px] font-bold mb-3">Billed to:</p>
                <div className="text-[13px] leading-relaxed">
                  {recipientName && <p>{recipientName}</p>}
                  {recipientEmail && <p>{recipientEmail}</p>}
                  {recipientAddress && <p className="whitespace-pre-line">{recipientAddress}</p>}
                </div>
              </div>

              <div className="mt-5 border-t border-black/35" />

              <div className="mt-24">
                <Table>
                  <TableHeader>
                    <TableRow className="border-y border-black/35 hover:bg-transparent">
                      <TableHead className="h-9 px-0 text-black font-bold">Description</TableHead>
                      <TableHead className="h-9 px-0 text-right text-black font-bold">Rate</TableHead>
                      <TableHead className="h-9 px-0 text-right text-black font-bold">Hours</TableHead>
                      <TableHead className="h-9 px-0 text-right text-black font-bold">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((li) => (
                      <TableRow key={li.id} className="border-b border-black/25 hover:bg-transparent">
                        <TableCell className="px-0 py-3 text-[13px] text-black">{li.description}</TableCell>
                        <TableCell className="px-0 py-3 text-right text-[13px] text-black">
                          {formatCurrency(li.rate, currSymbol)}/hr
                        </TableCell>
                        <TableCell className="px-0 py-3 text-right text-[13px] tabular-nums text-black">
                          {li.quantity.toFixed(1)}
                        </TableCell>
                        <TableCell className="px-0 py-3 text-right text-[13px] font-medium text-black">
                          {formatCurrency(li.amount, currSymbol)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-full max-w-[260px] text-[13px] text-black">
                  <div className="flex justify-between py-2">
                    <span className="font-bold">Subtotal</span>
                    <span>{formatCurrency(subtotal, currSymbol)}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="font-bold">Discount ({discountPercent}%)</span>
                      <span>-{formatCurrency(discountAmount, currSymbol)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="font-bold">Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, currSymbol)}</span>
                  </div>
                  <div className="flex justify-between border-t border-black/35 py-2 text-[14px]">
                    <span className="font-bold">Total</span>
                    <span className="font-bold">{formatCurrency(total, currSymbol)}</span>
                  </div>
                </div>
              </div>

              {(workSummary || (includeCommits && lineItems.some((li) => li.commits?.length))) && (
                <div className="mt-12 border-t border-black/35 pt-5 text-[12px] leading-relaxed text-black">
                  {workSummary && (
                    <div className="mb-4">
                      <p className="font-bold mb-2">Work Summary</p>
                      <p className="whitespace-pre-line">{workSummary}</p>
                    </div>
                  )}
                  {includeCommits && lineItems.some((li) => li.commits?.length) && (
                    <div>
                      <p className="font-bold mb-2">Work Details</p>
                      <div className="space-y-1.5 text-black/75">
                        {lineItems.flatMap((li) =>
                          (li.commits ?? []).slice(0, 6).map((commit) => (
                            <p key={`${li.id}-${commit.sha}`} className="truncate">
                              <span className="font-mono text-black">{commit.sha.slice(0, 7)}</span>
                              {" · "}
                              {li.description}: {commit.message}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-24 border-t border-black/35 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-8 text-[13px] leading-relaxed text-black">
                <div>
                  <p className="font-bold mb-3">Payment Information</p>
                  {paymentTerms && <p className="whitespace-pre-line">{paymentTerms}</p>}
                  {notes && <p className="whitespace-pre-line mt-2">{notes}</p>}
                </div>
                <div>
                  {senderName && <p className="font-bold mb-3">{senderName}</p>}
                  {senderAddress && <p className="whitespace-pre-line">{senderAddress}</p>}
                  {senderEmail && <p>{senderEmail}</p>}
                  {senderTaxId && <p>Tax ID: {senderTaxId}</p>}
                </div>
              </div>

              <div className="mt-5 border-t border-black/35 pt-3 text-center text-[10px] text-black/55 tracking-wide">
                Created with boggltrack.com
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between max-w-[800px] mx-auto">
            <Button variant="outline" className="rounded-full" onClick={() => setStep(2)}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-forest)] cursor-pointer" data-testid="mark-invoiced-toggle">
                <Checkbox checked={markAsInvoiced} onCheckedChange={(c) => setMarkAsInvoiced(c)} />
                Mark entries as invoiced
              </label>
              <Button
                className="rounded-full"
                disabled={downloading}
                onClick={handleDownload}
                data-testid="download-pdf"
              >
                <Download className="size-4 mr-1.5" />
                {downloading ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
