"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarIcon,
  Filter,
  ChevronLeft,
  ChevronRight,
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
import { Toggle } from "@/components/ui/toggle";
import { formatCurrency, formatDuration } from "@/lib/earnings";
import { generateInvoicePDF, type InvoicePDFData } from "@/lib/invoice-pdf";
import { useAppStore } from "@/stores/app-store";

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
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderTaxId, setSenderTaxId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

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

  // Pre-fill sender from settings
  useEffect(() => {
    if (settings) {
      setSenderName(settings.senderName || settings.name || "");
      setSenderAddress(settings.senderAddress || "");
      setSenderEmail(settings.senderEmail || settings.email || "");
      setSenderTaxId(settings.senderTaxId || "");
    }
  }, [settings]);

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

  const goToStep3 = () => setStep(3);

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

  // Save sender defaults
  const saveSenderDefaults = async () => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          senderAddress,
          senderEmail,
          senderTaxId,
        }),
      });
      useAppStore.getState().invalidate("settings");
      toast.success("Sender details saved as default");
    } catch {
      toast.error("Failed to save defaults");
    }
  };

  // Download handler
  const handleDownload = async () => {
    setDownloading(true);
    try {
      // 1. Create invoice via API
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

      const createRes = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceBody),
      });

      if (!createRes.ok) throw new Error("Failed to create invoice");
      const invoice = await createRes.json();

      // 2. Finalize if marking as invoiced
      if (markAsInvoiced) {
        const finalizeRes = await fetch(`/api/invoices/${invoice.id}/finalize`, {
          method: "POST",
        });
        if (!finalizeRes.ok) throw new Error("Failed to finalize invoice");
      }

      // 3. Generate PDF
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
          commits: li.commits && li.commits.length > 0
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
        notes,
        paymentTerms,
      };

      generateInvoicePDF(pdfData);

      toast.success("Invoice downloaded successfully");

      // Reset to step 1
      setStep(1);
      setSelectedIds(new Set());
      fetchEntries();
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to generate invoice");
    } finally {
      setDownloading(false);
    }
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
                    {entries.map((e) => (
                      <TableRow key={e.id} className={selectedIds.has(e.id) ? "bg-[var(--accent-teal)]/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(e.id)}
                            onCheckedChange={() => toggleEntry(e.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(e.startTime), "MMM d")}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{e.description || "(no description)"}</TableCell>
                        <TableCell>
                          {e.project ? (
                            <div className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: e.project.color }} />
                              <span className="text-sm truncate">{e.project.name}</span>
                            </div>
                          ) : (
                            <span className="text-[var(--text-olive)] text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {formatDuration(e.duration || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {currSymbol}{e.rate.toFixed(2)}/h
                        </TableCell>
                        <TableCell className="text-right font-medium text-[var(--accent-teal)] text-sm">
                          {formatCurrency(e.earnings, currSymbol)}
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-[var(--text-olive)]">Line Items</span>
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
                          {li.commits && li.commits.length > 0 && (() => {
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={saveSenderDefaults}>
                      Save as default
                    </Button>
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
          <Card className="max-w-[800px] mx-auto" data-testid="invoice-preview">
            <CardContent className="pt-8 pb-8 px-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-[var(--text-forest)] tracking-tight">INVOICE</h2>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-[var(--text-forest)]">{invoiceNumber}</p>
                  <p className="text-[var(--text-olive)]">Issued: {format(issueDate, "MMM d, yyyy")}</p>
                  <p className="text-[var(--text-olive)]">Due: {format(dueDate, "MMM d, yyyy")}</p>
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Sender / Recipient */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-2">From</p>
                  {senderName && <p className="font-semibold text-sm text-[var(--text-forest)]">{senderName}</p>}
                  {senderAddress && <p className="text-sm text-[var(--text-olive)] whitespace-pre-line">{senderAddress}</p>}
                  {senderEmail && <p className="text-sm text-[var(--text-olive)]">{senderEmail}</p>}
                  {senderTaxId && <p className="text-sm text-[var(--text-olive)]">Tax ID: {senderTaxId}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-2">Bill To</p>
                  {recipientName && <p className="font-semibold text-sm text-[var(--text-forest)]">{recipientName}</p>}
                  {recipientAddress && <p className="text-sm text-[var(--text-olive)] whitespace-pre-line">{recipientAddress}</p>}
                  {recipientEmail && <p className="text-sm text-[var(--text-olive)]">{recipientEmail}</p>}
                </div>
              </div>

              {/* Line items */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--text-forest)]">
                    <TableHead className="text-white font-semibold w-10">#</TableHead>
                    <TableHead className="text-white font-semibold">Description</TableHead>
                    <TableHead className="text-white font-semibold text-right">Hours</TableHead>
                    <TableHead className="text-white font-semibold text-right">Rate (/hr)</TableHead>
                    <TableHead className="text-white font-semibold text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li, i) => (
                    <TableRow key={li.id}>
                      <TableCell className="text-sm text-[var(--text-olive)]">{i + 1}</TableCell>
                      <TableCell className="text-sm">{li.description}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{li.quantity.toFixed(1)}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(li.rate, currSymbol)}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{formatCurrency(li.amount, currSymbol)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex flex-col items-end mt-6 space-y-1.5">
                <div className="flex justify-between w-56 text-sm">
                  <span className="text-[var(--text-olive)]">Subtotal</span>
                  <span>{formatCurrency(subtotal, currSymbol)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between w-56 text-sm">
                    <span className="text-[var(--text-olive)]">Discount ({discountPercent}%)</span>
                    <span>-{formatCurrency(discountAmount, currSymbol)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between w-56 text-sm">
                    <span className="text-[var(--text-olive)]">Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, currSymbol)}</span>
                  </div>
                )}
                <Separator className="w-56" />
                <div className="flex justify-between w-56">
                  <span className="text-base font-bold text-[var(--text-forest)]">Total</span>
                  <span className="text-base font-bold text-[var(--accent-teal)]">{formatCurrency(total, currSymbol)}</span>
                </div>
              </div>

              {/* Notes */}
              {(notes || paymentTerms) && (
                <>
                  <Separator className="my-6" />
                  {notes && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--text-olive)] uppercase mb-1">Notes</p>
                      <p className="text-sm text-[var(--text-forest)] whitespace-pre-line">{notes}</p>
                    </div>
                  )}
                  {paymentTerms && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-olive)] uppercase mb-1">Payment Terms</p>
                      <p className="text-sm text-[var(--text-forest)]">{paymentTerms}</p>
                    </div>
                  )}
                </>
              )}
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
