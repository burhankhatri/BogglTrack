"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, Check } from "lucide-react";
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
import { useAppStore } from "@/stores/app-store";

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
  const projects = useAppStore((s) => s.pageProjects.data);
  const fetchPageProjects = useAppStore((s) => s.fetchPageProjects);
  const clients = (useAppStore((s) => s.clients.data) ?? []) as Client[];
  const appSettings = useAppStore((s) => s.settings.data);
  const invalidate = useAppStore((s) => s.invalidate);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const settings: UserSettings = {
    defaultHourlyRate: appSettings?.defaultHourlyRate ?? 0,
    currencySymbol: appSettings?.currencySymbol ?? "$",
  };
  const defaultProjectId = appSettings?.defaultProjectId ?? null;
  const storeLoading = useAppStore((s) => s.pageProjects.loading);
  const loading = storeLoading && !projects;

  async function toggleDefaultProject(projectId: string) {
    const newDefault = defaultProjectId === projectId ? null : projectId;
    // Optimistic — update the store cache immediately so the pill flips
    // without waiting for the network round-trip.
    useAppStore.setState((s) => ({
      settings: {
        ...s.settings,
        data: s.settings.data
          ? { ...s.settings.data, defaultProjectId: newDefault }
          : s.settings.data,
      },
    }));
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultProjectId: newDefault }),
      });
      if (!res.ok) throw new Error();
      invalidate("settings");
      fetchSettings(true);
      toast.success(newDefault ? "Default project set" : "Default project cleared");
    } catch {
      // Rollback
      useAppStore.setState((s) => ({
        settings: {
          ...s.settings,
          data: s.settings.data
            ? { ...s.settings.data, defaultProjectId }
            : s.settings.data,
        },
      }));
      toast.error("Failed to update default project");
    }
  }
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  useEffect(() => {
    const appStore = useAppStore.getState();
    appStore.fetchPageProjects();
    appStore.fetchClients();
    appStore.fetchSettings();
  }, []);

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

    const tempId = "temp-" + Date.now();
    const matchedClient = clientId ? clients.find((c) => c.id === clientId) : null;
    const tempProject: Project = {
      id: tempId,
      name: name.trim(),
      color,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      status: "active",
      client: matchedClient ? { id: matchedClient.id, name: matchedClient.name } : null,
      totalSeconds: 0,
      _count: { timeEntries: 0 },
    };

    // Optimistic: add to store immediately
    useAppStore.getState().optimisticUpdatePageProjects((prev) => [tempProject, ...prev]);
    setDialogOpen(false);
    resetForm();
    toast.success("Project created");

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

      const realProject = await res.json();
      // Swap temp with real
      useAppStore.getState().optimisticUpdatePageProjects((prev) =>
        prev.map((p) => (p.id === tempId ? realProject : p))
      );
      useAppStore.getState().invalidate("projects");
    } catch {
      // Rollback
      useAppStore.getState().optimisticUpdatePageProjects((prev) =>
        prev.filter((p) => p.id !== tempId)
      );
      toast.error("Failed to create project");
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
            <DialogHeader className="mb-5">
              <DialogTitle className="font-serif text-[22px] tracking-tight text-[var(--text-forest)]">New Project</DialogTitle>
              <p className="text-[13px] text-[var(--text-olive)] mt-1">
                You can edit these details any time.
              </p>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="project-name" className="text-[13px] font-medium text-[var(--text-olive)]">Name</Label>
                <Input
                  id="project-name"
                  placeholder="Website Redesign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  className="rounded-[var(--radius-lg)] h-11"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[var(--text-olive)]">Color</Label>
                <div className="flex flex-wrap gap-2 px-1 py-1">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`size-8 rounded-full transition-all ${
                        color === c
                          ? "ring-2 ring-offset-2 ring-offset-[var(--bg-cream)] ring-[var(--accent-olive)]"
                          : "hover:scale-110 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[var(--text-olive)]">Client</Label>
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
                <div className="space-y-1.5">
                  <Label htmlFor="hourly-rate" className="text-[13px] font-medium text-[var(--text-olive)]">Hourly Rate</Label>
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
                <div className="space-y-1.5">
                  <Label htmlFor="estimated-hours" className="text-[13px] font-medium text-[var(--text-olive)]">Est. Hours</Label>
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
              <p className="text-[12px] text-[var(--text-olive)]/80 -mt-2">
                Leave rate blank to use your default from Settings.
              </p>

              <Button
                className="w-full rounded-full h-[44px] text-[15px] font-medium"
                onClick={handleCreate}
                disabled={creating || !name.trim()}
              >
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!projects || projects.length === 0) ? (
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
          {(projects ?? []).map((project) => {
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
            const isDefault = defaultProjectId === project.id;

            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="block group/card">
              <Card
                className="cursor-pointer transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 bg-[var(--bg-cream)] border-[var(--border-subtle)] shadow-[var(--shadow-card)] rounded-[var(--radius-xl)] p-5 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                  {/* Default project indicator */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleDefaultProject(project.id);
                    }}
                    title={isDefault ? "Remove as default" : "Set as default project"}
                    className={`shrink-0 ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide transition-all ${
                      isDefault
                        ? "bg-[var(--accent-olive-soft)] text-[var(--accent-olive)] opacity-100"
                        : "text-[var(--text-muted)] opacity-0 group-hover/card:opacity-100 hover:bg-[var(--bg-muted)] hover:text-[var(--text-olive)]"
                    }`}
                  >
                    <Check className={`h-3 w-3 ${
                      isDefault ? "opacity-100" : "opacity-50"
                    }`} />
                    {isDefault ? "Default" : "Set default"}
                  </button>
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
