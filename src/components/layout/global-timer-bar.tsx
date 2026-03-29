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
    <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Pulsing indicator */}
        {isRunning && (
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
        )}

        {/* Description input */}
        <Input
          placeholder="What are you working on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 min-w-0"
          disabled={isRunning}
        />

        {/* Project selector */}
        <Select
          value={projectId || ""}
          onValueChange={(value) => setProjectId(value || null)}
          disabled={isRunning}
        >
          <SelectTrigger className="w-[180px] shrink-0">
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
            "shrink-0",
            billable && "text-green-600 dark:text-green-400"
          )}
        >
          <DollarSign className="h-4 w-4" />
        </Toggle>

        {/* Elapsed time & earnings */}
        {isRunning && (
          <div className="flex items-center gap-3 shrink-0 font-mono text-sm">
            <span className="tabular-nums font-semibold">
              {formatElapsed(elapsedSeconds)}
            </span>
            {hourlyRate > 0 && (
              <span className="text-green-600 dark:text-green-400 tabular-nums">
                {formatEarnings(elapsedSeconds, hourlyRate)}
              </span>
            )}
          </div>
        )}

        {/* Start/Stop button */}
        <Button
          size="icon"
          variant={isRunning ? "destructive" : "default"}
          onClick={isRunning ? handleStop : handleStart}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRunning ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
