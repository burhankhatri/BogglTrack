"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Download,
  Filter,
  BarChart3,
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

const PIE_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---- Helpers ----

function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  const todayEnd = endOfDay(now);
  switch (preset) {
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
  from: Date;
  to: Date;
  projectIds: string[];
  clientIds: string[];
  billable: BillableFilter;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("from", filters.from.toISOString());
  params.set("to", filters.to.toISOString());
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
  const [datePreset, setDatePreset] = useState<DatePreset>("last-30");
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
      return { from: startOfDay(customFrom), to: endOfDay(customTo) };
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

  // Fetch data for active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildFilterParams(filters);

      if (activeTab === "summary") {
        params.set("groupBy", groupBy);
        const res = await fetch(`/api/reports/summary?${params}`);
        if (res.ok) setSummaryData(await res.json());
      } else if (activeTab === "detailed") {
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
      `${format(filters.from, "MMM d, yyyy")} - ${format(filters.to, "MMM d, yyyy")}`,
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

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto py-8 px-4 lg:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight mb-1">Reports</h1>
          <p className="text-[15px] text-[var(--text-olive)]">Analyze your time and track your earnings.</p>
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

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date Preset */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Date Range
              </label>
              <Select
                value={datePreset}
                onValueChange={(val: string) => val && setDatePreset(val as DatePreset)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-30">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Pickers */}
            {datePreset === "custom" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    From
                  </label>
                  <Popover>
                    <PopoverTrigger>
                      <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                        <CalendarIcon className="size-3.5 mr-1.5" />
                        {customFrom ? format(customFrom, "MMM d, yyyy") : "Pick date"}
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
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    To
                  </label>
                  <Popover>
                    <PopoverTrigger>
                      <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                        <CalendarIcon className="size-3.5 mr-1.5" />
                        {customTo ? format(customTo, "MMM d, yyyy") : "Pick date"}
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
                </div>
              </>
            )}

            {/* Project Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Projects
              </label>
              <Popover>
                <PopoverTrigger>
                  <Button variant="outline" size="sm">
                    <Filter className="size-3.5 mr-1.5" />
                    {selectedProjectIds.length === 0
                      ? "All Projects"
                      : `${selectedProjectIds.length} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted"
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
                          <span className="text-indigo-500 text-xs font-bold">
                            &#10003;
                          </span>
                        )}
                      </button>
                    ))}
                    {projects.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        No projects found.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Client Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Clients
              </label>
              <Popover>
                <PopoverTrigger>
                  <Button variant="outline" size="sm">
                    <Filter className="size-3.5 mr-1.5" />
                    {selectedClientIds.length === 0
                      ? "All Clients"
                      : `${selectedClientIds.length} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted"
                        onClick={() =>
                          setSelectedClientIds((ids) => toggleId(ids, c.id))
                        }
                      >
                        <span className="flex-1 truncate">{c.name}</span>
                        {selectedClientIds.includes(c.id) && (
                          <span className="text-indigo-500 text-xs font-bold">
                            &#10003;
                          </span>
                        )}
                      </button>
                    ))}
                    {clients.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        No clients found.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Billable Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Billable
              </label>
              <Select
                value={billableFilter}
                onValueChange={(val: string) =>
                  val && setBillableFilter(val as BillableFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="billable">Billable Only</SelectItem>
                  <SelectItem value="non-billable">Non-Billable Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply */}
            <Button size="sm" onClick={fetchData}>
              <BarChart3 className="size-3.5 mr-1.5" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

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
            {/* Group By Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Group by:
              </span>
              {(["project", "client", "tag"] as GroupBy[]).map((g) => (
                <Button
                  key={g}
                  variant={groupBy === g ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setGroupBy(g)}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>

            {loading ? (
              <SummarySkeleton />
            ) : summaryData ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Summary Table */}
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
                            <TableCell className="text-right text-emerald-600 font-medium">
                              {formatCurrency(g.totalEarnings)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {g.percentage.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                        {summaryData.groups.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
                            <TableCell className="text-right text-emerald-600 font-bold">
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

                {/* Pie/Donut Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summaryData.groups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No data to display.
                      </p>
                    ) : (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={summaryData.groups.map((g) => ({
                                name: g.name,
                                value: g.totalSeconds / 3600,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {summaryData.groups.map((g, i) => (
                                <Cell
                                  key={g.id}
                                  fill={g.color || PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0];
                                return (
                                  <div className="rounded-lg bg-popover px-3 py-2 shadow-md ring-1 ring-foreground/10">
                                    <p className="text-sm font-medium">{d.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(d.value as number).toFixed(1)}h
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Legend
                              formatter={(value: string) => (
                                <span className="text-xs">{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {e.project?.client?.name || (
                              <span className="text-muted-foreground">-</span>
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
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatDuration(e.duration || 0)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">
                            {formatCurrency(e.earnings)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sortedEntries.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground py-8"
                          >
                            No entries for this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {detailedData.totalCount > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {page + 1} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft className="size-3.5 mr-1" />
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
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
                                      <span className="text-muted-foreground text-xs">
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
                              className="text-center text-muted-foreground py-8"
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
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onToggle(field)}
      >
        {label}
        <ArrowUpDown
          className={`size-3 ${current === field ? "text-foreground" : "text-muted-foreground/50"}`}
        />
        {current === field && (
          <span className="text-[10px] text-muted-foreground">
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-full" />
        </CardContent>
      </Card>
    </div>
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
