"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Play,
  Pencil,
  Trash2,
  Plus,
  Clock,
  Check,
  X,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isToday,
  isYesterday,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useTimerStore } from "@/stores/timer-store";
import {
  formatDuration,
  formatCurrency,
  calculateEarnings,
  getApplicableRate,
} from "@/lib/earnings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TimeEntryTag {
  tagId: string;
  tag: Tag;
}

interface Project {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
  client?: { id: string; name: string } | null;
}

interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: Project | null;
  tags: TimeEntryTag[];
}

interface DayGroup {
  date: Date;
  label: string;
  entries: TimeEntry[];
  totalSeconds: number;
  totalEarnings: number;
}

// ---------------------------------------------------------------------------
// Helper: no-project sentinel value for Select
// ---------------------------------------------------------------------------
const NO_PROJECT = "__none__";

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TimerPage() {
  // Data state
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [userDefaultRate, setUserDefaultRate] = useState<number>(0);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  // Manual entry form state
  const [manualDate, setManualDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [manualStartTime, setManualStartTime] = useState("09:00");
  const [manualEndTime, setManualEndTime] = useState("10:00");
  const [manualDescription, setManualDescription] = useState("");
  const [manualProjectId, setManualProjectId] = useState<string>(NO_PROJECT);
  const [manualBillable, setManualBillable] = useState(true);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState<string>(NO_PROJECT);
  const [editBillable, setEditBillable] = useState(true);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Timer store
  const { startTimer } = useTimerStore();

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries?limit=50");
      if (res.ok) {
        const data: TimeEntry[] = await res.json();
        setEntries(data);
      }
    } catch {
      toast.error("Failed to load time entries");
    }
  }, []);

  const fetchWeeklySummary = useCallback(
    async (rate: number) => {
      try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        const res = await fetch(
          `/api/time-entries?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`
        );
        if (res.ok) {
          const data: TimeEntry[] = await res.json();
          let totalSec = 0;
          let totalEarn = 0;
          for (const e of data) {
            if (e.duration) {
              totalSec += e.duration;
              const r = getApplicableRate(e.project?.hourlyRate ?? null, rate);
              totalEarn += calculateEarnings(e.duration, r, e.billable);
            }
          }
          setWeeklyHours(totalSec / 3600);
          setWeeklyEarnings(totalEarn);
        }
      } catch {
        // Non-critical — fail silently
      }
    },
    []
  );

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [settingsRes, projectsRes, tagsRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/projects"),
          fetch("/api/tags"),
        ]);

        let rate = 0;
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          rate = settings.defaultHourlyRate ?? 0;
          setUserDefaultRate(rate);
        }
        if (projectsRes.ok) {
          setProjects(await projectsRes.json());
        }
        if (tagsRes.ok) {
          setTags(await tagsRes.json());
        }

        await Promise.all([fetchEntries(), fetchWeeklySummary(rate)]);
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    init();

    const handleTimerStopped = () => {
      fetchEntries();
      fetchWeeklySummary(userDefaultRate);
    };
    window.addEventListener("timer-stopped", handleTimerStopped);
    return () => window.removeEventListener("timer-stopped", handleTimerStopped);
  }, [fetchEntries, fetchWeeklySummary, userDefaultRate]);

  // ---------------------------------------------------------------------------
  // Grouping entries by day
  // ---------------------------------------------------------------------------

  function groupByDay(list: TimeEntry[]): DayGroup[] {
    const groups: DayGroup[] = [];
    for (const entry of list) {
      // Skip running entries (no endTime) from the list
      if (!entry.endTime) continue;

      const entryDate = parseISO(entry.startTime);
      let group = groups.find((g) => isSameDay(g.date, entryDate));
      if (!group) {
        let label: string;
        if (isToday(entryDate)) {
          label = `Today, ${format(entryDate, "MMMM d")}`;
        } else if (isYesterday(entryDate)) {
          label = `Yesterday, ${format(entryDate, "MMMM d")}`;
        } else {
          label = format(entryDate, "EEEE, MMMM d");
        }
        group = {
          date: entryDate,
          label,
          entries: [],
          totalSeconds: 0,
          totalEarnings: 0,
        };
        groups.push(group);
      }
      group.entries.push(entry);
      const dur = entry.duration ?? 0;
      group.totalSeconds += dur;
      const rate = getApplicableRate(
        entry.project?.hourlyRate ?? null,
        userDefaultRate
      );
      group.totalEarnings += calculateEarnings(dur, rate, entry.billable);
    }
    return groups;
  }

  const dayGroups = groupByDay(entries);

  // ---------------------------------------------------------------------------
  // Manual entry submission
  // ---------------------------------------------------------------------------

  async function handleManualAdd() {
    if (!manualDate || !manualStartTime || !manualEndTime) {
      toast.error("Please fill in date, start time, and end time");
      return;
    }

    const startISO = `${manualDate}T${manualStartTime}:00`;
    const endISO = `${manualDate}T${manualEndTime}:00`;

    if (new Date(endISO) <= new Date(startISO)) {
      toast.error("End time must be after start time");
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: manualDescription,
          startTime: new Date(startISO).toISOString(),
          endTime: new Date(endISO).toISOString(),
          projectId:
            manualProjectId === NO_PROJECT ? null : manualProjectId,
          billable: manualBillable,
          tagIds: [],
        }),
      });

      if (!res.ok) {
        toast.error("Failed to create entry");
        return;
      }

      toast.success("Time entry added");
      setManualDescription("");
      setManualStartTime("09:00");
      setManualEndTime("10:00");
      setManualProjectId(NO_PROJECT);
      setManualBillable(true);

      await Promise.all([fetchEntries(), fetchWeeklySummary(userDefaultRate)]);
    } catch {
      toast.error("Failed to create entry");
    } finally {
      setManualSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Inline edit
  // ---------------------------------------------------------------------------

  function startEditing(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditDescription(entry.description);
    setEditProjectId(entry.projectId ?? NO_PROJECT);
    setEditBillable(entry.billable);
  }

  async function saveEdit(entryId: string) {
    try {
      const res = await fetch(`/api/time-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription,
          projectId:
            editProjectId === NO_PROJECT ? null : editProjectId,
          billable: editBillable,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to update entry");
        return;
      }

      toast.success("Entry updated");
      setEditingId(null);
      await Promise.all([fetchEntries(), fetchWeeklySummary(userDefaultRate)]);
    } catch {
      toast.error("Failed to update entry");
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  // ---------------------------------------------------------------------------
  // Delete entry
  // ---------------------------------------------------------------------------

  async function handleDelete(entryId: string) {
    try {
      const res = await fetch(`/api/time-entries/${entryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Failed to delete entry");
        return;
      }

      toast.success("Entry deleted");
      setDeletingId(null);
      await Promise.all([fetchEntries(), fetchWeeklySummary(userDefaultRate)]);
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  // ---------------------------------------------------------------------------
  // Resume (start new timer with same details)
  // ---------------------------------------------------------------------------

  async function handleResume(entry: TimeEntry) {
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: entry.description,
          startTime: new Date().toISOString(),
          projectId: entry.projectId,
          billable: entry.billable,
          tagIds: entry.tags.map((t) => t.tagId),
        }),
      });

      if (!res.ok) {
        toast.error("Failed to start timer");
        return;
      }

      const newEntry = await res.json();
      const rate = getApplicableRate(
        entry.project?.hourlyRate ?? null,
        userDefaultRate
      );

      startTimer({
        entryId: newEntry.id,
        startTime: newEntry.startTime,
        description: entry.description,
        projectId: entry.projectId,
        billable: entry.billable,
        tagIds: entry.tags.map((t) => t.tagId),
        hourlyRate: rate,
      });

      toast.success("Timer started");
    } catch {
      toast.error("Failed to start timer");
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function formatDurationHM(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-[var(--text-olive)]">
          <Clock className="h-5 w-5 animate-pulse" />
          <span className="font-sans">Loading timer...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:pt-10 space-y-10">
      {/* Mobile Header */}
      <div className="flex items-center justify-between md:hidden px-2 mb-4">
        <h1 className="text-[32px] font-serif font-semibold text-[var(--text-forest)] tracking-tight">Today</h1>
      </div>

      {/* Weekly summary bar */}
      <Card className="px-6 py-5 shadow-[var(--shadow-card)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-medium text-[var(--text-olive)]">
            <Clock className="h-[18px] w-[18px]" />
            <span>This week</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[18px] font-semibold tabular-nums text-[var(--text-forest)] font-sans">
              {weeklyHours.toFixed(1)} hrs
            </span>
            <span className="text-[18px] font-semibold text-[var(--accent-teal)] tabular-nums font-sans">
              {formatCurrency(weeklyEarnings)}
            </span>
          </div>
        </div>
      </Card>

      {/* Timer / Manual tabs */}
      <Tabs defaultValue="timer" className="w-full relative z-10 lg:px-0">
        <TabsList className="bg-[var(--bg-muted)] h-12 p-1 gap-1 border border-transparent rounded-full w-full max-w-[400px]">
          <TabsTrigger value="timer" className="rounded-full w-1/2 data-[state=active]:bg-[var(--bg-cream)] data-[state=active]:text-[var(--text-forest)] data-[state=active]:shadow-sm font-medium transition-colors">
            Timer
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-full w-1/2 text-[var(--text-olive)] data-[state=active]:text-[var(--text-forest)] data-[state=active]:bg-[var(--bg-cream)] data-[state=active]:shadow-sm font-medium transition-colors">
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timer">
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <Card className="px-6 py-6 space-y-5 shadow-[var(--shadow-card)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
            {/* Description */}
            <div className="relative">
              <Input
                placeholder="What did you work on?"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="w-full h-12 bg-transparent border-transparent shadow-none text-lg px-0 focus-visible:ring-0 placeholder:text-[var(--text-olive)]/60 text-[var(--text-forest)]"
              />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--border-subtle)]" />
            </div>

            {/* Date / Start / End row */}
            <div className="grid grid-cols-3 gap-6 pt-2">
              <div>
                <label className="text-[13px] font-medium text-[var(--text-olive)] mb-2 block">
                  Date
                </label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-lg)] h-10 font-sans text-sm"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[var(--text-olive)] mb-2 block">
                  Start time
                </label>
                <Input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-lg)] h-10 font-sans text-sm"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[var(--text-olive)] mb-2 block">
                  End time
                </label>
                <Input
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-lg)] h-10 font-sans text-sm"
                />
              </div>
            </div>

            {/* Project / Billable row */}
            <div className="flex items-end gap-4 pt-2">
              <div className="flex-1">
                <label className="text-[13px] font-medium text-[var(--text-olive)] mb-2 block">
                  Project
                </label>
                <Select
                  value={manualProjectId}
                  onValueChange={(v: string) => v && setManualProjectId(v)}
                >
                  <SelectTrigger className="bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-lg)] h-10">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant={manualBillable ? "default" : "outline"}
                size="sm"
                className={`shrink-0 gap-1.5 h-10 rounded-[var(--radius-lg)] ${manualBillable ? "bg-[var(--accent-olive)] text-[var(--text-forest)] hover:bg-[var(--accent-olive-hover)] shadow-sm" : "border-[var(--border-subtle)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)]"}`}
                onClick={() => setManualBillable(!manualBillable)}
              >
                <DollarSign className="h-4 w-4" />
                {manualBillable ? "Billable" : "Non-billable"}
              </Button>
            </div>

            {/* Submit */}
            <Button
              className="w-full h-[46px] rounded-full bg-[var(--text-forest)] text-[var(--text-cream)] hover:bg-[var(--text-forest)]/90 shadow-sm mt-4 text-[15px] font-medium"
              onClick={handleManualAdd}
              disabled={manualSubmitting}
            >
              <Plus className="mr-2 h-4 w-4" />
              {manualSubmitting ? "Adding..." : "Add Time Entry"}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Time entry list grouped by day */}
      <div className="space-y-8 lg:px-0">
        {dayGroups.length === 0 && (
          <Card className="px-6 py-16 text-center shadow-none border border-[var(--border-subtle)] border-dashed bg-transparent rounded-[var(--radius-xl)]">
            <p className="text-[15px] text-[var(--text-olive)] font-medium">No time entries. Your tracked time will appear here.</p>
          </Card>
        )}

        {dayGroups.map((group) => (
          <div key={group.label} className="space-y-4">
            {/* Day header */}
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-[18px] font-semibold font-serif text-[var(--text-forest)]">{group.label}</h2>
              <span className="tabular-nums font-sans text-[var(--text-olive)] font-medium tracking-wide">
                {formatDurationHM(group.totalSeconds)}
              </span>
            </div>

            {/* Entries */}
            <Card className="border border-[var(--border-subtle)] shadow-[var(--shadow-card)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)] overflow-hidden">
              <div className="flex flex-col">
                {group.entries.map((entry, index) => {
                  const isEditing = editingId === entry.id;
                  const isDeleting = deletingId === entry.id;
                  const dur = entry.duration ?? 0;
                  const rate = getApplicableRate(
                    entry.project?.hourlyRate ?? null,
                    userDefaultRate
                  );
                  const earnings = calculateEarnings(dur, rate, entry.billable);
                  const isLast = index === group.entries.length - 1;

                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 hover:bg-[var(--bg-sage)]/30 transition-colors group ${!isLast ? 'border-b border-[var(--border-subtle)]' : ''}`}
                    >
                      {isEditing ? (
                        /* ---- Inline edit mode ---- */
                        <div className="flex-1 flex items-center gap-3 flex-wrap">
                          <Input
                            className="flex-1 min-w-[180px] bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-lg)] h-10 font-sans text-[15px]"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                          />
                          <Select
                            value={editProjectId}
                            onValueChange={(v: string) => v && setEditProjectId(v)}
                          >
                            <SelectTrigger className="w-[180px] bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-lg)] h-10">
                              <SelectValue placeholder="No project" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_PROJECT}>
                                No project
                              </SelectItem>
                              {projects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    {p.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant={editBillable ? "default" : "outline"}
                            size="icon"
                            className={`h-[40px] w-[40px] rounded-[var(--radius-lg)] shadow-sm shrink-0 ${editBillable ? 'bg-[var(--accent-olive)] text-[var(--text-forest)]' : 'border-[var(--border-subtle)] text-[var(--text-olive)] hover:bg-[var(--bg-muted)]'}`}
                            onClick={() => setEditBillable(!editBillable)}
                          >
                            <DollarSign className="h-[18px] w-[18px]" />
                          </Button>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-[40px] w-[40px] rounded-full hover:bg-[var(--accent-olive)]/30 hover:text-[var(--text-forest)]"
                              onClick={() => saveEdit(entry.id)}
                            >
                              <Check className="h-5 w-5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-[40px] w-[40px] text-[var(--accent-coral)] rounded-full hover:bg-[var(--accent-coral)]/10"
                              onClick={cancelEdit}
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ---- Normal display mode ---- */
                        <>
                          {/* Left: Description + project + tags */}
                          <div className="flex flex-col gap-[6px] flex-1 min-w-0 pr-4">
                            <span className="text-[15px] font-medium text-[var(--text-forest)] leading-none truncate font-sans">
                              {entry.description || "(No description)"}
                            </span>
                            
                            {(entry.project || entry.tags.length > 0) && (
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {entry.project && (
                                  <Badge 
                                    variant="outline" 
                                    className="font-medium px-2.5 py-[2px] text-[12px] rounded-[var(--radius-md)] border-transparent"
                                    style={{ 
                                      color: entry.project.color,
                                      backgroundColor: `${entry.project.color}15`
                                    }}
                                  >
                                    {entry.project.name}
                                  </Badge>
                                )}
                                {entry.tags.map((t) => (
                                  <Badge
                                    key={t.tagId}
                                    variant="outline"
                                    className="font-medium px-2.5 py-[2px] text-[12px] rounded-[var(--radius-md)] border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-olive)]"
                                  >
                                    {t.tag.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right: Duration + Earnings + Play + Controls */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0">
                            <div className="flex flex-col sm:items-end">
                              {/* Duration */}
                              <span className="font-sans text-[16px] font-semibold tracking-tight text-[var(--text-forest)] tabular-nums">
                                {formatDuration(dur)}
                              </span>
                              {/* Earnings */}
                              {earnings > 0 && (
                                <span className="text-[13px] font-medium tabular-nums text-[var(--text-olive)] mt-[2px]">
                                  {formatCurrency(earnings)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 ml-2">
                              {/* Hover actions (edit/delete) */}
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                {isDeleting ? (
                                  <div className="flex items-center gap-1 bg-[var(--bg-cream)] rounded-[var(--radius-lg)] p-1 border border-[var(--border-subtle)] shadow-[var(--shadow-dropdown)] absolute right-24 z-10 transition-all">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-8 text-[12px] rounded-[var(--radius-md)] px-3 bg-[var(--accent-coral)] text-[var(--text-cream)] hover:bg-[#d66a6a]"
                                      onClick={() => handleDelete(entry.id)}
                                    >
                                      Delete
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-[12px] rounded-[var(--radius-md)] px-3 text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)]"
                                      onClick={() => setDeletingId(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] rounded-[var(--radius-lg)] flex items-center justify-center transition-colors shadow-none"
                                      onClick={() => startEditing(entry)}
                                      title="Edit"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--accent-coral)]/10 hover:text-[var(--accent-coral)] rounded-[var(--radius-lg)] flex items-center justify-center transition-colors shadow-none"
                                      onClick={() => setDeletingId(entry.id)}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Play Button */}
                              <button 
                                onClick={() => handleResume(entry)}
                                className="h-10 w-10 bg-[var(--accent-olive)] hover:bg-[var(--accent-olive-hover)] text-[var(--text-forest)] rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer shrink-0 ml-1"
                                title="Resume timer"
                              >
                                <Play className="h-[18px] w-[18px] fill-current ml-[2px]" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
