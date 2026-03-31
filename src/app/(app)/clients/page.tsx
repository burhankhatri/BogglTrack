"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/stores/app-store";

interface Client {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  projectCount: number;
  totalHours: number;
  totalEarnings: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function ClientsPage() {
  const clients = useAppStore((s) => s.pageClients.data);
  const storeLoading = useAppStore((s) => s.pageClients.loading);
  const fetchPageClients = useAppStore((s) => s.fetchPageClients);
  const loading = storeLoading && !clients;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchPageClients();
  }, [fetchPageClients]);

  function openCreateDialog() {
    setEditingClient(null);
    setName("");
    setEmail("");
    setNotes("");
    setDialogOpen(true);
  }

  function openEditDialog(client: Client) {
    setEditingClient(client);
    setName(client.name);
    setEmail(client.email || "");
    setNotes(client.notes || "");
    setDialogOpen(true);
  }

  function openDeleteDialog(client: Client) {
    setDeletingClient(client);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        // Optimistic update
        const patch = { name: name.trim(), email: email.trim() || null, notes: notes.trim() || null };
        useAppStore.getState().optimisticUpdatePageClients((prev) =>
          prev.map((c) => (c.id === editingClient.id ? { ...c, ...patch } : c))
        );
        setDialogOpen(false);
        toast.success("Client updated");

        const res = await fetch(`/api/clients/${editingClient.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          fetchPageClients(true); // rollback
          throw new Error("Failed to update client");
        }
        useAppStore.getState().invalidate("clients");
      } else {
        const tempId = "temp-" + Date.now();
        const tempClient: Client = {
          id: tempId,
          name: name.trim(),
          email: email.trim() || null,
          notes: notes.trim() || null,
          projectCount: 0,
          totalHours: 0,
          totalEarnings: 0,
        };
        useAppStore.getState().optimisticUpdatePageClients((prev) => [tempClient, ...prev]);
        setDialogOpen(false);
        toast.success("Client created");

        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim() || null, notes: notes.trim() || null }),
        });
        if (!res.ok) {
          useAppStore.getState().optimisticUpdatePageClients((prev) =>
            prev.filter((c) => c.id !== tempId)
          );
          throw new Error("Failed to create client");
        }
        const real = await res.json();
        useAppStore.getState().optimisticUpdatePageClients((prev) =>
          prev.map((c) => (c.id === tempId ? { ...real } : c))
        );
        useAppStore.getState().invalidate("clients");
      }
    } catch {
      toast.error(editingClient ? "Failed to update client" : "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingClient) return;

    // Optimistic delete
    useAppStore.getState().optimisticUpdatePageClients((prev) =>
      prev.filter((c) => c.id !== deletingClient.id)
    );
    setDeleteDialogOpen(false);
    setDeletingClient(null);
    toast.success("Client deleted");

    try {
      const res = await fetch(`/api/clients/${deletingClient.id}`, { method: "DELETE" });
      if (!res.ok) {
        fetchPageClients(true); // rollback
        throw new Error("Failed to delete client");
      }
      useAppStore.getState().invalidate("clients");
    } catch {
      toast.error("Failed to delete client");
    }
  }

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto py-8 px-4 lg:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight mb-1">Clients</h1>
          <p className="text-[15px] text-[var(--text-olive)]">Manage your clients and track their projects.</p>
        </div>
        <Button onClick={openCreateDialog} className="rounded-full shadow-sm text-[15px] h-[40px] px-5">
          <Plus className="size-4 mr-2" />
          New Client
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl tracking-tight text-[var(--text-forest)]">
              {editingClient ? "Edit Client" : "New Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="client-name" className="text-[14px]">Name *</Label>
              <Input
                id="client-name"
                placeholder="Client name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-[var(--radius-lg)] h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email" className="text-[14px]">Email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[var(--radius-lg)] h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-notes" className="text-[14px]">Notes</Label>
              <Textarea
                id="client-notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-[var(--radius-lg)] min-h-[100px] resize-none"
              />
            </div>
            <Button 
              className="w-full rounded-full h-[40px] text-[15px] font-medium mt-2"
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? "Saving..." : editingClient ? "Save Changes" : "Create Client"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] overflow-hidden shadow-[var(--shadow-card)]">
          <div className="space-y-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border-subtle)] last:border-b-0 animate-pulse">
                <div className="h-4 w-32 rounded bg-[var(--bg-muted)]" />
                <div className="h-4 w-40 rounded bg-[var(--bg-muted)]" />
                <div className="flex-1" />
                <div className="h-4 w-12 rounded bg-[var(--bg-muted)]" />
                <div className="h-4 w-16 rounded bg-[var(--bg-muted)]" />
                <div className="h-4 w-20 rounded bg-[var(--bg-muted)]" />
              </div>
            ))}
          </div>
        </div>
      ) : (!clients || clients.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[var(--border-subtle)] border-dashed bg-[var(--bg-cream)] py-20 text-center shadow-sm">
          <div className="size-14 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-4">
            <Users className="size-6 text-[var(--accent-olive)]" />
          </div>
          <h3 className="text-xl font-serif font-medium text-[var(--text-forest)]">No clients yet</h3>
          <p className="mt-2 text-[15px] text-[var(--text-olive)]">
            Add your first client to start tracking projects and earnings.
          </p>
          <Button className="mt-6 rounded-full shadow-sm" onClick={openCreateDialog}>
            <Plus className="size-4 mr-2" />
            New Client
          </Button>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-cream)] overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] whitespace-nowrap">
              <thead className="bg-[var(--bg-muted)]/50 border-b border-[var(--border-subtle)] text-[var(--text-olive)] font-medium">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">Email</th>
                  <th className="px-6 py-4 font-medium text-right hidden md:table-cell">Projects</th>
                  <th className="px-6 py-4 font-medium text-right">Total Tracked</th>
                  <th className="px-6 py-4 font-medium text-right">Total Earnings</th>
                  <th className="px-6 py-4 font-medium w-[100px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {(clients ?? []).map((client) => (
                  <tr key={client.id} className="hover:bg-[var(--bg-muted)]/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-[var(--text-forest)]">{client.name}</td>
                    <td className="px-6 py-4 text-[var(--text-olive)] hidden md:table-cell">
                      {client.email || "\u2014"}
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--text-forest)] font-medium hidden md:table-cell">{client.projectCount}</td>
                    <td className="px-6 py-4 text-right text-[var(--text-forest)] font-sans">{formatDuration(client.totalHours)}</td>
                    <td className="px-6 py-4 text-right font-medium text-[var(--accent-teal)] font-sans">
                      {formatCurrency(client.totalEarnings)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-forest)] rounded-[var(--radius-lg)]"
                          onClick={() => openEditDialog(client)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-[var(--text-olive)] hover:bg-[var(--accent-coral)]/10 hover:text-[var(--accent-coral)] rounded-[var(--radius-lg)]"
                          onClick={() => openDeleteDialog(client)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-[var(--accent-coral)]">Delete Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-[15px] text-[var(--text-olive)] leading-relaxed">
              Are you sure you want to delete <strong className="font-semibold text-[var(--text-forest)]">{deletingClient?.name}</strong>? This action cannot be undone. Projects assigned to this client will be unlinked.
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
                {saving ? "Deleting..." : "Delete Client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
