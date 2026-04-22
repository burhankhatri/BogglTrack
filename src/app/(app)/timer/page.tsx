"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pencil,
  Trash2,
  Clock,
  Check,
  DollarSign,
  Sparkles,
  ChevronDown,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isYesterday,
  startOfWeek,
  subDays,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EntryCommits } from "@/components/ui/entry-commits";
import { draftDescriptionFromCommits } from "@/lib/github/description";

import { useAppStore } from "@/stores/app-store";
import {
  formatDuration,
  formatCurrency,
  calculateEarnings,
  getApplicableRate,
} from "@/lib/earnings";
import { resumeTimerOptimistic } from "@/lib/timer-actions";
import { parseEntryTimestamp, buildTimestampISO, buildExplicitRange } from "./timestamp-helpers";
import { groupEntriesByDesc, resolveActiveEntry, type GroupedEntry } from "./grouping-helpers";

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

// ---------------------------------------------------------------------------
// Kebab menu — Edit / Delete actions for a time entry row
// ---------------------------------------------------------------------------

function EntryActionsMenu({
  onEdit,
  onDelete,
  size = "md",
}: {
  onEdit: () => void;
  onDelete: () => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btnSize = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`${btnSize} text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] rounded-[var(--radius-md)] flex items-center justify-center transition-colors`}
      >
        <MoreVertical className={iconSize} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-36 rounded-[var(--radius-md)] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] border border-[var(--border-subtle)] py-1 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[13px] text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[13px] text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TimerPage() {
  // Data state — read from store for instant cached render
  const storeEntries = useAppStore((s) => s.timerEntries.data);
  const [entries, setEntries] = useState<TimeEntry[]>(storeEntries ?? []);
  const projects = (useAppStore((s) => s.projects.data) as Project[] | null) ?? EMPTY_PROJECTS;
  const settingsData = useAppStore((s) => s.settings.data);
  const userDefaultRate = settingsData?.defaultHourlyRate ?? 0;
  const [loading, setLoading] = useState(!storeEntries);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState<string>(NO_PROJECT);
  const [editBillable, setEditBillable] = useState(true);
  const [editStartDate, setEditStartDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Merged-row expand state — keyed on the stable composite merge key so
  // re-renders (e.g. after new entries arrive) don't collapse open rows.
  const [expandedMergeKeys, setExpandedMergeKeys] = useState<Set<string>>(
    () => new Set()
  );
  const toggleExpanded = useCallback((mergeKey: string) => {
    setExpandedMergeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(mergeKey)) next.delete(mergeKey);
      else next.add(mergeKey);
      return next;
    });
  }, []);

  // Timer store (used by resumeTimerOptimistic internally)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

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
        const [, , , entriesResult] = await Promise.all([
          appStore.fetchProjects(),
          appStore.fetchTags(),
          appStore.fetchSettings(),
          appStore.fetchTimerEntries(),
        ]);
        setEntries(entriesResult);
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
    };
    const handleConfirmed = (e: Event) => {
      const confirmed = (e as CustomEvent).detail;
      setEntries((prev) =>
        prev.map((entry) => (entry.id === confirmed.id ? confirmed : entry))
      );
      fetchEntries();
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
  }, [fetchEntries, storeEntries]);

  // ---------------------------------------------------------------------------
  // Background commit sync — keeps GitHub commits attached to entries in
  // near-real-time. The stop-timer endpoint already auto-attaches commits for
  // running timers; this closes the gap for:
  //   • manual entries created while the tab is open
  //   • commits pushed after an entry was stopped/saved
  //
  // Strategy: on mount do a 7-day backfill (catches anything missed while the
  // tab was closed), then every 10 min sweep the last 24h. Also runs when the
  // tab regains focus. onlyMissing:true means we skip entries that already
  // have commits — the endpoint and GitHub API cost stay bounded.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let ghConnected: boolean | null = null;

    async function runSync(days: number) {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      if (ghConnected === null) {
        try {
          const res = await fetch("/api/github/status");
          const data = res.ok ? await res.json() : null;
          ghConnected = Boolean(data?.connected);
        } catch {
          ghConnected = false;
        }
      }
      if (!ghConnected) return;

      const from =
        days >= 7
          ? startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
          : subDays(new Date(), days).toISOString();
      const to = new Date().toISOString();
      try {
        const res = await fetch("/api/time-entries/backfill-commits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to, onlyMissing: true }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.updated > 0) {
          await fetchEntries();
        }
      } catch {
        // Silent — a failed sweep is harmless, next tick will try again.
      }
    }

    // First sweep after initial load settles
    const initTimer = setTimeout(() => runSync(7), 2500);

    // Recurring sweep — narrow 24h window is enough for most cases
    const interval = setInterval(() => runSync(1), 10 * 60 * 1000);

    // Catch commits pushed while the tab was hidden
    const onVis = () => {
      if (document.visibilityState === "visible") runSync(1);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchEntries]);

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
  // Inline edit
  // ---------------------------------------------------------------------------

  function startEditing(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditDescription(entry.description);
    setEditProjectId(entry.projectId ?? NO_PROJECT);
    setEditBillable(entry.billable);
    const start = parseEntryTimestamp(entry.startTime);
    setEditStartDate(start.date);
    setEditStartTime(start.time);
    if (entry.endTime) {
      const end = parseEntryTimestamp(entry.endTime);
      setEditEndDate(end.date);
      setEditEndTime(end.time);
    } else {
      // Still-running entry. Leave end fields empty so the user can either
      // leave them blank (keeps it running) or fill in both to convert the
      // entry into a completed one.
      setEditEndDate("");
      setEditEndTime("");
    }
  }

  async function saveEdit(entryId: string) {
    const body: Record<string, unknown> = {
      description: editDescription,
      projectId: editProjectId === NO_PROJECT ? null : editProjectId,
      billable: editBillable,
    };

    try {
      const hasEndFields = Boolean(editEndDate && editEndTime);
      const hasPartialEnd =
        Boolean(editEndDate) !== Boolean(editEndTime);

      if (hasPartialEnd) {
        toast.error("Fill in both end date and end time, or clear both");
        return;
      }

      if (editStartDate && editStartTime && hasEndFields) {
        const resolved = buildExplicitRange(
          editStartDate,
          editStartTime,
          editEndDate,
          editEndTime
        );
        if (!resolved.ok) {
          toast.error(resolved.error);
          return;
        }
        body.startTime = resolved.startISO;
        body.endTime = resolved.endISO;
      } else if (editStartDate && editStartTime) {
        body.startTime = buildTimestampISO(editStartDate, editStartTime);
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
      await fetchEntries();
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
      await fetchEntries();
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
                  // `entry` is the group's representative — used by the
                  // header Edit button (which edits the "first" entry as
                  // a stand-in for the whole merged row). For save/delete,
                  // always target the SPECIFIC entry the user activated
                  // (from a sub-row click, for example) so we never
                  // silently overwrite the wrong underlying record.
                  const entry = ge.entries[0];
                  const isEditing = ge.entries.some((e) => editingId === e.id);
                  const isDeleting = ge.entries.some((e) => deletingId === e.id);
                  const editingEntry = resolveActiveEntry(ge, editingId);
                  const deletingEntry = resolveActiveEntry(ge, deletingId);
                  const dur = ge.totalDuration;
                  const rate = getApplicableRate(
                    ge.project?.hourlyRate ?? null,
                    userDefaultRate
                  );
                  const earnings = calculateEarnings(dur, rate, ge.billable);
                  const isLast = index === group.grouped.length - 1;
                  const isMerged = ge.entries.length > 1;
                  const isExpanded = expandedMergeKeys.has(ge.mergeKey);

                  return (
                    <div
                      key={ge.key}
                      className={!isLast ? "border-b border-[var(--border-subtle)]" : ""}
                    >
                    <div
                      className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 transition-colors group ${
                        isEditing
                          ? "bg-[var(--bg-muted)]/40"
                          : isDeleting
                          ? "bg-[var(--accent-coral)]/6"
                          : "hover:bg-[var(--bg-sage)]/30"
                      }`}
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
                                if (e.key === "Enter") saveEdit(editingEntry.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="What did you work on?"
                              autoFocus
                            />
                            {(() => {
                              // Commit-based description suggestion. Only
                              // offer when the user hasn't typed anything
                              // unique yet (empty or still the original
                              // description, which might already be what
                              // they want).
                              const entryCommits = entry.commits;
                              if (!entryCommits || entryCommits.length === 0) return null;
                              const draft = draftDescriptionFromCommits(entryCommits);
                              if (!draft || draft === editDescription) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setEditDescription(draft)}
                                  className="mt-2 inline-flex items-start gap-1.5 max-w-full text-left px-2.5 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent-olive-soft)] text-[11px] text-[var(--accent-olive-hover)] hover:opacity-80 transition-opacity"
                                  title="Replace description with a summary of the attached commits"
                                >
                                  <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                                  <span className="flex-1 min-w-0">
                                    <span className="font-medium">Use commits:</span>{" "}
                                    <span className="text-[var(--text-olive)] line-clamp-2">{draft}</span>
                                  </span>
                                </button>
                              );
                            })()}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <DatePickerField
                              value={editStartDate}
                              onChange={setEditStartDate}
                              size="sm"
                              displayFormat="MMM d"
                              placeholder="Start date"
                            />
                            <Input
                              type="time"
                              value={editStartTime}
                              onChange={(e) => setEditStartTime(e.target.value)}
                              className="bg-[var(--bg-cream)] border-transparent rounded-[var(--radius-md)] h-9 font-sans text-[13px] tabular-nums shadow-[var(--shadow-card)]"
                            />
                            <DatePickerField
                              value={editEndDate}
                              onChange={setEditEndDate}
                              size="sm"
                              displayFormat="MMM d"
                              placeholder="End date"
                            />
                            <Input
                              type="time"
                              value={editEndTime}
                              onChange={(e) => setEditEndTime(e.target.value)}
                              className="bg-[var(--bg-cream)] border-transparent rounded-[var(--radius-md)] h-9 font-sans text-[13px] tabular-nums shadow-[var(--shadow-card)]"
                              placeholder="End time"
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
                                onClick={() => saveEdit(editingEntry.id)}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : isDeleting ? (
                        /* ---- Delete confirmation mode — row fills with a prompt ---- */
                        (() => {
                          const delDur = deletingEntry.duration ?? 0;
                          const delRate = getApplicableRate(
                            deletingEntry.project?.hourlyRate ?? null,
                            userDefaultRate
                          );
                          const delEarnings = calculateEarnings(
                            delDur,
                            delRate,
                            deletingEntry.billable
                          );
                          return (
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
                                {deletingEntry.description || "(No description)"} · {formatDuration(delDur)}
                                {delEarnings > 0 && ` · ${formatCurrency(delEarnings)}`}
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
                              onClick={() => handleDelete(deletingEntry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete entry
                            </Button>
                          </div>
                        </div>
                          );
                        })()
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
                              {isMerged && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(ge.mergeKey)}
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? "Hide" : "Show"} ${ge.entries.length} merged entries`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-olive)] bg-[var(--bg-muted)] hover:bg-[var(--bg-cream-hover)] hover:text-[var(--text-forest)] px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                >
                                  <ChevronDown
                                    className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  />
                                  {ge.entries.length} entries
                                </button>
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
                              {/* Kebab menu — Edit / Delete */}
                              <EntryActionsMenu
                                onEdit={() => startEditing(entry)}
                                onDelete={() => setDeletingId(entry.id)}
                              />

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
                    {isMerged && isExpanded && !isEditing && !isDeleting && (
                      <div className="px-6 pt-1 pb-3 space-y-1 bg-[var(--bg-muted)]/25 border-t border-[var(--border-subtle)]/60">
                        {ge.entries
                          .slice()
                          .sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
                          .map((sub) => {
                            const subDur = sub.duration ?? 0;
                            const subStart = new Date(sub.startTime);
                            const subEnd = sub.endTime ? new Date(sub.endTime) : null;
                            const subCrossesMidnight =
                              subEnd !== null &&
                              (subEnd.getFullYear() !== subStart.getFullYear() ||
                                subEnd.getMonth() !== subStart.getMonth() ||
                                subEnd.getDate() !== subStart.getDate());
                            return (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between gap-3 px-2 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-cream)]/60 transition-colors group/sub"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 text-[12px] tabular-nums text-[var(--text-olive)]">
                                  <Clock className="h-3 w-3 shrink-0 opacity-50" />
                                  <span className="font-medium">
                                    {format(subStart, "h:mm a")}
                                    {subEnd && (
                                      <>
                                        {" – "}
                                        {format(subEnd, "h:mm a")}
                                        {subCrossesMidnight && (
                                          <span className="ml-1 text-[10px] font-semibold text-[var(--accent-olive-hover)]">
                                            +1d
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </span>
                                  <span className="opacity-40">·</span>
                                  <span className="text-[var(--text-forest)] font-semibold">
                                    {formatDuration(subDur)}
                                  </span>
                                </div>
                                <EntryActionsMenu
                                  size="sm"
                                  onEdit={() => startEditing(sub)}
                                  onDelete={() => setDeletingId(sub.id)}
                                />

                              </div>
                            );
                          })}
                      </div>
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
