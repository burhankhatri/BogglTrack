"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Square,
  DollarSign,
  Loader2,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTimerStore } from "@/stores/timer-store";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { buildExplicitRange } from "@/app/(app)/timer/timestamp-helpers";

const NO_PROJECT = "__none__";

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatEarnings(seconds: number, hourlyRate: number): string {
  const hours = seconds / 3600;
  const earnings = hours * hourlyRate;
  return `$${earnings.toFixed(2)}`;
}

const EMPTY_PROJECTS: { id: string; name: string; color: string; hourlyRate: number | null }[] = [];

export function GlobalTimerBar() {
  const projects = useAppStore((s) => s.projects.data) ?? EMPTY_PROJECTS;
  const fetchProjects = useAppStore((s) => s.fetchProjects);
  const runningTimerChecked = useAppStore((s) => s.runningTimerChecked);
  const setRunningTimerChecked = useAppStore((s) => s.setRunningTimerChecked);
  const [loading] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectFilterInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual "add entry" popover state — a lightweight editor for entering a
  // past block of time without touching the running timer.
  const todayYMD = format(new Date(), "yyyy-MM-dd");
  const [addOpen, setAddOpen] = useState(false);
  const [addDescription, setAddDescription] = useState("");
  const [addStartDate, setAddStartDate] = useState(todayYMD);
  const [addStartTime, setAddStartTime] = useState("09:00");
  const [addEndDate, setAddEndDate] = useState(todayYMD);
  const [addEndTime, setAddEndTime] = useState("10:00");
  const [addProjectId, setAddProjectId] = useState<string>(NO_PROJECT);
  const [addBillable, setAddBillable] = useState(true);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const resetAddForm = useCallback(() => {
    const t = format(new Date(), "yyyy-MM-dd");
    setAddDescription("");
    setAddStartDate(t);
    setAddStartTime("09:00");
    setAddEndDate(t);
    setAddEndTime("10:00");
    setAddProjectId(NO_PROJECT);
    setAddBillable(true);
  }, []);

  const {
    isRunning,
    entryId,
    description,
    projectId,
    billable,
    elapsedSeconds,
    hourlyRate,
    startTimer,
    stopTimer,
    tick,
    setDescription,
    setProjectId,
    setBillable,
    setHourlyRate,
    setEntryId,
    restoreTimer,
  } = useTimerStore();

  // Fetch projects via app store (cached / deduplicated)
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Verify running timer with server — only once per session.
  useEffect(() => {
    if (runningTimerChecked) return;
    async function checkRunning() {
      try {
        const res = await fetch("/api/time-entries/running");
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            const current = useTimerStore.getState();
            if (current.isRunning && current.entryId === data.id) {
              // Already in sync
            } else {
              restoreTimer({
                entryId: data.id,
                startTime: data.startTime,
                description: data.description || "",
                projectId: data.projectId || null,
                billable: data.billable ?? true,
                tagIds: data.tagIds || [],
                hourlyRate: data.project?.hourlyRate || 0,
              });
            }
          } else {
            const current = useTimerStore.getState();
            if (current.isRunning) {
              stopTimer();
            }
          }
        }
      } catch {
        // Silent — trust localStorage
      }
      setRunningTimerChecked();
    }
    checkRunning();
  }, [runningTimerChecked, restoreTimer, stopTimer, setRunningTimerChecked]);

  // Tick interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => tick(), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, tick]);

  // Browser tab title
  useEffect(() => {
    if (isRunning) {
      document.title = `${formatElapsed(elapsedSeconds)} — BogglTrack`;
    } else {
      document.title = "BogglTrack";
    }
    return () => {
      document.title = "BogglTrack";
    };
  }, [isRunning, elapsedSeconds]);

  // Scenario 6 — idle detection. If the tab was hidden for more than 15 min
  // while a timer ran, surface a toast on return so the user can trim the
  // away-from-keyboard time from the current entry.
  useEffect(() => {
    if (!isRunning) return;
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt) {
        const awayMs = Date.now() - hiddenAt;
        hiddenAt = null;
        if (awayMs <= 15 * 60 * 1000) return;
        const awayMin = Math.floor(awayMs / 60000);
        toast(`You were away for ${awayMin} min`, {
          description: "Trim that time from this entry?",
          duration: 10000,
          action: {
            label: `Trim ${awayMin}m`,
            onClick: async () => {
              const st = useTimerStore.getState();
              if (!st.entryId || st.entryId.startsWith("temp-") || !st.startTime) return;
              const newStart = new Date(st.startTime.getTime() + awayMs);
              try {
                const res = await fetch(`/api/time-entries/${st.entryId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ startTime: newStart.toISOString() }),
                });
                if (!res.ok) throw new Error();
                useTimerStore.setState({
                  startTime: newStart,
                  elapsedSeconds: Math.max(
                    0,
                    Math.floor((Date.now() - newStart.getTime()) / 1000)
                  ),
                });
                toast.success(`Trimmed ${awayMin}m from this entry`);
              } catch {
                toast.error("Couldn't trim — try editing the entry manually");
              }
            },
          },
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isRunning]);

  // Sync hourly rate with selected project
  useEffect(() => {
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.hourlyRate) setHourlyRate(project.hourlyRate);
    } else {
      setHourlyRate(0);
    }
  }, [projectId, projects, setHourlyRate]);

  // Close project dropdown on outside click; reset the filter + focus the
  // search input when the menu opens so typing "just works".
  useEffect(() => {
    if (!projectMenuOpen) {
      setProjectFilter("");
      return;
    }
    // Focus search on next tick — the input mounts as part of this render.
    const t = setTimeout(() => projectFilterInputRef.current?.focus(), 0);
    const onDocClick = (e: MouseEvent) => {
      if (!projectMenuRef.current?.contains(e.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [projectMenuOpen]);

  const selectedProject = projects.find((p) => p.id === projectId) || null;
  const filteredProjects = projectFilter.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(projectFilter.trim().toLowerCase())
      )
    : projects;

  // Scenario 13 — detect a pasted GitHub commit URL in the description. We
  // don't auto-attach (that could surprise someone pasting for reference);
  // we show a one-click chip they can accept.
  const commitUrlMatch = description.match(
    /https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/commit\/([a-f0-9]{7,40})/i
  );
  const detectedCommit = commitUrlMatch
    ? {
        repo: `${commitUrlMatch[1]}/${commitUrlMatch[2]}`,
        sha: commitUrlMatch[3].slice(0, 7),
        fullUrl: commitUrlMatch[0],
      }
    : null;

  const handleStart = useCallback(() => {
    const now = new Date().toISOString();
    const tempId = "temp-" + Date.now();
    const project = projects.find((p) => p.id === projectId);

    startTimer({
      entryId: tempId,
      startTime: now,
      description,
      projectId,
      billable,
      tagIds: [],
      hourlyRate: project?.hourlyRate || 0,
    });

    fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        startTime: now,
        projectId: projectId || undefined,
        billable,
        tagIds: [],
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
      })
      .then((entry) => setEntryId(entry.id))
      .catch(() => {
        stopTimer();
        toast.error("Failed to start timer");
      });
  }, [description, projectId, billable, projects, startTimer, setEntryId, stopTimer]);

  const handleManualAdd = useCallback(async () => {
    if (!addStartDate || !addStartTime || !addEndDate || !addEndTime) {
      toast.error("Fill in start and end date & time");
      return;
    }
    const resolved = buildExplicitRange(
      addStartDate,
      addStartTime,
      addEndDate,
      addEndTime
    );
    if (!resolved.ok) {
      toast.error(resolved.error);
      return;
    }
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: addDescription,
          startTime: resolved.startISO,
          endTime: resolved.endISO,
          projectId: addProjectId === NO_PROJECT ? null : addProjectId,
          billable: addBillable,
          tagIds: [],
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add entry");
        return;
      }
      const entry = await res.json();
      toast.success("Entry added");
      // Feed the timer page's list the same way handleStop does, so the new
      // entry appears instantly without a refetch.
      window.dispatchEvent(
        new CustomEvent("timer-entry-completed", { detail: entry })
      );
      setAddOpen(false);
      resetAddForm();
    } catch {
      toast.error("Failed to add entry");
    } finally {
      setAddSubmitting(false);
    }
  }, [
    addDescription,
    addStartDate,
    addStartTime,
    addEndDate,
    addEndTime,
    addProjectId,
    addBillable,
    resetAddForm,
  ]);

  const handleStop = useCallback(() => {
    if (!entryId) return;
    if (entryId.startsWith("temp-")) {
      toast.info("Still saving, try again in a moment");
      return;
    }

    const stoppedEntryId = entryId;
    const now = new Date();

    const timerState = useTimerStore.getState();
    const proj = projects.find((p) => p.id === timerState.projectId) || null;
    // Capture BEFORE stopTimer() nukes the state — we need these to restore
    // on "Undo" and to decide whether to surface an empty-description warning.
    const snapshot = {
      entryId: stoppedEntryId,
      startTime: timerState.startTime?.toISOString() || now.toISOString(),
      description: timerState.description,
      projectId: timerState.projectId,
      billable: timerState.billable,
      tagIds: timerState.tagIds,
      hourlyRate: timerState.hourlyRate,
    };
    const hadDescription = timerState.description.trim().length > 0;

    const syntheticEntry = {
      id: stoppedEntryId,
      description: timerState.description,
      startTime: snapshot.startTime,
      endTime: now.toISOString(),
      duration: timerState.elapsedSeconds,
      billable: timerState.billable,
      projectId: timerState.projectId,
      project: proj
        ? { id: proj.id, name: proj.name, color: proj.color, hourlyRate: proj.hourlyRate, client: null }
        : null,
      tags: [],
    };

    stopTimer();

    // Empty-description stop is the most common misclick — offer undo via toast
    // instead of a blocking modal. The DB write is still in flight; the undo
    // handler resumes locally and the failed server stop becomes a no-op
    // (the entry never got its endTime persisted if we're fast enough).
    if (!hadDescription) {
      toast("Stopped with no description", {
        action: {
          label: "Undo",
          onClick: () => {
            restoreTimer(snapshot);
          },
        },
        duration: 6000,
      });
    } else {
      toast.success("Time entry saved");
    }

    window.dispatchEvent(
      new CustomEvent("timer-entry-completed", { detail: syntheticEntry })
    );

    fetch(`/api/time-entries/${stoppedEntryId}/stop`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
      })
      .then((confirmedEntry) => {
        window.dispatchEvent(
          new CustomEvent("timer-entry-confirmed", { detail: confirmedEntry })
        );
      })
      .catch(() => {
        toast.error("Failed to save time entry");
        window.dispatchEvent(
          new CustomEvent("timer-entry-failed", { detail: { id: stoppedEntryId } })
        );
      });
  }, [entryId, stopTimer, projects, restoreTimer]);

  return (
    <div className="sticky top-0 z-30 bg-[var(--bg-sage)] pt-4 pb-3 px-4 md:px-6">
      <div
        className={cn(
          "flex flex-col md:flex-row items-stretch md:items-center gap-3 py-2.5 md:py-3 px-3 md:px-4 bg-[var(--bg-cream)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] transition-colors",
          isRunning && "ring-1 ring-[var(--accent-olive)]/30"
        )}
      >
        {/* LEFT — Project selector (name, not ID) */}
        <div className="relative shrink-0 order-2 md:order-1" ref={projectMenuRef}>
          <button
            type="button"
            onClick={() => !isRunning && setProjectMenuOpen((o) => !o)}
            disabled={isRunning}
            className={cn(
              "h-9 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-muted)] px-3 text-sm font-medium text-[var(--text-forest)] transition-colors hover:bg-[var(--bg-cream-hover)] disabled:opacity-70 disabled:cursor-not-allowed",
              "max-w-[200px]"
            )}
            aria-haspopup="listbox"
            aria-expanded={projectMenuOpen}
          >
            {selectedProject ? (
              <>
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedProject.color }}
                />
                <span className="truncate">{selectedProject.name}</span>
              </>
            ) : (
              <span className="text-[var(--text-olive)]">No project</span>
            )}
            <ChevronDown className={cn("h-3.5 w-3.5 opacity-50 transition-transform shrink-0", projectMenuOpen && "rotate-180")} />
          </button>

          {projectMenuOpen && (
            <div
              role="listbox"
              className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-[var(--radius-md)] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95 duration-100 overflow-hidden flex flex-col"
            >
              {/* Search — only shown once there's enough projects to warrant it */}
              {projects.length > 5 && (
                <div className="border-b border-[var(--border-subtle)] p-1.5">
                  <input
                    ref={projectFilterInputRef}
                    type="text"
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredProjects.length > 0) {
                        setProjectId(filteredProjects[0].id);
                        setProjectMenuOpen(false);
                      } else if (e.key === "Escape") {
                        setProjectMenuOpen(false);
                      }
                    }}
                    placeholder="Search projects…"
                    className="w-full h-8 px-2 text-[13px] bg-transparent focus:outline-none placeholder:text-[var(--text-olive)]/60 text-[var(--text-forest)]"
                  />
                </div>
              )}
              <div className="max-h-[280px] overflow-y-auto p-1">
                {!projectFilter.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setProjectId(null);
                      setProjectMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-sm text-[var(--text-olive)] hover:bg-[var(--bg-muted)] transition-colors text-left"
                  >
                    <span className="h-2 w-2 rounded-full border border-[var(--border-medium)] shrink-0" />
                    <span>No project</span>
                    {!projectId && <Check className="h-3.5 w-3.5 ml-auto text-[var(--text-forest)]" />}
                  </button>
                )}
                {filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProjectId(p.id);
                      setProjectMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-sm text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors text-left"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                    {projectId === p.id && <Check className="h-3.5 w-3.5 ml-auto text-[var(--text-forest)]" />}
                  </button>
                ))}
                {filteredProjects.length === 0 && projectFilter.trim() && (
                  <div className="px-3 py-3 text-[12px] text-[var(--text-olive)]/70 text-center">
                    No projects match &quot;{projectFilter}&quot;
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE — Description input */}
        <div className="flex-1 order-1 md:order-2 min-w-0">
          <Input
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isRunning) handleStart();
            }}
            className="w-full h-10 bg-transparent border-transparent shadow-none text-[15px] px-2 focus-visible:ring-0 placeholder:text-[var(--text-olive)]/70 text-[var(--text-forest)]"
            disabled={isRunning}
          />
          {/* Scenario 13 — pasted a GitHub commit URL; offer to shorten it to
              the 7-char SHA and keep the rest of the description intact. */}
          {detectedCommit && !isRunning && (
            <button
              type="button"
              onClick={() => {
                setDescription(
                  description
                    .replace(detectedCommit.fullUrl, `[${detectedCommit.sha}]`)
                    .trim()
                );
              }}
              className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[11px] text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
              title={`Shorten to [${detectedCommit.sha}]`}
            >
              <span>GitHub commit</span>
              <code className="font-mono">{detectedCommit.sha}</code>
              <span>· {detectedCommit.repo}</span>
              <span className="text-[var(--text-olive)]/60">— tap to shorten</span>
            </button>
          )}
        </div>

        {/* RIGHT — Billable toggle + Timer module + Stop */}
        <div className="flex items-center gap-3 shrink-0 order-3 md:order-3 justify-end md:justify-start">
          {/* Billable — subtle text toggle, not a floating icon */}
          <button
            type="button"
            onClick={() => !isRunning && setBillable(!billable)}
            disabled={isRunning}
            aria-label={billable ? "Billable — on" : "Billable — off"}
            aria-pressed={billable}
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius-md)] transition-colors shrink-0",
              billable
                ? "bg-[var(--accent-olive-soft)] text-[var(--accent-olive-hover)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]",
              isRunning && "opacity-80 cursor-not-allowed"
            )}
            title={billable ? "Billable" : "Non-billable"}
          >
            <DollarSign className="h-4 w-4" />
          </button>

          {/* Centered timer module: big time + small earnings + live dot */}
          <div className="flex items-center gap-2.5 px-2 md:px-3 border-l border-[var(--border-subtle)] pl-3 md:pl-4">
            {isRunning && (
              <span
                aria-hidden
                className="pulse-dot h-2 w-2 rounded-full bg-[var(--accent-olive)] shrink-0"
              />
            )}
            <div className="flex flex-col items-end leading-none">
              <span
                className={cn(
                  "tabular-nums text-[22px] md:text-[26px] font-semibold tracking-tight",
                  isRunning ? "text-[var(--accent-olive-hover)]" : "text-[var(--text-forest)]"
                )}
              >
                {formatElapsed(elapsedSeconds)}
              </span>
              {hourlyRate > 0 ? (
                <span className="mt-1 text-[11px] tabular-nums text-[var(--text-olive)]">
                  {formatEarnings(elapsedSeconds, hourlyRate)}
                </span>
              ) : isRunning ? (
                // Gentle nudge — no rate set means earnings are dark. One tap
                // to /settings so the user can unblock themselves.
                <Link
                  href="/settings"
                  className="mt-1 text-[11px] text-[var(--text-olive)]/80 hover:text-[var(--text-forest)] underline-offset-2 hover:underline"
                  title="Set a default hourly rate to see earnings"
                >
                  Set rate
                </Link>
              ) : null}
            </div>
          </div>

          {/* Start / Stop button — neutral, not alarming */}
          <button
            type="button"
            onClick={isRunning ? handleStop : handleStart}
            disabled={loading}
            aria-label={isRunning ? "Stop timer" : "Start timer"}
            className={cn(
              "h-10 w-10 rounded-full inline-flex items-center justify-center transition-all shrink-0",
              isRunning
                ? "bg-[var(--bg-muted)] text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)] border border-[var(--border-medium)]"
                : "bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRunning ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-4 w-4 ml-[1px] fill-current" />
            )}
          </button>

          {/* Add manual entry — opens an inline editor beneath the timer bar */}
          <button
            type="button"
            aria-label="Add manual time entry"
            aria-expanded={addOpen}
            title="Add a past time entry"
            onClick={() => {
              setAddOpen((o) => {
                const next = !o;
                if (!next) resetAddForm();
                return next;
              });
            }}
            className={cn(
              "h-10 w-10 rounded-full inline-flex items-center justify-center transition-all shrink-0 bg-[var(--bg-muted)] text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)] border border-[var(--border-medium)]",
              addOpen && "bg-[var(--bg-cream-hover)] ring-1 ring-[var(--accent-olive)]/40"
            )}
          >
            <Plus className={cn("h-4 w-4 transition-transform", addOpen && "rotate-45")} />
          </button>
        </div>
      </div>

      {/* Manual-entry editor — expands inline below the timer bar so nothing
          is ever clipped off-screen. Reuses the inline-edit row pattern. */}
      {addOpen && (
        <div className="mt-2 px-3 md:px-4 py-4 bg-[var(--bg-cream)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
          <div>
            <label className="text-[11px] font-medium text-[var(--text-olive)] mb-1.5 block uppercase tracking-wide">
              What did you work on?
            </label>
            <Input
              placeholder="Describe the work…"
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              className="w-full h-10 bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-md)] text-[14px] px-3 focus-visible:bg-[var(--bg-cream)] focus-visible:border-[var(--accent-olive)]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-olive)] mb-1.5 block uppercase tracking-wide">
                Start date
              </label>
              <DatePickerField
                value={addStartDate}
                onChange={setAddStartDate}
                size="sm"
                displayFormat="MMM d, yyyy"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-olive)] mb-1.5 block uppercase tracking-wide">
                Start time
              </label>
              <Input
                type="time"
                value={addStartTime}
                onChange={(e) => setAddStartTime(e.target.value)}
                className="bg-[var(--bg-muted)] border-transparent rounded-[var(--radius-md)] h-9 text-[13px] tabular-nums"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-olive)] mb-1.5 block uppercase tracking-wide">
                End date
              </label>
              <DatePickerField
                value={addEndDate}
                onChange={setAddEndDate}
                size="sm"
                displayFormat="MMM d, yyyy"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-olive)] mb-1.5 block uppercase tracking-wide">
                End time
              </label>
              <Input
                type="time"
                value={addEndTime}
                onChange={(e) => setAddEndTime(e.target.value)}
                className="bg-[var(--bg-muted)] border-transparent rounded-[var(--radius-md)] h-9 text-[13px] tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
            <div className="flex-1 md:max-w-[280px]">
              <label className="text-[11px] font-medium text-[var(--text-olive)] mb-1.5 block uppercase tracking-wide">
                Project
              </label>
              <Select
                value={addProjectId}
                onValueChange={(v: string) => v && setAddProjectId(v)}
              >
                <SelectTrigger className="bg-[var(--bg-muted)]/50 border-transparent rounded-[var(--radius-md)] h-9">
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

            <button
              type="button"
              onClick={() => setAddBillable(!addBillable)}
              className={cn(
                "h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-[var(--radius-md)] text-[12px] font-medium transition-colors shrink-0",
                addBillable
                  ? "bg-[var(--accent-olive-soft)] text-[var(--accent-olive-hover)]"
                  : "bg-[var(--bg-muted)] text-[var(--text-olive)] hover:text-[var(--text-forest)]"
              )}
            >
              <DollarSign className="h-3.5 w-3.5" />
              {addBillable ? "Billable" : "Non-billable"}
            </button>

            <div className="flex items-center gap-2 md:ml-auto">
              <Button
                variant="ghost"
                className="h-9 px-3 text-[13px] rounded-[var(--radius-md)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)]"
                onClick={() => {
                  setAddOpen(false);
                  resetAddForm();
                }}
              >
                Cancel
              </Button>
              <Button
                className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90"
                onClick={handleManualAdd}
                disabled={addSubmitting}
              >
                {addSubmitting ? "Adding…" : "Add entry"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
