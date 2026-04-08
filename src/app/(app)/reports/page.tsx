"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CalendarIcon,
} from "lucide-react";
import {
  format,
  startOfWeek,
  startOfMonth,
  subDays,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import jsPDF from "jspdf";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatHours, formatCurrency, formatDuration } from "@/lib/earnings";
import { useAppStore } from "@/stores/app-store";

// ---- Types ----

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Client {
  id: string;
  name: string;
}

interface SummaryGroup {
  id: string;
  name: string;
  color?: string;
  totalSeconds: number;
  totalEarnings: number;
  percentage: number;
}

interface SummaryData {
  groups: SummaryGroup[];
  totals: { totalSeconds: number; totalEarnings: number };
}

interface DetailedEntry {
  id: string;
  description: string | null;
  startTime: string;
  duration: number | null;
  billable: boolean;
  earnings: number;
  rate: number;
  project: {
    id: string;
    name: string;
    color: string;
    client: { id: string; name: string } | null;
  } | null;
  tags: { tagId: string; tag: { id: string; name: string; color: string } }[];
}

interface DetailedData {
  entries: DetailedEntry[];
  totalCount: number;
}

interface WeeklyRow {
  projectId: string;
  projectName: string;
  projectColor: string;
  days: number[];
}

interface WeeklyData {
  grid: WeeklyRow[];
  columnTotals: number[];
}

type DatePreset =
  | "all-time"
  | "today"
  | "this-week"
  | "this-month"
  | "last-month"
  | "last-30"
  | "custom";

type BillableFilter = "all" | "billable" | "non-billable";
type GroupBy = "project" | "client" | "tag";
type SortField =
  | "date"
  | "description"
  | "project"
  | "client"
  | "duration"
  | "earnings";
type SortDir = "asc" | "desc";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  "all-time": "All Time",
  today: "Today",
  "this-week": "This Week",
  "this-month": "This Month",
  "last-month": "Last Month",
  "last-30": "Last 30 Days",
  custom: "Custom",
};

// ---- Helpers ----

function getDateRange(preset: DatePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  const todayEnd = endOfDay(now);
  switch (preset) {
    case "all-time":
      return { from: null, to: null };
    case "today":
      return { from: startOfDay(now), to: todayEnd };
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
      return { from: startOfDay(subDays(now, 29)), to: todayEnd };
  }
}

function buildFilterParams(filters: {
  from: Date | null;
  to: Date | null;
  projectIds: string[];
  clientIds: string[];
  billable: BillableFilter;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from.toISOString());
  if (filters.to) params.set("to", filters.to.toISOString());
  if (filters.projectIds.length > 0) {
    params.set("projectIds", filters.projectIds.join(","));
  }
  if (filters.clientIds.length > 0) {
    params.set("clientIds", filters.clientIds.join(","));
  }
  if (filters.billable === "billable") {
    params.set("billable", "true");
  } else if (filters.billable === "non-billable") {
    params.set("billable", "false");
  }
  return params;
}

// ---- Component ----

