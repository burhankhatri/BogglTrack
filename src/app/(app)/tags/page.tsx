"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PROJECT_COLORS } from "@/lib/constants";
import { useAppStore } from "@/stores/app-store";

// Use the same colors we do for projects (or a nice earthy set)
const TAG_COLORS = PROJECT_COLORS;

interface Tag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
}

export default function TagsPage() {
  const tags = useAppStore((s) => s.pageTags.data);
  const storeLoading = useAppStore((s) => s.pageTags.loading);
  const fetchPageTags = useAppStore((s) => s.fetchPageTags);
  const loading = storeLoading && !tags;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);

  useEffect(() => {
    fetchPageTags();
  }, [fetchPageTags]);

  function openCreateDialog() {
    setEditingTag(null);
    setName("");
    setColor(TAG_COLORS[0]);
    setDialogOpen(true);
  }

  function openEditDialog(tag: Tag) {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setDialogOpen(true);
  }

  function openDeleteDialog(tag: Tag) {
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingTag) {
        const patch = { name: name.trim(), color };
        useAppStore.getState().optimisticUpdatePageTags((prev) =>
          prev.map((t) => (t.id === editingTag.id ? { ...t, ...patch } : t))
        );
        setDialogOpen(false);
        toast.success("Tag updated");

        const res = await fetch(`/api/tags/${editingTag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          fetchPageTags(true);
          throw new Error("Failed to update tag");
        }
        useAppStore.getState().invalidate("tags");
      } else {
        const tempId = "temp-" + Date.now();
        const tempTag: Tag = { id: tempId, name: name.trim(), color, usageCount: 0 };
        useAppStore.getState().optimisticUpdatePageTags((prev) => [tempTag, ...prev]);
        setDialogOpen(false);
        toast.success("Tag created");

        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color }),
        });
        if (!res.ok) {
          useAppStore.getState().optimisticUpdatePageTags((prev) =>
            prev.filter((t) => t.id !== tempId)
          );
          throw new Error("Failed to create tag");
        }
        const real = await res.json();
        useAppStore.getState().optimisticUpdatePageTags((prev) =>
          prev.map((t) => (t.id === tempId ? { ...real } : t))
        );
        useAppStore.getState().invalidate("tags");
      }
    } catch {
      toast.error(editingTag ? "Failed to update tag" : "Failed to create tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTag) return;

    useAppStore.getState().optimisticUpdatePageTags((prev) =>
      prev.filter((t) => t.id !== deletingTag.id)
    );
    setDeleteDialogOpen(false);
    setDeletingTag(null);
    toast.success("Tag deleted");

    try {
      const res = await fetch(`/api/tags/${deletingTag.id}`, { method: "DELETE" });
      if (!res.ok) {
        fetchPageTags(true);
        throw new Error("Failed to delete tag");
      }
      useAppStore.getState().invalidate("tags");
    } catch {
      toast.error("Failed to delete tag");
    }
  }

  return (
    <div className="space-y-8 max-w-[800px] mx-auto py-8 px-4 lg:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight mb-1">Tags</h1>
          <p className="text-[15px] text-[var(--text-olive)]">Organize your time entries with color-coded tags.</p>
        </div>
        <Button onClick={openCreateDialog} className="rounded-full shadow-sm text-[15px] h-[40px] px-5">
          <Plus className="size-4 mr-2" />
          New Tag
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl tracking-tight text-[var(--text-forest)]">
              {editingTag ? "Edit Tag" : "New Tag"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name" className="text-[14px]">Name *</Label>
              <Input
                id="tag-name"
                placeholder="Tag name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-[var(--radius-lg)] h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[14px]">Color</Label>
              <div className="grid grid-cols-6 gap-3">
                {TAG_COLORS.map((c) => (
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
            <Button 
              className="w-full rounded-full h-[40px] text-[15px] font-medium mt-2"
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? "Saving..." : editingTag ? "Save Changes" : "Create Tag"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] px-5 py-4 animate-pulse">
              <div className="h-4 w-4 rounded-full bg-[var(--bg-muted)]" />
              <div className="h-4 w-24 rounded bg-[var(--bg-muted)]" />
              <div className="h-5 w-16 rounded bg-[var(--bg-muted)]" />
            </div>
          ))}
        </div>
      ) : (!tags || tags.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[var(--border-subtle)] border-dashed bg-[var(--bg-cream)] py-20 text-center shadow-sm">
          <div className="size-14 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-4">
            <Tags className="size-6 text-[var(--accent-olive)]" />
          </div>
          <h3 className="text-xl font-serif font-medium text-[var(--text-forest)]">No tags yet</h3>
          <p className="mt-2 text-[15px] text-[var(--text-olive)]">
            Create your first tag to categorize time entries.
          </p>
          <Button className="mt-6 rounded-full shadow-sm" onClick={openCreateDialog}>
            <Plus className="size-4 mr-2" />
            New Tag
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {(tags ?? []).map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] px-5 py-4 transition-colors hover:bg-[var(--bg-muted)]/30 group shadow-sm"
            >
              <div className="flex items-center gap-4">
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="font-semibold text-[16px] text-[var(--text-forest)]">{tag.name}</span>
                <Badge variant="outline" className="text-[12px] ml-2 font-medium bg-[var(--bg-muted)]/50 border-[var(--border-subtle)] px-2.5 py-0.5 text-[var(--text-olive)]">
                  {tag.usageCount} {tag.usageCount === 1 ? "entry" : "entries"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] rounded-[var(--radius-lg)]"
                  onClick={() => openEditDialog(tag)}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--accent-coral)]/10 hover:text-[var(--accent-coral)] rounded-[var(--radius-lg)]"
                  onClick={() => openDeleteDialog(tag)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-[var(--accent-coral)]">Delete Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-[15px] text-[var(--text-olive)] leading-relaxed">
              Are you sure you want to delete the tag <strong className="font-semibold text-[var(--text-forest)]">{deletingTag?.name}</strong>? It will be removed from all time entries.
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
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete Tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
