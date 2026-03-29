"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TAG_COLORS = [
  "#4F46E5",
  "#2563EB",
  "#06B6D4",
  "#14B8A6",
  "#22C55E",
  "#84CC16",
  "#EAB308",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#A855F7",
  "#6B7280",
];

interface Tag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      const data = await res.json();
      setTags(data);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

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
        const res = await fetch(`/api/tags/${editingTag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color }),
        });
        if (!res.ok) throw new Error("Failed to update tag");
        toast.success("Tag updated");
      } else {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color }),
        });
        if (!res.ok) throw new Error("Failed to create tag");
        toast.success("Tag created");
      }
      setDialogOpen(false);
      fetchTags();
    } catch {
      toast.error(editingTag ? "Failed to update tag" : "Failed to create tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTag) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tags/${deletingTag.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tag");
      toast.success("Tag deleted");
      setDeleteDialogOpen(false);
      setDeletingTag(null);
      fetchTags();
    } catch {
      toast.error("Failed to delete tag");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground">Organize your time entries with color-coded tags.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreateDialog} />}>
            <Plus className="h-4 w-4" />
            New Tag
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? "Edit Tag" : "New Tag"}</DialogTitle>
              <DialogDescription>
                {editingTag ? "Update the tag name and color." : "Create a new tag to categorize your time entries."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="tag-name">Name *</Label>
                <Input
                  id="tag-name"
                  placeholder="Tag name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    >
                      {color === c && (
                        <svg
                          className="h-4 w-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingTag ? "Save Changes" : "Create Tag"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">Loading tags...</div>
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Tags className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No tags yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first tag to categorize time entries.
          </p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            New Tag
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="font-medium">{tag.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {tag.usageCount} {tag.usageCount === 1 ? "entry" : "entries"}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(tag)}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openDeleteDialog(tag)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
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
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tag <strong>{deletingTag?.name}</strong>? It will be removed from all time entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
