import { toast } from "sonner";
import { useTimerStore } from "@/stores/timer-store";
import { getApplicableRate } from "@/lib/earnings";

interface ResumeEntry {
  description: string;
  projectId: string | null;
  billable: boolean;
  project: { hourlyRate: number | null } | null;
  tags: { tagId: string }[];
}

export function resumeTimerOptimistic(
  entry: ResumeEntry,
  userDefaultRate: number
) {
  const tempId = "temp-" + Date.now();
  const now = new Date().toISOString();
  const rate = getApplicableRate(
    entry.project?.hourlyRate ?? null,
    userDefaultRate
  );
  const tagIds = entry.tags.map((t) => t.tagId);

  // 1. Start timer instantly (optimistic)
  useTimerStore.getState().startTimer({
    entryId: tempId,
    startTime: now,
    description: entry.description,
    projectId: entry.projectId,
    billable: entry.billable,
    tagIds,
    hourlyRate: rate,
  });

  // 2. Save to server in background
  fetch("/api/time-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: entry.description,
      startTime: now,
      projectId: entry.projectId,
      billable: entry.billable,
      tagIds,
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    })
    .then((newEntry) => {
      useTimerStore.getState().setEntryId(newEntry.id);
    })
    .catch(() => {
      useTimerStore.getState().stopTimer();
      toast.error("Failed to start timer");
    });
}
