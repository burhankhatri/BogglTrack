"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Clock, Play } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app-store";
import { resumeTimerOptimistic } from "@/lib/timer-actions";
import { formatDuration, formatCurrency, calculateEarnings, getApplicableRate } from "@/lib/earnings";
import { getDateRange, filterCompletedEntries, groupEntriesByDescription, type GroupedEntry } from "./calendar-helpers";

interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: {
    id: string;
    name: string;
    color: string;
    hourlyRate: number | null;
    client: { id: string; name: string } | null;
  } | null;
  tags: { tagId: string; tag: { id: string; name: string; color: string } }[];
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const settingsData = useAppStore((s) => s.settings.data);
  const userDefaultRate = settingsData?.defaultHourlyRate ?? 0;

  const fetchEntries = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(date);
      const res = await fetch(`/api/time-entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(filterCompletedEntries(data));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    useAppStore.getState().fetchSettings();
    fetchEntries(selectedDate);
  }, [fetchEntries, selectedDate]);

  // Refresh when a timer is stopped
  useEffect(() => {
    const handleConfirmed = () => fetchEntries(selectedDate);
    const handleCompleted = () => fetchEntries(selectedDate);
    window.addEventListener("timer-entry-confirmed", handleConfirmed);
    window.addEventListener("timer-entry-completed", handleCompleted);
    return () => {
      window.removeEventListener("timer-entry-confirmed", handleConfirmed);
      window.removeEventListener("timer-entry-completed", handleCompleted);
    };
  }, [fetchEntries, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) setSelectedDate(date);
  };

  const grouped = groupEntriesByDescription(entries);

  const totalSeconds = grouped.reduce((sum, g) => sum + g.totalDuration, 0);
  const totalEarnings = grouped.reduce((sum, g) => {
    const rate = getApplicableRate(g.project?.hourlyRate ?? null, userDefaultRate);
    return sum + calculateEarnings(g.totalDuration, rate, g.billable);
  }, 0);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:pt-10 space-y-8">
      {/* Header */}
      <h1 className="font-serif text-[28px] font-semibold text-[var(--text-forest)]">Calendar</h1>

      {/* Calendar + summary */}
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <Card className="p-2 shadow-[var(--shadow-card)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)] self-start mx-auto md:mx-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="rounded-[var(--radius-xl)]"
          />
        </Card>

        <div className="space-y-6">
          {/* Day summary */}
          <Card className="px-6 py-5 shadow-[var(--shadow-card)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[15px] font-medium text-[var(--text-olive)]">
                <Clock className="h-[18px] w-[18px]" />
                <span>{format(selectedDate, "EEEE, MMMM d")}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[18px] font-semibold tabular-nums text-[var(--text-forest)] font-sans">
                  {formatDuration(totalSeconds)}
                </span>
                {totalEarnings > 0 && (
                  <span className="text-[18px] font-semibold text-[var(--accent-teal)] tabular-nums font-sans">
                    {formatCurrency(totalEarnings)}
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Entries */}
          {loading ? (
            <Card className="px-6 py-16 text-center border border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
              <p className="text-[15px] text-[var(--text-olive)] animate-pulse">Loading entries...</p>
            </Card>
          ) : grouped.length === 0 ? (
            <Card className="px-6 py-16 text-center shadow-none border border-[var(--border-subtle)] border-dashed bg-transparent rounded-[var(--radius-xl)]">
              <p className="text-[15px] text-[var(--text-olive)] font-medium">No entries for this day.</p>
            </Card>
          ) : (
            <Card className="border border-[var(--border-subtle)] shadow-[var(--shadow-card)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
              <div className="flex flex-col">
                {grouped.map((group, index) => {
                  const rate = getApplicableRate(group.project?.hourlyRate ?? null, userDefaultRate);
                  const earnings = calculateEarnings(group.totalDuration, rate, group.billable);
                  const isLast = index === grouped.length - 1;

                  return (
                    <div
                      key={group.key}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 hover:bg-[var(--bg-sage)]/30 transition-colors group ${!isLast ? "border-b border-[var(--border-subtle)]" : ""}`}
                    >
                      {/* Left: description + project + time range + count */}
                      <div className="flex flex-col gap-[6px] flex-1 min-w-0 pr-4">
                        <span className="text-[15px] font-medium text-[var(--text-forest)] leading-none truncate font-sans">
                          {group.description || "(No description)"}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {group.project && (
                            <Badge
                              variant="outline"
                              className="font-medium px-2.5 py-1 text-[12px] rounded-[var(--radius-md)] border-transparent"
                              style={{
                                color: group.project.color,
                                backgroundColor: `${group.project.color}15`,
                              }}
                            >
                              {group.project.name}
                            </Badge>
                          )}
                          <span className="text-[12px] text-[var(--text-olive)]">
                            {format(new Date(group.startTime), "HH:mm")}
                            {" - "}
                            {group.endTime ? format(new Date(group.endTime), "HH:mm") : "running"}
                          </span>
                          {group.entryCount > 1 && (
                            <span className="text-[11px] font-medium text-[var(--text-olive)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                              {group.entryCount} entries
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: duration + earnings + play */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0">
                        <div className="flex flex-col sm:items-end">
                          <span className="font-sans text-[16px] font-semibold tracking-tight text-[var(--text-forest)] tabular-nums">
                            {formatDuration(group.totalDuration)}
                          </span>
                          {earnings > 0 && (
                            <span className="text-[13px] font-medium tabular-nums text-[var(--text-olive)] mt-[2px]">
                              {formatCurrency(earnings)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => resumeTimerOptimistic(group, userDefaultRate)}
                          className="h-10 w-10 bg-[var(--accent-olive)] hover:bg-[var(--accent-olive-hover)] text-[var(--text-forest)] rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          title="Resume timer"
                        >
                          <Play className="h-[18px] w-[18px] fill-current ml-[2px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
