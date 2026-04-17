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
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EntryCommits } from "@/components/ui/entry-commits";
import { BackfillCommitsButton } from "@/components/timer/backfill-commits-button";

import { useAppStore } from "@/stores/app-store";
import {
  formatDuration,
  formatCurrency,
  calculateEarnings,
  getApplicableRate,
} from "@/lib/earnings";
import { resumeTimerOptimistic } from "@/lib/timer-actions";
import { parseEntryTimestamp, buildTimestampISO, validateTimeRange } from "./timestamp-helpers";

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

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
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
  commits?: AttachedCommit[] | null;
}

interface GroupedEntry {
  key: string;
  description: string;
  entries: TimeEntry[];
  totalDuration: number;
  billable: boolean;
  projectId: string | null;
  project: Project | null;
  tags: TimeEntryTag[];
  startTime: string;
  endTime: string | null;
}

interface DayGroup {
  date: Date;
  label: string;
  entries: TimeEntry[];
  grouped: GroupedEntry[];
  totalSeconds: number;
  totalEarnings: number;
}

// ---------------------------------------------------------------------------
// Helper: no-project sentinel value for Select
// ---------------------------------------------------------------------------
const NO_PROJECT = "__none__";
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_TAGS: Tag[] = [];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TimerPage() {
  // Data state — read from store for instant cached render
  const storeEntries = useAppStore((s) => s.timerEntries.data);
  const [entries, setEntries] = useState<TimeEntry[]>(storeEntries ?? []);
  const projects = (useAppStore((s) => s.projects.data) as Project[] | null) ?? EMPTY_PROJECTS;
  const tags = (useAppStore((s) => s.tags.data) as Tag[] | null) ?? EMPTY_TAGS;
  const settingsData = useAppStore((s) => s.settings.data);
  const userDefaultRate = settingsData?.defaultHourlyRate ?? 0;
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const storeLoading = useAppStore((s) => s.timerEntries.loading);
  const [loading, setLoading] = useState(!storeEntries);

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
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Timer store (used by resumeTimerOptimistic internally)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  // Compute weekly summary from entries (no separate API call)
  const computeWeeklySummary = useCallback(
    (entryList: TimeEntry[], rate: number) => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      let totalSec = 0;
      let totalEarn = 0;
      for (const e of entryList) {
        if (e.duration && new Date(e.startTime) >= weekStart) {
          totalSec += e.duration;
          const r = getApplicableRate(e.project?.hourlyRate ?? null, rate);
          totalEarn += calculateEarnings(e.duration, r, e.billable);
        }
      }
      setWeeklyHours(totalSec / 3600);
      setWeeklyEarnings(totalEarn);
    },
    []
  );

  const fetchEntries = useCallback(async () => {
    try {
      const data = await useAppStore.getState().fetchTimerEntries(true);
      setEntries(data);
      return data;
    } catch {
      toast.error("Failed to load time entries");
      return [];
    }
  }, []);

  useEffect(() => {
    const appStore = useAppStore.getState();
    async function init() {
      if (!storeEntries) setLoading(true);
      try {
        const [, , settingsResult, entriesResult] = await Promise.all([
          appStore.fetchProjects(),
          appStore.fetchTags(),
          appStore.fetchSettings(),
          appStore.fetchTimerEntries(),
        ]);
        setEntries(entriesResult);
        const rate = settingsResult?.defaultHourlyRate ?? 0;
        computeWeeklySummary(entriesResult, rate);
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    init();

    // Optimistic entry listeners
    const handleCompleted = (e: Event) => {
      const entry = (e as CustomEvent).detail;
      setEntries((prev) => [entry, ...prev]);
      if (entry.duration) {
        setWeeklyHours((prev) => prev + entry.duration / 3600);
        const rate = getApplicableRate(
          entry.project?.hourlyRate ?? null,
          useAppStore.getState().settings.data?.defaultHourlyRate ?? 0
        );
        const earn = calculateEarnings(entry.duration, rate, entry.billable);
        setWeeklyEarnings((prev) => prev + earn);
      }
    };
    const handleConfirmed = (e: Event) => {
      const confirmed = (e as CustomEvent).detail;
      setEntries((prev) =>
        prev.map((entry) => (entry.id === confirmed.id ? confirmed : entry))
      );
      // Re-fetch entries and recompute weekly summary
      fetchEntries().then((data) => {
        computeWeeklySummary(
          data,
          useAppStore.getState().settings.data?.defaultHourlyRate ?? 0
        );
      });
    };
    const handleFailed = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    };

    window.addEventListener("timer-entry-completed", handleCompleted);
    window.addEventListener("timer-entry-confirmed", handleConfirmed);
    window.addEventListener("timer-entry-failed", handleFailed);
    return () => {
      window.removeEventListener("timer-entry-completed", handleCompleted);
      window.removeEventListener("timer-entry-confirmed", handleConfirmed);
      window.removeEventListener("timer-entry-failed", handleFailed);
    };
  }, [fetchEntries, computeWeeklySummary]);

  // ---------------------------------------------------------------------------
  // Grouping entries by day
  // ---------------------------------------------------------------------------

  function groupEntriesByDesc(dayEntries: TimeEntry[]): GroupedEntry[] {
    const map = new Map<string, GroupedEntry>();
    for (const entry of dayEntries) {
      const key = entry.description || "";
      const existing = map.get(key);
      if (existing) {
        existing.entries.push(entry);
        existing.totalDuration += entry.duration ?? 0;
        if (entry.startTime < existing.startTime) existing.startTime = entry.startTime;
        if (entry.endTime && (!existing.endTime || entry.endTime > existing.endTime)) existing.endTime = entry.endTime;
      } else {
        map.set(key, {
          key: entry.id,
          description: entry.description,
          entries: [entry],
          totalDuration: entry.duration ?? 0,
          billable: entry.billable,
          projectId: entry.projectId,
          project: entry.project,
          tags: entry.tags,
          startTime: entry.startTime,
          endTime: entry.endTime,
        });
      }
    }
    return Array.from(map.values());
  }

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
          grouped: [],
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
    // Build grouped entries per day
    for (const group of groups) {
      group.grouped = groupEntriesByDesc(group.entries);
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

      const refreshed = await fetchEntries();
      computeWeeklySummary(refreshed, userDefaultRate);
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
    const start = parseEntryTimestamp(entry.startTime);
    setEditDate(start.date);
    setEditStartTime(start.time);
    if (entry.endTime) {
      const end = parseEntryTimestamp(entry.endTime);
      setEditEndTime(end.time);
    } else {
      setEditEndTime("");
    }
  }

  async function saveEdit(entryId: string) {
    // Validate timestamps if both are present
    if (editStartTime && editEndTime) {
      const error = validateTimeRange(editDate, editStartTime, editEndTime);
      if (error) {
        toast.error(error);
        return;
      }
    }

    try {
      const body: Record<string, unknown> = {
        description: editDescription,
        projectId: editProjectId === NO_PROJECT ? null : editProjectId,
        billable: editBillable,
      };

      // Include timestamps if the user edited them
      if (editDate && editStartTime) {
        body.startTime = buildTimestampISO(editDate, editStartTime);
      }
      if (editDate && editEndTime) {
        body.endTime = buildTimestampISO(editDate, editEndTime);
      }

      const res = await fetch(`/api/time-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        toast.error("Failed to update entry");
        return;
      }

      toast.success("Entry updated");
      setEditingId(null);
      const refreshed = await fetchEntries();
      computeWeeklySummary(refreshed, userDefaultRate);
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
      const refreshed = await fetchEntries();
      computeWeeklySummary(refreshed, userDefaultRate);
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  // ---------------------------------------------------------------------------
  // Resume (start new timer with same details)
  // ---------------------------------------------------------------------------

  function handleResume(entry: TimeEntry) {
    resumeTimerOptimistic(entry, userDefaultRate);
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
      <div className="mx-auto max-w-[900px] px-4 py-8 md:pt-10 space-y-10 animate-pulse">
        <div className="h-10 w-24 rounded-lg bg-[var(--bg-muted)] md:hidden" />
        <div className="h-[72px] rounded-[var(--radius-xl)] bg-[var(--bg-muted)]" />
        <div className="h-12 w-[400px] rounded-full bg-[var(--bg-muted)]" />
        <div className="space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <div className="flex justify-between">
                <div className="h-5 w-40 rounded bg-[var(--bg-muted)]" />
                <div className="h-5 w-16 rounded bg-[var(--bg-muted)]" />
              </div>
              <div className="h-32 rounded-[var(--radius-xl)] bg-[var(--bg-muted)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:pt-10 space-y-10">
      {/* Page header — acts as a real page header, not a twin of the entry rows */}
      <header className="flex items-end justify-between gap-6 px-1">
        <div>
          <h1 className="font-sans text-[28px] md:text-[32px] font-semibold tracking-tight text-[var(--text-forest)] leading-none">
            Timer
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-olive)]">
            Track time as you work. Entries are saved automatically.
          </p>
          <div className="mt-3">
            <BackfillCommitsButton onComplete={() => fetchEntries()} />
          </div>
        </div>
        <div className="flex items-baseline gap-5 tabular-nums shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-olive)]">
              This week
            </p>
            <p className="mt-0.5 text-[20px] md:text-[22px] font-semibold text-[var(--text-forest)]">
              {weeklyHours.toFixed(1)}h
            </p>
          </div>
          {weeklyEarnings > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-olive)]">
                Earned
              </p>
              <p className="mt-0.5 text-[20px] md:text-[22px] font-semibold text-[var(--text-forest)]">
                {formatCurrency(weeklyEarnings)}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Track / Add-entry tabs — clearer verbs than "Timer / Manual" */}
      <Tabs defaultValue="timer" className="w-full relative z-10 lg:px-0">
        <TabsList className="bg-[var(--bg-muted)] h-10 p-1 gap-1 border border-transparent rounded-full w-full max-w-[360px]">
          <TabsTrigger value="timer" className="rounded-full w-1/2 data-[state=active]:bg-[var(--bg-cream)] data-[state=active]:text-[var(--text-forest)] data-[state=active]:shadow-sm font-medium text-[13px] transition-colors">
            Track
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-full w-1/2 text-[var(--text-olive)] data-[state=active]:text-[var(--text-forest)] data-[state=active]:bg-[var(--bg-cream)] data-[state=active]:shadow-sm font-medium text-[13px] transition-colors">
            Add entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timer">
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <Card className="px-6 py-6 space-y-5 shadow-[var(--shadow-card)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
            {/* Description — big, but padded properly so text doesn't kiss the focus border */}
            <div>
              <label className="text-[12px] font-medium text-[var(--text-olive)] mb-2 block uppercase tracking-wide">
                What did you work on?
              </label>
              <Input
                placeholder="Describe the work…"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="w-full h-12 bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-md)] text-[15px] font-medium px-4 focus-visible:bg-[var(--bg-cream)] focus-visible:border-[var(--accent-olive)]"
              />
            </div>

            {/* Date / Start / End row */}
            <div className="grid grid-cols-3 gap-6 pt-2">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-olive)] mb-2 block uppercase tracking-wide">
                  Date
                </label>
                <DatePickerField
                  value={manualDate}
                  onChange={setManualDate}
                  size="md"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--text-olive)] mb-2 block uppercase tracking-wide">
                  Start time
                </label>
                <Input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="bg-[var(--bg-muted)] border-transparent rounded-[var(--radius-md)] h-10 font-sans text-sm tabular-nums hover:bg-[var(--bg-cream-hover)] transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--text-olive)] mb-2 block uppercase tracking-wide">
                  End time
                </label>
                <Input
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="bg-[var(--bg-muted)] border-transparent rounded-[var(--radius-md)] h-10 font-sans text-sm tabular-nums hover:bg-[var(--bg-cream-hover)] transition-colors"
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
            <Card className="border border-[var(--border-subtle)] shadow-[var(--shadow-card)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
              <div className="flex flex-col">
                {group.grouped.map((ge, index) => {
                  // Use the first entry for editing/deleting
                  const entry = ge.entries[0];
                  const isEditing = ge.entries.some((e) => editingId === e.id);
                  const isDeleting = ge.entries.some((e) => deletingId === e.id);
                  const dur = ge.totalDuration;
                  const rate = getApplicableRate(
                    ge.project?.hourlyRate ?? null,
                    userDefaultRate
                  );
                  const earnings = calculateEarnings(dur, rate, ge.billable);
                  const isLast = index === group.grouped.length - 1;

                  return (
                    <div
                      key={ge.key}
                      className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 transition-colors group ${
                        isEditing
                          ? "bg-[var(--bg-muted)]/40"
                          : isDeleting
                          ? "bg-[var(--accent-coral)]/6"
                          : "hover:bg-[var(--bg-sage)]/30"
                      } ${!isLast ? "border-b border-[var(--border-subtle)]" : ""}`}
                    >
                      {/* Left accent strip — tells the user the row is in a special state */}
                      {(isEditing || isDeleting) && (
                        <span
                          aria-hidden
                          className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${
                            isDeleting ? "bg-[var(--accent-coral)]" : "bg-[var(--text-forest)]"
                          }`}
                        />
                      )}

                      {isEditing ? (
                        /* ---- Inline edit mode ---- */
                        <div className="flex flex-col gap-3 flex-1 min-w-0">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-olive)] mb-1.5">
                              Editing entry
                            </p>
                            <Input
                              className="bg-[var(--bg-cream)] border-transparent rounded-[var(--radius-md)] h-10 font-sans text-[15px] font-medium px-3 shadow-[var(--shadow-card)]"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(entry.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="What did you work on?"
                              autoFocus
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <DatePickerField
                              value={editDate}
                              onChange={setEditDate}
                              size="sm"
                              displayFormat="MMM d"
                            />
                            <Input
                              type="time"
                              value={editStartTime}
                              onChange={(e) => setEditStartTime(e.target.value)}
                              className="bg-[var(--bg-cream)] border-transparent rounded-[var(--radius-md)] h-9 font-sans text-[13px] tabular-nums shadow-[var(--shadow-card)]"
                            />
                            <Input
                              type="time"
                              value={editEndTime}
                              onChange={(e) => setEditEndTime(e.target.value)}
                              className="bg-[var(--bg-cream)] border-transparent rounded-[var(--radius-md)] h-9 font-sans text-[13px] tabular-nums shadow-[var(--shadow-card)]"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Select
                              value={editProjectId}
                              onValueChange={(v: string) => v && setEditProjectId(v)}
                            >
                              <SelectTrigger className="flex-1 sm:max-w-[260px] h-9 bg-[var(--bg-cream)] border-transparent rounded-[var(--radius-md)] text-[13px] shadow-[var(--shadow-card)]">
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

                            <button
                              type="button"
                              className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-[var(--radius-md)] text-[12px] font-medium transition-colors shrink-0 ${
                                editBillable
                                  ? "bg-[var(--accent-olive-soft)] text-[var(--accent-olive-hover)]"
                                  : "bg-[var(--bg-cream)] text-[var(--text-olive)] shadow-[var(--shadow-card)] hover:text-[var(--text-forest)]"
                              }`}
                              onClick={() => setEditBillable(!editBillable)}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              {editBillable ? "Billable" : "Non-billable"}
                            </button>

                            <div className="flex items-center gap-2 sm:ml-auto">
                              <Button
                                variant="ghost"
                                className="h-9 px-3 text-[13px] rounded-[var(--radius-md)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </Button>
                              <Button
                                className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90"
                                onClick={() => saveEdit(entry.id)}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : isDeleting ? (
                        /* ---- Delete confirmation mode — row fills with a prompt ---- */
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-1 min-w-0">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-[var(--accent-coral)]/10 flex items-center justify-center shrink-0">
                              <Trash2 className="h-4 w-4 text-[var(--accent-coral)]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[var(--text-forest)]">
                                Delete this time entry?
                              </p>
                              <p className="text-[12px] text-[var(--text-olive)] truncate max-w-[500px]">
                                {ge.description || "(No description)"} · {formatDuration(dur)}
                                {earnings > 0 && ` · ${formatCurrency(earnings)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              className="h-9 px-3 text-[13px] rounded-[var(--radius-md)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)]"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--accent-coral)] text-white hover:opacity-90"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete entry
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ---- Normal display mode ---- */
                        <>
                          {/* Left: Description + project + tags + count */}
                          <div className="flex flex-col gap-[6px] flex-1 min-w-0 pr-4">
                            <span className="text-[15px] font-medium text-[var(--text-forest)] leading-none truncate font-sans">
                              {ge.description || "(No description)"}
                            </span>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {ge.project && (
                                <Badge
                                  variant="outline"
                                  className="font-medium px-2.5 py-1 text-[12px] rounded-[var(--radius-md)] border-transparent"
                                  style={{
                                    color: ge.project.color,
                                    backgroundColor: `${ge.project.color}15`
                                  }}
                                >
                                  {ge.project.name}
                                </Badge>
                              )}
                              {ge.tags.map((t) => (
                                <Badge
                                  key={t.tagId}
                                  variant="outline"
                                  className="font-medium px-2.5 py-1 text-[12px] rounded-[var(--radius-md)] border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-olive)]"
                                >
                                  {t.tag.name}
                                </Badge>
                              ))}
                              {ge.entries.length > 1 && (
                                <span className="text-[11px] font-medium text-[var(--text-olive)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                                  {ge.entries.length} entries
                                </span>
                              )}
                            </div>

                            {/* Attached GitHub commits (if any) */}
                            <EntryCommits entries={ge.entries} />
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
                              <div className="flex items-center gap-1.5 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <button
                                  className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] rounded-[var(--radius-md)] flex items-center justify-center transition-colors"
                                  onClick={() => startEditing(entry)}
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--accent-coral)]/10 hover:text-[var(--accent-coral)] rounded-[var(--radius-md)] flex items-center justify-center transition-colors"
                                  onClick={() => setDeletingId(entry.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Play Button */}
                              <button
                                onClick={() => handleResume(entry)}
                                className="h-10 w-10 bg-[var(--accent-olive)] hover:bg-[var(--accent-olive-hover)] text-[var(--text-forest)] rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer shrink-0 ml-1"
                                title="Resume timer with same details"
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
