"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Square,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useTimerStore } from "@/stores/timer-store";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
}

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

export function GlobalTimerBar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch {
        // Projects fetch failed silently — not critical
      }
    }
    fetchProjects();
  }, []);

  // Check for running timer on mount
  useEffect(() => {
    async function checkRunning() {
      try {
        const res = await fetch("/api/time-entries/running");
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
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
        }
      } catch {
        // Running check failed silently
      }
    }
    checkRunning();
  }, [restoreTimer]);

  // Tick interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, tick]);

  // Update hourly rate when project changes
  useEffect(() => {
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.hourlyRate) {
        setHourlyRate(project.hourlyRate);
      }
    } else {
      setHourlyRate(0);
    }
  }, [projectId, projects, setHourlyRate]);

  const handleStart = useCallback(() => {
    const now = new Date().toISOString();
    const tempId = "temp-" + Date.now();
    const project = projects.find((p) => p.id === projectId);

    // Start timer instantly (optimistic)
    startTimer({
      entryId: tempId,
      startTime: now,
      description,
      projectId,
      billable,
      tagIds: [],
      hourlyRate: project?.hourlyRate || 0,
    });

    // Save to server in background
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
      .then((entry) => {
        setEntryId(entry.id);
      })
      .catch(() => {
        stopTimer();
        toast.error("Failed to start timer");
      });
  }, [description, projectId, billable, projects, startTimer, setEntryId, stopTimer]);

  const handleStop = useCallback(async () => {
    if (!entryId) return;
    if (entryId.startsWith("temp-")) {
      toast.info("Still saving, try again in a moment");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/time-entries/${entryId}/stop`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Failed to stop timer");
        return;
      }

      stopTimer();
      toast.success("Time entry saved");
    } catch {
      toast.error("Failed to stop timer");
    } finally {
      setLoading(false);
    }
  }, [entryId, stopTimer]);

  return (
    <div className="sticky top-0 z-30 bg-background pt-4 pb-2 px-6 md:px-10 border-b border-border/30">
      <div className="flex flex-col md:flex-row items-center gap-4 py-4 px-6 bg-card rounded-[24px] shadow-sm">
        {/* Description input */}
        <div className="flex-1 w-full relative">
          <Input
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-12 bg-transparent border-transparent shadow-none text-lg px-0 focus-visible:ring-0 placeholder:text-muted-foreground/60"
            disabled={isRunning}
          />
        </div>

        <div className="flex items-center gap-3 w-full justify-between md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {/* Project selector */}
          <Select
            value={projectId || ""}
            onValueChange={(value) => setProjectId(value || null)}
            disabled={isRunning}
          >
            <SelectTrigger className="h-10 border-transparent bg-background/50 rounded-full shrink-0 font-medium">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Billable toggle */}
          <Toggle
            pressed={billable}
            onPressedChange={setBillable}
            aria-label="Toggle billable"
            disabled={isRunning}
            className={cn(
              "shrink-0 h-10 w-10 p-0 rounded-full transition-colors",
              billable ? "bg-primary/20 text-primary" : "text-muted-foreground"
            )}
          >
            <DollarSign className="h-4 w-4" />
          </Toggle>

          {/* Elapsed time & earnings */}
          <div className="flex items-center gap-4 shrink-0 px-2 lg:px-6">
            <span className="tabular-nums text-3xl font-medium tracking-tight">
              {formatElapsed(elapsedSeconds)}
            </span>
            {hourlyRate > 0 && (
              <span className="text-xl text-primary font-medium tabular-nums ml-2">
                {formatEarnings(elapsedSeconds, hourlyRate)}
              </span>
            )}
          </div>

          {/* Start/Stop button */}
          <button
            onClick={isRunning ? handleStop : handleStart}
            disabled={loading}
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center transition-all bg-primary hover:bg-accent text-foreground shadow-sm shrink-0",
              isRunning && "bg-secondary text-foreground hover:bg-destructive/80"
            )}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRunning ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 ml-1 fill-current" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
