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
  }, [fetchEntries, fetchWeeklySummary]);

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
        <div className="flex items-center gap-3 text-muted-foreground">
          <Clock className="h-5 w-5 animate-pulse" />
          <span>Loading timer...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Weekly summary bar */}
      <Card className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>This week</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold tabular-nums">
              {weeklyHours.toFixed(1)} hrs
            </span>
            <span className="text-lg font-semibold text-green-600 dark:text-green-400 tabular-nums">
              {formatCurrency(weeklyEarnings)}
            </span>
          </div>
        </div>
      </Card>

      {/* Timer / Manual tabs */}
      <Tabs defaultValue="timer">
        <TabsList className="w-full">
          <TabsTrigger value="timer" className="flex-1">
            <Clock className="mr-2 h-4 w-4" />
            Timer
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">
            <Plus className="mr-2 h-4 w-4" />
            Manual
          </TabsTrigger>
        </TabsList>

        {/* Timer mode — the global timer bar handles this, show a hint */}
        <TabsContent value="timer">
          <Card className="px-6 py-8 text-center text-muted-foreground">
            <Clock className="mx-auto h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">
              Use the timer bar at the top of the page to start and stop time
              tracking.
            </p>
          </Card>
        </TabsContent>

        {/* Manual mode */}
        <TabsContent value="manual">
          <Card className="px-6 py-5 space-y-4">
            {/* Description */}
            <Input
              placeholder="What did you work on?"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
            />

            {/* Date / Start / End row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Date
                </label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Start time
                </label>
                <Input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  End time
                </label>
                <Input
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Project / Billable row */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Project
                </label>
                <Select
                  value={manualProjectId}
                  onValueChange={(v) => v && setManualProjectId(v)}
                >
                  <SelectTrigger>
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
                className="shrink-0 gap-1.5"
                onClick={() => setManualBillable(!manualBillable)}
              >
                <DollarSign className="h-3.5 w-3.5" />
                {manualBillable ? "Billable" : "Non-billable"}
              </Button>
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              onClick={handleManualAdd}
              disabled={manualSubmitting}
            >
              <Plus className="mr-2 h-4 w-4" />
              {manualSubmitting ? "Adding..." : "Add Entry"}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Time entry list grouped by day */}
      <div className="space-y-6">
        {dayGroups.length === 0 && (
          <Card className="px-6 py-12 text-center text-muted-foreground">
            <p className="text-sm">No time entries yet. Start tracking!</p>
          </Card>
        )}

        {dayGroups.map((group) => (
          <div key={group.label}>
            {/* Day header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-foreground">
                {group.label}
              </h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {formatDurationHM(group.totalSeconds)}
                </span>
                <span className="text-green-600 dark:text-green-400 tabular-nums font-medium">
                  {formatCurrency(group.totalEarnings)}
                </span>
              </div>
            </div>

            {/* Entries */}
            <Card className="divide-y">
              {group.entries.map((entry) => {
                const isEditing = editingId === entry.id;
                const isDeleting = deletingId === entry.id;
                const dur = entry.duration ?? 0;
                const rate = getApplicableRate(
                  entry.project?.hourlyRate ?? null,
                  userDefaultRate
                );
                const earnings = calculateEarnings(dur, rate, entry.billable);

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 group"
                  >
                    {isEditing ? (
                      /* ---- Inline edit mode ---- */
                      <div className="flex-1 flex items-center gap-3 flex-wrap">
                        <Input
                          className="flex-1 min-w-[180px]"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                        />
                        <Select
                          value={editProjectId}
                          onValueChange={(v) => v && setEditProjectId(v)}
                        >
                          <SelectTrigger className="w-[160px]">
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
                          size="sm"
                          onClick={() => setEditBillable(!editBillable)}
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(entry.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ---- Normal display mode ---- */
                      <>
                        {/* Description + project + tags */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.description || (
                              <span className="text-muted-foreground italic">
                                No description
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {entry.project && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: entry.project.color,
                                  }}
                                />
                                <span>{entry.project.name}</span>
                              </div>
                            )}
                            {entry.tags.map((t) => (
                              <Badge
                                key={t.tagId}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                                style={{
                                  borderColor: t.tag.color,
                                  color: t.tag.color,
                                }}
                              >
                                {t.tag.name}
                              </Badge>
                            ))}
                            {!entry.billable && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Non-billable
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Duration */}
                        <span className="text-sm font-mono tabular-nums text-muted-foreground shrink-0">
                          {formatDuration(dur)}
                        </span>

                        {/* Earnings */}
                        <span className="text-sm font-medium tabular-nums text-green-600 dark:text-green-400 w-20 text-right shrink-0">
                          {formatCurrency(earnings)}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEditing(entry)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {isDeleting ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => handleDelete(entry.id)}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => setDeletingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeletingId(entry.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 dark:text-green-400"
                            onClick={() => handleResume(entry)}
                            title="Resume timer"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
