"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Archive, RotateCcw, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TimeEntryRow } from "@/components/ui/time-entry-row";

import { useAppStore } from "@/stores/app-store";
import {
  getApplicableRate,
  calculateEarnings,
  formatCurrency,
  formatHours,
  formatDuration,
} from "@/lib/earnings";

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  status: string;
  client: Client | null;
  totalDuration: number;
  entryCount: number;
}

interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  project: {
    id: string;
    name: string;
    color: string;
    hourlyRate: number | null;
    client: Client | null;
  } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
}

interface UserSettings {
  defaultHourlyRate: number;
  currencySymbol: string;
}

interface ChartDay {
  day: string;
  hours: number;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    defaultHourlyRate: 0,
    currencySymbol: "$",
  });
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setProject(data);
    } catch {
      toast.error("Project not found");
      router.push("/projects");
    }
  }, [projectId, router]);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-entries?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      const data = await res.json();
      setEntries(data);
    } catch {
      toast.error("Failed to load time entries");
    }
  }, [projectId]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings({
        defaultHourlyRate: data.defaultHourlyRate,
        currencySymbol: data.currencySymbol,
      });
    } catch {
      toast.error("Failed to load settings");
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProject(), fetchEntries(), fetchSettings()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProject, fetchEntries, fetchSettings]);

  const rate = project
    ? getApplicableRate(project.hourlyRate, settings.defaultHourlyRate)
    : 0;

  const totalEarnings = project
    ? calculateEarnings(project.totalDuration, rate, true)
    : 0;

  const totalHours = project ? project.totalDuration / 3600 : 0;

  const budgetPercent =
    project?.estimatedHours && project.estimatedHours > 0
      ? (totalHours / project.estimatedHours) * 100
      : null;

  // Weekly chart data
  const weeklyData: ChartDay[] = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map((day) => {
      const daySeconds = entries
        .filter((entry) => {
          if (!entry.duration) return false;
          return isSameDay(new Date(entry.startTime), day);
        })
        .reduce((sum, entry) => sum + (entry.duration || 0), 0);

      return {
        day: format(day, "EEE"),
        hours: parseFloat((daySeconds / 3600).toFixed(2)),
      };
    });
  }, [entries]);

  async function handleSaveName() {
    if (!editName.trim() || !project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setProject((prev) => (prev ? { ...prev, name: editName.trim() } : prev));
      setEditDialogOpen(false);
      useAppStore.getState().invalidate("projects");
      toast.success("Project updated");
    } catch {
      toast.error("Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!project) return;
    const newStatus = project.status === "active" ? "archived" : "active";
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setProject((prev) => (prev ? { ...prev, status: newStatus } : prev));
      useAppStore.getState().invalidate("projects");
      toast.success(
        newStatus === "archived" ? "Project archived" : "Project reactivated"
      );
    } catch {
      toast.error("Failed to update project status");
    }
  }

  async function handleDelete() {
    if (!project) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      useAppStore.getState().invalidate("projects");
      toast.success("Project deleted");
      router.push("/projects");
    } catch {
      toast.error("Failed to delete project");
      setDeleting(false);
    }
  }

  if (loading || !project) {
    return (
      <div className="space-y-8 max-w-[1000px] mx-auto py-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--bg-muted)]" />
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--bg-muted)]" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse shadow-sm">
              <CardContent className="pt-6">
                <div className="h-10 w-24 rounded bg-[var(--bg-muted)]" />
                <div className="h-4 w-16 mt-3 rounded bg-[var(--bg-muted)]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1000px] mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between bg-[var(--bg-cream)] p-6 rounded-[var(--radius-xl)] shadow-[var(--shadow-card)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/projects")}
            className="h-9 w-9 bg-[var(--bg-muted)] hover:bg-[var(--accent-olive)]/20 hover:text-[var(--text-forest)] rounded-full shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="h-[40px] w-1 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] font-serif font-semibold text-[var(--text-forest)] leading-none">{project.name}</h1>
              {project.status === "archived" && (
                <span className="rounded-full bg-[var(--accent-coral)]/10 text-[var(--accent-coral)] px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase">
                  Archived
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {project.client && (
                <span className="text-[14px] font-medium text-[var(--text-olive)]">
                  For {project.client.name}
                </span>
              )}
              {project.client && project.hourlyRate != null && project.hourlyRate > 0 && (
                <span className="text-[var(--text-olive)] opacity-50">•</span>
              )}
              {project.hourlyRate != null && project.hourlyRate > 0 && (
                <span className="text-[14px] font-medium text-[var(--accent-teal)]">
                  {settings.currencySymbol}{project.hourlyRate}/hr
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditName(project.name);
              setEditDialogOpen(true);
            }}
            className="h-9 rounded-full px-4 text-[13px] border-[var(--border-subtle)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)]"
          >
            <Pencil className="size-3.5 mr-1.5" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleStatus}
            className="h-9 rounded-full px-4 text-[13px] border-[var(--border-subtle)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)]"
          >
            {project.status === "active" ? (
              <>
                <Archive className="size-3.5 mr-1.5" />
                Archive
              </>
            ) : (
              <>
                <RotateCcw className="size-3.5 mr-1.5" />
                Reactivate
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-9 rounded-full px-4 text-[13px] bg-[var(--accent-coral)]/10 text-[var(--accent-coral)] hover:bg-[var(--accent-coral)] hover:text-white border-transparent"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-[var(--border-subtle)]">
          <CardContent className="p-6">
            <span className="text-[12px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-2 block">Total Tracked</span>
            <p className="text-[32px] font-semibold text-[var(--text-forest)] font-sans leading-none">
              {formatHours(project.totalDuration)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-[var(--border-subtle)]">
          <CardContent className="p-6">
            <span className="text-[12px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-2 block">Earnings</span>
            <p className="text-[32px] font-semibold text-[var(--accent-teal)] font-sans leading-none">
              {formatCurrency(totalEarnings, settings.currencySymbol)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-[var(--border-subtle)]">
          <CardContent className="p-6">
            <span className="text-[12px] font-semibold text-[var(--text-olive)] uppercase tracking-wider mb-2 block">Budget Used</span>
            {project.estimatedHours ? (
              <div className="space-y-3">
                <p className="text-[32px] font-semibold text-[var(--text-forest)] font-sans leading-none">
                  {totalHours.toFixed(1)} <span className="text-xl text-[var(--text-olive)]">/ {project.estimatedHours}h</span>
                </p>
                <ProgressBar 
                  value={budgetPercent ?? 0}
                  className="h-2"
                  style={{"--accent-olive": project.color} as React.CSSProperties}
                />
              </div>
            ) : (
              <p className="text-[32px] font-semibold text-[var(--text-olive)] font-sans leading-none mt-1 opacity-50">
                No budget
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card className="shadow-[var(--shadow-card)] border-[var(--border-subtle)]">
        <CardHeader className="pb-2">
          <CardTitle className="font-sans text-[16px]">This Week&apos;s Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 13, fill: "var(--text-olive)", fontFamily: "Inter" }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: "var(--text-olive)", fontFamily: "Inter" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  dx={-10}
                />
                <Tooltip
                  cursor={{ fill: "var(--bg-muted)", opacity: 0.5 }}
                  contentStyle={{
                    backgroundColor: "var(--bg-cream)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "12px",
                    boxShadow: "var(--shadow-dropdown)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-forest)",
                  }}
                  itemStyle={{
                    color: project.color,
                    fontWeight: 600,
                  }}
                  formatter={(value) => [
                    `${Number(value).toFixed(2)}h`,
                    "Tracked",
                  ]}
                />
                <Bar
                  dataKey="hours"
                  fill={project.color}
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries */}
      <Card className="shadow-[var(--shadow-card)] border-[var(--border-subtle)]">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-4">
          <CardTitle className="font-sans text-[16px]">Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-2">
          {entries.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-3">
                <Clock className="size-5 text-[var(--text-olive)] opacity-50" />
              </div>
              <p className="text-[15px] font-medium text-[var(--text-olive)]">
                No time entries for this project yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) => (
                <div key={entry.id} className="border-b border-[var(--border-subtle)] last:border-0 py-1">
                  <TimeEntryRow
                    className="hover:bg-transparent px-2"
                    description={entry.description || "No description"}
                    duration={entry.duration ? formatDuration(entry.duration) : "Running..."}
                  />
                  {entry.duration && entry.billable && (
                    <div className="flex px-2 pb-2 -mt-1 text-[12px] font-medium text-[var(--text-olive)]">
                      <span className="mr-3">{format(new Date(entry.startTime), "MMM d, h:mm a")}</span>
                      <span className="text-[var(--accent-teal)]">
                        {formatCurrency(calculateEarnings(entry.duration, rate, true), settings.currencySymbol)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Project Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                }}
                className="rounded-[var(--radius-lg)] h-11"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-full h-10 px-5"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full h-10 px-5"
                onClick={handleSaveName}
                disabled={saving || !editName.trim()}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-[var(--accent-coral)]">Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-[15px] text-[var(--text-olive)] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-[var(--text-forest)]">&ldquo;{project.name}&rdquo;</span>? This
              action cannot be undone. Time entries linked to this project will be
              unlinked and kept.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-full h-10 px-5"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-full h-10 px-5 bg-[var(--accent-coral)]"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
