"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban } from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PROJECT_COLORS } from "@/lib/constants";
import {
  getApplicableRate,
  calculateEarnings,
  formatCurrency,
  formatHours,
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
  totalSeconds: number;
  _count: { timeEntries: number };
}

interface UserSettings {
  defaultHourlyRate: number;
  currencySymbol: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    defaultHourlyRate: 0,
    currencySymbol: "$",
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch {
      toast.error("Failed to load projects");
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      setClients(data);
    } catch {
      toast.error("Failed to load clients");
    }
  }, []);

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
    Promise.all([fetchProjects(), fetchClients(), fetchSettings()]).finally(
      () => setLoading(false)
    );
  }, [fetchProjects, fetchClients, fetchSettings]);

  function resetForm() {
    setName("");
    setColor(PROJECT_COLORS[0]);
    setClientId(null);
    setHourlyRate("");
    setEstimatedHours("");
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          clientId: clientId || undefined,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
          estimatedHours: estimatedHours
            ? parseFloat(estimatedHours)
            : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create project");

      const newProject = await res.json();
      setProjects((prev) => [newProject, ...prev]);
      setDialogOpen(false);
      resetForm();
      toast.success("Project created");
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-4" data-icon="inline-start" />
                New Project
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  placeholder="Project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="grid grid-cols-6 gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`size-8 rounded-lg transition-all ${
                        color === c
                          ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={clientId ?? ""}
                  onValueChange={(val) =>
                    setClientId(val === "" ? null : (val as string))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="hourly-rate">Hourly Rate</Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`${settings.currencySymbol}0.00`}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimated-hours">Est. Hours</Label>
                  <Input
                    id="estimated-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating || !name.trim()}
              >
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <FolderKanban className="mb-3 size-10 text-muted-foreground" />
          <h2 className="text-lg font-medium">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to start tracking time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const totalHours = project.totalSeconds / 3600;
            const rate = getApplicableRate(
              project.hourlyRate,
              settings.defaultHourlyRate
            );
            const earnings = calculateEarnings(
              project.totalSeconds,
              rate,
              true
            );
            const budgetPercent = project.estimatedHours
              ? (totalHours / project.estimatedHours) * 100
              : null;

            return (
              <Card
                key={project.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate font-medium">{project.name}</span>
                  </div>
                  {project.client && (
                    <p className="text-sm text-muted-foreground">
                      {project.client.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatHours(project.totalSeconds)}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(earnings, settings.currencySymbol)}
                    </span>
                  </div>
                  {budgetPercent !== null && project.estimatedHours && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Budget</span>
                        <span>
                          {totalHours.toFixed(1)} / {project.estimatedHours}h
                        </span>
                      </div>
                      <div
                        className={`h-2 w-full overflow-hidden rounded-full ${getBudgetTrackColor(
                          budgetPercent
                        )}`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${getBudgetColor(
                            budgetPercent
                          )}`}
                          style={{
                            width: `${Math.min(budgetPercent, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
