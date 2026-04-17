"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X, ExternalLink, Loader2, Lock, Search } from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface LinkedRepo {
  id: string;
  repoFullName: string;
}

interface PickerRepo {
  fullName: string;
  private: boolean;
  pushedAt: string;
  description: string | null;
}

interface Props {
  projectId: string;
}

/**
 * GitHub repo linker for a project. Shows repos currently linked, lets the
 * user add/remove. Search autocomplete hits /api/github/repos which the
 * user must have connected first; surface a nudge if not connected.
 */
export function ProjectReposCard({ projectId }: Props) {
  const [linked, setLinked] = useState<LinkedRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PickerRepo[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const loadLinked = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}/repos`);
      if (!r.ok) return;
      setLinked(await r.json());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadLinked();
  }, [loadLinked]);

  // Debounced search
  useEffect(() => {
    if (!pickerOpen) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(
          `/api/github/repos?q=${encodeURIComponent(search)}`
        );
        if (r.status === 400) {
          setNotConnected(true);
          setResults([]);
          return;
        }
        if (!r.ok) {
          setResults([]);
          return;
        }
        setNotConnected(false);
        setResults(await r.json());
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [search, pickerOpen]);

  // Click-outside to close
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const linkedSet = new Set(linked.map((r) => r.repoFullName));

  const addRepo = async (repoFullName: string) => {
    const r = await fetch(`/api/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoFullName }),
    });
    if (!r.ok) {
      toast.error("Couldn't link repo");
      return;
    }
    const row = await r.json();
    setLinked((prev) => (prev.find((x) => x.id === row.id) ? prev : [...prev, row]));
    toast.success(`Linked ${repoFullName}`);
    setSearch("");
  };

  const removeRepo = async (repoFullName: string) => {
    const r = await fetch(
      `/api/projects/${projectId}/repos?repoFullName=${encodeURIComponent(repoFullName)}`,
      { method: "DELETE" }
    );
    if (!r.ok) {
      toast.error("Couldn't unlink");
      return;
    }
    setLinked((prev) => prev.filter((x) => x.repoFullName !== repoFullName));
    toast.success(`Unlinked ${repoFullName}`);
  };

  return (
    <Card className="shadow-[var(--shadow-card)] border-[var(--border-subtle)]">
      <CardHeader className="pb-3">
        <CardTitle className="font-sans text-[16px]">GitHub repos</CardTitle>
        <p className="text-[12px] text-[var(--text-olive)]">
          Link repos so commits in those repos auto-attach to this project.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-olive)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {linked.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {linked.map((r) => (
                  <li
                    key={r.id}
                    className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-[var(--bg-muted)] text-[12px] font-medium text-[var(--text-forest)]"
                  >
                    <a
                      href={`https://github.com/${r.repoFullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-[var(--accent-olive-hover)]"
                    >
                      {r.repoFullName}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                    <button
                      onClick={() => removeRepo(r.repoFullName)}
                      className="ml-1 h-5 w-5 inline-flex items-center justify-center rounded-full text-[var(--text-olive)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/10 transition-colors"
                      title="Unlink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="relative" ref={pickerRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-olive)] pointer-events-none" />
                <Input
                  placeholder={linked.length > 0 ? "Link another repo…" : "Add a GitHub repo…"}
                  value={search}
                  onFocus={() => setPickerOpen(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPickerOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && /^[^/]+\/[^/]+$/.test(search.trim())) {
                      e.preventDefault();
                      addRepo(search.trim());
                      setPickerOpen(false);
                    }
                    if (e.key === "Escape") setPickerOpen(false);
                  }}
                  className="h-9 pl-9 text-[13px]"
                />
              </div>

              {pickerOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-20 max-h-[280px] overflow-y-auto rounded-[var(--radius-md)] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] p-1">
                  {notConnected ? (
                    <div className="p-3 text-[12px] text-[var(--text-olive)]">
                      Connect GitHub in Settings → GitHub to search repos, or
                      paste an <code>owner/name</code> and press Enter.
                    </div>
                  ) : searching ? (
                    <div className="flex items-center gap-2 p-3 text-[12px] text-[var(--text-olive)]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching…
                    </div>
                  ) : results.length === 0 ? (
                    <div className="p-3 text-[12px] text-[var(--text-olive)]">
                      {search
                        ? "No matches. Press Enter to add manually."
                        : "Start typing to search your repos."}
                    </div>
                  ) : (
                    <ul>
                      {results.map((r) => {
                        const already = linkedSet.has(r.fullName);
                        return (
                          <li key={r.fullName}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!already) addRepo(r.fullName);
                                setPickerOpen(false);
                              }}
                              disabled={already}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-[13px] text-left text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {r.private && (
                                <Lock className="h-3 w-3 shrink-0 text-[var(--text-olive)]" />
                              )}
                              <span className="font-medium truncate">{r.fullName}</span>
                              {already && (
                                <span className="ml-auto text-[11px] text-[var(--text-olive)]">
                                  Linked
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {linked.length === 0 && !pickerOpen && (
              <p className="text-[12px] text-[var(--text-muted)]">
                <Plus className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                New commits in linked repos will automatically attach to this project.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