export default function ReportsPage() {
  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("all-time");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [billableFilter, setBillableFilter] = useState<BillableFilter>("all");

  // Reference data (from app store)
  const projects = (useAppStore((s) => s.projects.data) ?? []) as Project[];
  const clients = (useAppStore((s) => s.clients.data) ?? []) as Client[];

  // Tab data
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);

  // Summary groupBy
  const [groupBy, setGroupBy] = useState<GroupBy>("project");

  // Detailed pagination & sort
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const pageSize = 20;

  // Load reference data via app store (cached / deduplicated)
  useEffect(() => {
    const appStore = useAppStore.getState();
    appStore.fetchProjects();
    appStore.fetchClients();
  }, []);

  // Compute active date range
  const dateRange = useMemo(() => {
    if (datePreset === "custom" && customFrom && customTo) {
      return { from: startOfDay(customFrom) as Date | null, to: endOfDay(customTo) as Date | null };
    }
    return getDateRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const filters = useMemo(
    () => ({
      from: dateRange.from,
      to: dateRange.to,
      projectIds: selectedProjectIds,
      clientIds: selectedClientIds,
      billable: billableFilter,
    }),
    [dateRange, selectedProjectIds, selectedClientIds, billableFilter]
  );

  // Fetch data for active tab + always fetch summary for sidebar
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildFilterParams(filters);

      // Always fetch summary for the insights sidebar
      const summaryParams = new URLSearchParams(params);
      summaryParams.set("groupBy", groupBy);
      const summaryRes = await fetch(`/api/reports/summary?${summaryParams}`);
      if (summaryRes.ok) setSummaryData(await summaryRes.json());

      if (activeTab === "detailed") {
        params.set("limit", String(pageSize));
        params.set("offset", String(page * pageSize));
        const res = await fetch(`/api/reports/detailed?${params}`);
        if (res.ok) setDetailedData(await res.json());
      } else if (activeTab === "weekly") {
        const res = await fetch(`/api/reports/weekly?${params}`);
        if (res.ok) setWeeklyData(await res.json());
      }
    } catch (err) {
      console.error("Report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, groupBy, page]);

  // Auto-fetch on filter/tab change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filters, sortField, sortDir]);

  // Sort detailed entries client-side
  const sortedEntries = useMemo(() => {
    if (!detailedData) return [];
    const entries = [...detailedData.entries];
    entries.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp =
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          break;
        case "description":
          cmp = (a.description || "").localeCompare(b.description || "");
          break;
        case "project":
          cmp = (a.project?.name || "").localeCompare(b.project?.name || "");
          break;
        case "client":
          cmp = (a.project?.client?.name || "").localeCompare(
            b.project?.client?.name || ""
          );
          break;
        case "duration":
          cmp = (a.duration || 0) - (b.duration || 0);
          break;
        case "earnings":
          cmp = a.earnings - b.earnings;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return entries;
  }, [detailedData, sortField, sortDir]);

  const totalPages = detailedData
    ? Math.max(1, Math.ceil(detailedData.totalCount / pageSize))
    : 1;

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Export CSV
  const exportCSV = async () => {
    const params = buildFilterParams(filters);
    params.set("limit", "10000");
    params.set("offset", "0");
    const res = await fetch(`/api/reports/detailed?${params}`);
    if (!res.ok) return;
    const data: DetailedData = await res.json();

    const header = "Date,Description,Project,Client,Tags,Duration,Billable,Earnings";
    const rows = data.entries.map((e) => {
      const date = format(new Date(e.startTime), "yyyy-MM-dd");
      const desc = `"${(e.description || "").replace(/"/g, '""')}"`;
      const proj = `"${e.project?.name || ""}"`;
      const client = `"${e.project?.client?.name || ""}"`;
      const tags = `"${e.tags.map((t) => t.tag.name).join(", ")}"`;
      const dur = formatDuration(e.duration || 0);
      const bill = e.billable ? "Yes" : "No";
      const earn = e.earnings.toFixed(2);
      return `${date},${desc},${proj},${client},${tags},${dur},${bill},${earn}`;
    });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boggltrack-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF
  const exportPDF = async () => {
    const params = buildFilterParams(filters);
    params.set("limit", "10000");
    params.set("offset", "0");
    const res = await fetch(`/api/reports/detailed?${params}`);
    if (!res.ok) return;
    const data: DetailedData = await res.json();

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("BogglTrack Report", 14, 20);
    doc.setFontSize(10);
    doc.text(
      filters.from && filters.to
        ? `${format(filters.from, "MMM d, yyyy")} - ${format(filters.to, "MMM d, yyyy")}`
        : "All Time",
      14,
      28
    );

    const headers = ["Date", "Description", "Project", "Duration", "Earnings"];
    const colWidths = [28, 90, 50, 30, 30];
    let y = 38;

    // Header row
    doc.setFillColor(79, 70, 229);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.rect(14, y - 5, colWidths.reduce((a, b) => a + b, 0), 8, "F");
    let x = 14;
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y);
      x += colWidths[i];
    });
    y += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);

    for (const entry of data.entries) {
      if (y > 185) {
        doc.addPage();
        y = 20;
      }
      x = 14;
      const row = [
        format(new Date(entry.startTime), "MMM d, yyyy"),
        (entry.description || "(no description)").substring(0, 50),
        (entry.project?.name || "").substring(0, 28),
        formatDuration(entry.duration || 0),
        formatCurrency(entry.earnings),
      ];
      row.forEach((cell, i) => {
        doc.text(cell, x + 2, y);
        x += colWidths[i];
      });
      y += 6;
    }

    doc.save(`boggltrack-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  // Multi-select toggle helper
  const toggleId = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

  // Date range display text
  const dateRangeLabel = useMemo(() => {
    if (datePreset === "custom" && customFrom && customTo) {
      return `${format(customFrom, "MMM d, yyyy")} - ${format(customTo, "MMM d, yyyy")}`;
    }
    if (datePreset !== "custom" && dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    return DATE_PRESET_LABELS[datePreset];
  }, [datePreset, customFrom, customTo, dateRange]);

  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight">
            Reports
          </h1>
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-olive)] bg-[var(--bg-cream)] border border-[var(--border-medium)] rounded-full px-3 py-1.5 shadow-sm">
            <CalendarIcon className="size-3.5" />
            <span className="font-medium">{dateRangeLabel}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full shadow-sm text-[13px] h-[36px] px-4" onClick={exportCSV}>
            <Download className="size-3.5 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" className="rounded-full shadow-sm text-[13px] h-[36px] px-4" onClick={exportPDF}>
            <Download className="size-3.5 mr-1.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-6 items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Compact filter bar */}
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
                <SelectItem value="today">Today</SelectItem>
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
                  <PopoverTrigger>
                    <Button variant="outline" size="sm" className="rounded-full h-9 text-[13px] px-3">
                      <CalendarIcon className="size-3.5 mr-1.5" />
                      {customFrom ? format(customFrom, "MMM d") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={(d: Date | undefined) => setCustomFrom(d)}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-[var(--text-olive)] text-xs">to</span>
                <Popover>
                  <PopoverTrigger>
                    <Button variant="outline" size="sm" className="rounded-full h-9 text-[13px] px-3">
                      <CalendarIcon className="size-3.5 mr-1.5" />
                      {customTo ? format(customTo, "MMM d") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={(d: Date | undefined) => setCustomTo(d)}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            <div className="w-px h-5 bg-[var(--border-medium)]" />

            <Popover>
              <PopoverTrigger>
                <Button variant="outline" size="sm" className="rounded-full h-9 text-[13px] px-3">
                  <Filter className="size-3.5 mr-1.5" />
                  {selectedProjectIds.length === 0
                    ? "All Projects"
                    : `${selectedProjectIds.length} project${selectedProjectIds.length > 1 ? "s" : ""}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-[var(--bg-muted)]"
                      onClick={() =>
                        setSelectedProjectIds((ids) => toggleId(ids, p.id))
                      }
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      {selectedProjectIds.includes(p.id) && (
                        <span className="text-[var(--accent-teal)] text-xs font-bold">
                          &#10003;
                        </span>
                      )}
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <p className="text-xs text-[var(--text-olive)] px-2 py-1">
                      No projects found.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger>
                <Button variant="outline" size="sm" className="rounded-full h-9 text-[13px] px-3">
                  <Filter className="size-3.5 mr-1.5" />
                  {selectedClientIds.length === 0
                    ? "All Clients"
                    : `${selectedClientIds.length} client${selectedClientIds.length > 1 ? "s" : ""}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-[var(--bg-muted)]"
                      onClick={() =>
                        setSelectedClientIds((ids) => toggleId(ids, c.id))
                      }
                    >
                      <span className="flex-1 truncate">{c.name}</span>
                      {selectedClientIds.includes(c.id) && (
                        <span className="text-[var(--accent-teal)] text-xs font-bold">
                          &#10003;
                        </span>
                      )}
                    </button>
                  ))}
                  {clients.length === 0 && (
                    <p className="text-xs text-[var(--text-olive)] px-2 py-1">
                      No clients found.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Select
              value={billableFilter}
              onValueChange={(val: string) =>
                val && setBillableFilter(val as BillableFilter)
              }
            >
              <SelectTrigger className="h-9 rounded-full text-[13px] w-auto min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="billable">Billable</SelectItem>
                <SelectItem value="non-billable">Non-Billable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(val: string) => val && setActiveTab(val)}>
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary">
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-olive)]">
                    Group by:
                  </span>
                  {(["project", "client", "tag"] as GroupBy[]).map((g) => (
                    <Button
                      key={g}
                      variant={groupBy === g ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-3 text-xs rounded-full"
                      onClick={() => setGroupBy(g)}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Button>
                  ))}
                </div>

                {loading ? (
                  <SummarySkeleton />
                ) : summaryData ? (
                  <Card>
                    <CardContent className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead className="text-right">Earnings</TableHead>
                            <TableHead className="text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaryData.groups.map((g) => (
                            <TableRow key={g.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {g.color && (
                                    <span
                                      className="size-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: g.color }}
                                    />
                                  )}
                                  <span className="font-medium">{g.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatHours(g.totalSeconds)}
                              </TableCell>
                              <TableCell className="text-right text-[var(--accent-teal)] font-medium">
                                {formatCurrency(g.totalEarnings)}
                              </TableCell>
                              <TableCell className="text-right text-[var(--text-olive)]">
                                {g.percentage.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                          {summaryData.groups.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-[var(--text-olive)] py-8">
                                No data for this period.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                        {summaryData.groups.length > 0 && (
                          <TableFooter>
                            <TableRow>
                              <TableCell className="font-bold">Total</TableCell>
                              <TableCell className="text-right font-mono tabular-nums font-bold">
                                {formatHours(summaryData.totals.totalSeconds)}
                              </TableCell>
                              <TableCell className="text-right text-[var(--accent-teal)] font-bold">
                                {formatCurrency(summaryData.totals.totalEarnings)}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                100%
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        )}
                      </Table>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>

            {/* Detailed Tab */}
            <TabsContent value="detailed">
              <div className="mt-4">
                {loading ? (
                  <DetailedSkeleton />
                ) : detailedData ? (
                  <Card>
                    <CardContent className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableHead
                              field="date"
                              label="Date"
                              current={sortField}
                              dir={sortDir}
                              onToggle={toggleSort}
                            />
                            <SortableHead
                              field="description"
                              label="Description"
                              current={sortField}
                              dir={sortDir}
                              onToggle={toggleSort}
                            />
                            <SortableHead
                              field="project"
                              label="Project"
                              current={sortField}
                              dir={sortDir}
                              onToggle={toggleSort}
                            />
                            <SortableHead
                              field="client"
                              label="Client"
                              current={sortField}
                              dir={sortDir}
                              onToggle={toggleSort}
                              className="hidden md:table-cell"
                            />
                            <TableHead className="hidden lg:table-cell">Tags</TableHead>
                            <SortableHead
                              field="duration"
                              label="Duration"
                              current={sortField}
                              dir={sortDir}
                              onToggle={toggleSort}
                              className="text-right"
                            />
                            <SortableHead
                              field="earnings"
                              label="Earnings"
                              current={sortField}
                              dir={sortDir}
                              onToggle={toggleSort}
                              className="text-right"
                            />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedEntries.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell>
                                {format(new Date(e.startTime), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {e.description || "(no description)"}
                              </TableCell>
                              <TableCell>
                                {e.project ? (
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="size-2 rounded-full shrink-0"
                                      style={{
                                        backgroundColor: e.project.color,
                                      }}
                                    />
                                    <span className="truncate max-w-[200px]">
                                      {e.project.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[var(--text-olive)]">-</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {e.project?.client?.name || (
                                  <span className="text-[var(--text-olive)]">-</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <div className="flex flex-wrap gap-1">
                                  {e.tags.map((t) => (
                                    <Badge
                                      key={t.tagId}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {t.tag.name}
                                    </Badge>
                                  ))}
                                  {e.tags.length === 0 && (
                                    <span className="text-[var(--text-olive)]">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatDuration(e.duration || 0)}
                              </TableCell>
                              <TableCell className="text-right text-[var(--accent-teal)] font-medium">
                                {formatCurrency(e.earnings)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {sortedEntries.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center text-[var(--text-olive)] py-8"
                              >
                                No entries for this period.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>

                      {detailedData.totalCount > 0 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                          <p className="text-sm text-[var(--text-olive)]">
                            Page {page + 1} of {totalPages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              disabled={page === 0}
                              onClick={() => setPage((p) => Math.max(0, p - 1))}
                            >
                              <ChevronLeft className="size-3.5 mr-1" />
                              Prev
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              disabled={page >= totalPages - 1}
                              onClick={() => setPage((p) => p + 1)}
                            >
                              Next
                              <ChevronRight className="size-3.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>

            {/* Weekly Tab */}
            <TabsContent value="weekly">
              <div className="mt-4">
                {loading ? (
                  <WeeklySkeleton />
                ) : weeklyData ? (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[140px]">
                                Project
                              </TableHead>
                              {DAY_NAMES.map((d) => (
                                <TableHead key={d} className="text-center w-20">
                                  {d}
                                </TableHead>
                              ))}
                              <TableHead className="text-right w-20">
                                Total
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {weeklyData.grid.map((row) => {
                              const rowTotal = row.days.reduce(
                                (sum, d) => sum + d,
                                0
                              );
                              const maxDay = Math.max(...row.days, 1);
                              return (
                                <TableRow key={row.projectId}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="size-2.5 rounded-full shrink-0"
                                        style={{
                                          backgroundColor: row.projectColor,
                                        }}
                                      />
                                      <span className="font-medium truncate max-w-[200px]">
                                        {row.projectName}
                                      </span>
                                    </div>
                                  </TableCell>
                                  {row.days.map((seconds, i) => {
                                    const hours = seconds / 3600;
                                    const intensity =
                                      seconds > 0
                                        ? Math.max(0.1, seconds / maxDay)
                                        : 0;
                                    return (
                                      <TableCell key={i} className="text-center">
                                        {seconds > 0 ? (
                                          <span
                                            className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium"
                                            style={{
                                              backgroundColor: `${row.projectColor}${Math.round(intensity * 40).toString(16).padStart(2, "0")}`,
                                              color:
                                                intensity > 0.5
                                                  ? row.projectColor
                                                  : undefined,
                                            }}
                                          >
                                            {hours.toFixed(1)}h
                                          </span>
                                        ) : (
                                          <span className="text-[var(--text-olive)] text-xs">
                                            -
                                          </span>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-right font-mono tabular-nums font-medium">
                                    {formatHours(rowTotal)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {weeklyData.grid.length === 0 && (
                              <TableRow>
                                <TableCell
                                  colSpan={9}
                                  className="text-center text-[var(--text-olive)] py-8"
                                >
                                  No data for this week.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          {weeklyData.grid.length > 0 && (
                            <TableFooter>
                              <TableRow>
                                <TableCell className="font-bold">Total</TableCell>
                                {weeklyData.columnTotals.map((seconds, i) => (
                                  <TableCell
                                    key={i}
                                    className="text-center font-mono tabular-nums font-bold"
                                  >
                                    {seconds > 0
                                      ? `${(seconds / 3600).toFixed(1)}h`
                                      : "-"}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right font-mono tabular-nums font-bold">
                                  {formatHours(
                                    weeklyData.columnTotals.reduce(
                                      (a, b) => a + b,
                                      0
                                    )
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Insights Sidebar */}
        <div className="hidden lg:block w-80 shrink-0">
          <InsightsPanel summaryData={summaryData} loading={loading} />
        </div>
      </div>

      {/* Mobile insights — below main content */}
      <div className="lg:hidden mt-6">
        <InsightsPanel summaryData={summaryData} loading={loading} />
      </div>
    </div>
  );
}

// ---- Insights Sidebar ----

function InsightsPanel({
  summaryData,
  loading,
}: {
  summaryData: SummaryData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="sticky top-8">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalSeconds = summaryData?.totals.totalSeconds ?? 0;
  const totalEarnings = summaryData?.totals.totalEarnings ?? 0;
  const groups = summaryData?.groups ?? [];
  const maxSeconds = Math.max(...groups.map((g) => g.totalSeconds), 1);

  return (
    <Card className="sticky top-8">
      <CardContent className="pt-6">
        <h3 className="text-[13px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-4">
          Insights
        </h3>

        {/* Total Work Time */}
        <div className="mb-6">
          <p className="text-[13px] text-[var(--text-olive)] mb-1">Work time</p>
          <p className="text-3xl font-bold text-[var(--text-forest)] tabular-nums font-mono tracking-tight">
            {formatHours(totalSeconds)}
          </p>
        </div>

        {/* Total Earnings */}
        <div className="mb-8">
          <p className="text-[13px] text-[var(--text-olive)] mb-1">Earnings</p>
          <p className="text-2xl font-bold text-[var(--accent-teal)] tabular-nums">
            {formatCurrency(totalEarnings)}
          </p>
        </div>

        {/* Project Breakdown */}
        {groups.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-3">
              {groups.length} {groups.length === 1 ? "Project" : "Projects"}
            </p>
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {g.color && (
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                      )}
                      <span className="text-sm font-medium text-[var(--text-forest)] truncate">
                        {g.name}
                      </span>
                    </div>
                    <span className="text-sm font-mono tabular-nums text-[var(--text-forest)] ml-2 shrink-0">
                      {formatHours(g.totalSeconds)}
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-full transition-all duration-500 ease-in-out rounded-full"
                      style={{
                        width: `${Math.max(2, (g.totalSeconds / maxSeconds) * 100)}%`,
                        backgroundColor: g.color || "var(--accent-teal)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.length === 0 && (
          <p className="text-sm text-[var(--text-olive)]">
            No data for this period.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Sub-components ----

function SortableHead({
  field,
  label,
  current,
  dir,
  onToggle,
  className,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-[var(--text-forest)] transition-colors"
        onClick={() => onToggle(field)}
      >
        {label}
        <ArrowUpDown
          className={`size-3 ${current === field ? "text-[var(--text-forest)]" : "text-[var(--text-olive)]/50"}`}
        />
        {current === field && (
          <span className="text-[10px] text-[var(--text-olive)]">
            {dir === "asc" ? "asc" : "desc"}
          </span>
        )}
      </button>
    </TableHead>
  );
}

// ---- Skeletons ----

function SummarySkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function DetailedSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function WeeklySkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
