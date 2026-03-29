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
import { ProgressBar } from "@/components/ui/progress-bar";

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

  if (loading) {
    return (
      <div className="space-y-8 max-w-[1200px] mx-auto py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)]">Projects</h1>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse shadow-[var(--shadow-card)] border-[var(--border-subtle)] bg-[var(--bg-cream)] rounded-[var(--radius-xl)]">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-[var(--bg-muted)]" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mt-2">
                  <div className="h-4 w-24 rounded bg-[var(--bg-muted)]" />
                  <div className="h-1.5 w-full rounded bg-[var(--bg-muted)]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight">Projects</h1>
        <Button onClick={() => setDialogOpen(true)} className="rounded-full shadow-sm text-[15px] h-[40px] px-5">
          <Plus className="size-4 mr-2" />
          New Project
        </Button>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl tracking-tight text-[var(--text-forest)]">New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label htmlFor="project-name" className="text-[14px]">Name</Label>
                <Input
                  id="project-name"
                  placeholder="Website Redesign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  className="rounded-[var(--radius-lg)] h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[14px]">Color</Label>
                <div className="grid grid-cols-6 gap-3">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`size-10 rounded-[var(--radius-md)] transition-all flex items-center justify-center ${
                        color === c
                          ? "ring-2 ring-offset-2 ring-offset-[var(--bg-cream)] ring-[var(--accent-olive)] scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[14px]">Client</Label>
                <Select
                  value={clientId ?? ""}
                  onValueChange={(val: string) =>
                    setClientId(val === "" ? null : val)
                  }
                >
                  <SelectTrigger className="w-full rounded-[var(--radius-lg)] h-11">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hourly-rate" className="text-[14px]">Hourly Rate</Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`${settings.currencySymbol}0.00`}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="rounded-[var(--radius-lg)] h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimated-hours" className="text-[14px]">Est. Hours</Label>
                  <Input
                    id="estimated-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="rounded-[var(--radius-lg)] h-11"
                  />
                </div>
              </div>

              <Button
                className="w-full rounded-full h-[44px] text-[15px] font-medium mt-2"
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
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[var(--border-subtle)] border-dashed bg-[var(--bg-cream)] py-20 text-center shadow-sm">
          <div className="size-14 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-4">
            <FolderKanban className="size-6 text-[var(--accent-olive)]" />
          </div>
          <h2 className="text-xl font-serif font-medium text-[var(--text-forest)]">No projects yet</h2>
          <p className="mt-2 text-[15px] text-[var(--text-olive)]">
            Create your first project to start tracking time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                className="cursor-pointer transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 bg-[var(--bg-cream)] border-[var(--border-subtle)] shadow-[var(--shadow-card)] rounded-[var(--radius-xl)] p-5 flex flex-col"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 w-full">
                    <span
                      className="inline-block size-[14px] shrink-0 rounded-full flex-none mt-[2px]"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif font-semibold text-[18px] text-[var(--text-forest)] leading-tight">{project.name}</h3>
                      {project.client && (
                        <p className="text-[13px] text-[var(--text-olive)] truncate mt-1">
                          {project.client.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-auto space-y-4">
                  <div className="flex items-end justify-between font-sans">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wider mb-1">Time</span>
                      <span className="text-[16px] font-semibold text-[var(--text-forest)] leading-none tabular-nums">
                        {formatHours(project.totalSeconds)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wider mb-1">Earned</span>
                      <span className="text-[16px] font-semibold text-[var(--accent-teal)] leading-none tabular-nums">
                        {formatCurrency(earnings, settings.currencySymbol)}
                      </span>
                    </div>
                  </div>

                  {budgetPercent !== null && project.estimatedHours && (
                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between text-[13px] font-medium text-[var(--text-olive)] mb-2">
                        <span>Budget</span>
                        <span>
                          {totalHours.toFixed(1)} / {project.estimatedHours}h
                        </span>
                      </div>
                      <ProgressBar 
                        value={budgetPercent} 
                        className="h-1.5"
                        style={{"--accent-olive": project.color} as React.CSSProperties}
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
