"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Archive, RotateCcw } from "lucide-react";
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

  function getBudgetColor(percent: number): string {
    if (percent > 90) return "bg-red-500";
    if (percent >= 75) return "bg-yellow-500";
    return "bg-green-500";
  }

  function getBudgetTrackColor(percent: number): string {
    if (percent > 90) return "bg-red-100 dark:bg-red-950";
    if (percent >= 75) return "bg-yellow-100 dark:bg-yellow-950";
    return "bg-green-100 dark:bg-green-950";
  }

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
      toast.success("Project deleted");
      router.push("/projects");
    } catch {
      toast.error("Failed to delete project");
      setDeleting(false);
    }
  }

  if (loading || !project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4">
                <div className="h-8 w-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/projects")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span
            className="inline-block size-4 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.client && (
            <span className="text-sm text-muted-foreground">
              {project.client.name}
            </span>
          )}
          {project.hourlyRate != null && project.hourlyRate > 0 && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {settings.currencySymbol}
              {project.hourlyRate}/hr
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditName(project.name);
              setEditDialogOpen(true);
            }}
          >
            <Pencil className="size-3.5" data-icon="inline-start" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleStatus}>
            {project.status === "active" ? (
              <>
                <Archive className="size-3.5" data-icon="inline-start" />
                Archive
              </>
            ) : (
              <>
                <RotateCcw className="size-3.5" data-icon="inline-start" />
                Reactivate
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-3.5" data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatHours(project.totalDuration)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(totalEarnings, settings.currencySymbol)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.estimatedHours ? (
              <div className="space-y-2">
                <p className="text-2xl font-semibold">
                  {totalHours.toFixed(1)} / {project.estimatedHours}h
                </p>
                <div
                  className={`h-2 w-full overflow-hidden rounded-full ${getBudgetTrackColor(
                    budgetPercent ?? 0
                  )}`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${getBudgetColor(
                      budgetPercent ?? 0
                    )}`}
                    style={{
                      width: `${Math.min(budgetPercent ?? 0, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-2xl font-semibold text-muted-foreground">
                No budget
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle>This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [
                    `${Number(value).toFixed(2)}h`,
                    "Hours",
                  ]}
                />
                <Bar
                  dataKey="hours"
                  fill={project.color}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No time entries for this project yet.
            </p>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.description || "(no description)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.startTime), "MMM d, yyyy 'at' HH:mm")}
                      {entry.tags.length > 0 && (
                        <span className="ml-2">
                          {entry.tags
                            .map((t) => t.tag.name)
                            .join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {entry.duration
                        ? formatDuration(entry.duration)
                        : "Running..."}
                    </p>
                    {entry.duration && entry.billable && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(
                          calculateEarnings(entry.duration, rate, true),
                          settings.currencySymbol
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveName}
                disabled={saving || !editName.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{project.name}&rdquo;? This
            action cannot be undone. Time entries linked to this project will be
            unlinked.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
