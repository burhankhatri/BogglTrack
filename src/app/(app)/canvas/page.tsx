"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Handle, Position } from "@xyflow/react";

import { formatDuration } from "@/lib/earnings";
import {
  groupEntryDescriptions,
  buildNodes,
  buildEdges,
  type GroupedDescription,
} from "./canvas-helpers";

// ---- Custom Node Components ----

function ClientNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--bg-cream)] border-2 border-[var(--accent-teal)] shadow-[var(--shadow-card)] min-w-[140px]">
      <Handle type="target" position={Position.Right} className="!bg-[var(--accent-teal)] !w-3 !h-3" />
      <div className="text-[13px] font-medium text-[var(--text-olive)] mb-1">Client</div>
      <div className="text-[15px] font-semibold text-[var(--text-forest)] font-sans">{data.label as string}</div>
    </div>
  );
}

function ProjectNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--bg-cream)] border-2 shadow-[var(--shadow-card)] min-w-[140px]" style={{ borderColor: data.color as string }}>
      <Handle type="source" position={Position.Left} id="to-client" className="!w-3 !h-3" style={{ background: data.color as string }} />
      <Handle type="target" position={Position.Right} id="from-entry" className="!w-3 !h-3" style={{ background: data.color as string }} />
      <div className="text-[13px] font-medium text-[var(--text-olive)] mb-1">Project</div>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: data.color as string }} />
        <span className="text-[15px] font-semibold text-[var(--text-forest)] font-sans">{data.label as string}</span>
      </div>
    </div>
  );
}

function EntryNode({ data }: { data: Record<string, unknown> }) {
  const count = data.count as number;
  const totalDuration = data.totalDuration as number;
  return (
    <div className="px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--bg-cream)] border-2 border-[var(--accent-olive)] shadow-[var(--shadow-card)] min-w-[160px]">
      <Handle type="source" position={Position.Left} className="!bg-[var(--accent-olive)] !w-3 !h-3" />
      <div className="text-[13px] font-medium text-[var(--text-olive)] mb-1">
        Entries{count > 1 ? ` (${count})` : ""}
      </div>
      <div className="text-[15px] font-semibold text-[var(--text-forest)] font-sans">{data.label as string}</div>
      {totalDuration > 0 && (
        <div className="text-[12px] text-[var(--text-olive)] mt-1 tabular-nums">{formatDuration(totalDuration)}</div>
      )}
    </div>
  );
}

const nodeTypes = {
  clientNode: ClientNode,
  projectNode: ProjectNode,
  entryNode: EntryNode,
};

// ---- Interfaces ----

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  clientId: string | null;
}

interface TimeEntry {
  id: string;
  description: string;
  projectId: string | null;
  duration: number | null;
  endTime: string | null;
}

interface DescriptionRule {
  id: string;
  description: string;
  projectId: string;
}

// ---- Page Component ----

export default function CanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  // Raw data refs for rebuilding
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entryGroups, setEntryGroups] = useState<GroupedDescription[]>([]);
  const [rules, setRules] = useState<DescriptionRule[]>([]);

  const rebuildGraph = useCallback(
    (c: Client[], p: Project[], eg: GroupedDescription[], r: DescriptionRule[]) => {
      setNodes(buildNodes(c, p, eg));
      setEdges(buildEdges(p, eg, r));
    },
    [setNodes, setEdges]
  );

  // Fetch all data
  useEffect(() => {
    async function load() {
      try {
        const [clientsRes, projectsRes, entriesRes, rulesRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/projects"),
          fetch("/api/time-entries?limit=200"),
          fetch("/api/description-rules"),
        ]);

        const [clientsData, projectsData, entriesData, rulesData] = await Promise.all([
          clientsRes.json(),
          projectsRes.json(),
          entriesRes.json(),
          rulesRes.json(),
        ]);

        const c: Client[] = (clientsData || []).map((cl: any) => ({
          id: cl.id,
          name: cl.name,
        }));
        const p: Project[] = (projectsData || []).map((pr: any) => ({
          id: pr.id,
          name: pr.name,
          color: pr.color,
          clientId: pr.clientId,
        }));

        // Only completed entries
        const completed = (entriesData || []).filter((e: any) => e.endTime);
        const eg = groupEntryDescriptions(completed);

        const r: DescriptionRule[] = rulesData || [];

        setClients(c);
        setProjects(p);
        setEntryGroups(eg);
        setRules(r);
        rebuildGraph(c, p, eg, r);
      } catch {
        toast.error("Failed to load canvas data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [rebuildGraph]);

  // Handle new connection (drag to link)
  const onConnect = useCallback(
    async (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      // Entry → Project connection
      if (source.startsWith("entry-") && target.startsWith("project-")) {
        const description = source.replace("entry-", "");
        const projectId = target.replace("project-", "");

        // Optimistic edge
        const newEdge: Edge = {
          id: `edge-${source}-${target}`,
          source,
          target,
          type: "default",
          animated: true,
        };
        setEdges((eds) => [...eds, newEdge]);

        try {
          const res = await fetch("/api/description-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description, projectId }),
          });
          if (!res.ok) throw new Error("Failed");
          const { rule, entriesUpdated } = await res.json();
          setRules((prev) => {
            const filtered = prev.filter((r) => r.description !== description);
            return [...filtered, rule];
          });
          toast.success(`Linked "${description}" to project (${entriesUpdated} entries updated)`);
        } catch {
          // Rollback
          setEdges((eds) => eds.filter((e) => e.id !== newEdge.id));
          toast.error("Failed to link entries to project");
        }
      }

      // Project → Client connection
      if (source.startsWith("project-") && target.startsWith("client-")) {
        const projectId = source.replace("project-", "");
        const clientId = target.replace("client-", "");

        // Optimistic edge
        const newEdge: Edge = {
          id: `edge-${source}-${target}`,
          source,
          target,
          type: "default",
          animated: true,
        };
        setEdges((eds) => [...eds, newEdge]);

        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId }),
          });
          if (!res.ok) throw new Error("Failed");
          setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? { ...p, clientId } : p))
          );
          toast.success("Project linked to client");
        } catch {
          setEdges((eds) => eds.filter((e) => e.id !== newEdge.id));
          toast.error("Failed to link project to client");
        }
      }
    },
    [setEdges]
  );

  // Handle edge deletion
  const onEdgeDoubleClick = useCallback(
    async (_event: React.MouseEvent, edge: Edge) => {
      // Entry → Project: delete the description rule
      if (edge.source.startsWith("entry-") && edge.target.startsWith("project-")) {
        const description = edge.source.replace("entry-", "");
        const rule = rules.find((r) => r.description === description);
        if (!rule) return;

        // Optimistic remove
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));

        try {
          const res = await fetch(`/api/description-rules/${rule.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed");
          setRules((prev) => prev.filter((r) => r.id !== rule.id));
          toast.success(`Unlinked "${description}" from project`);
        } catch {
          setEdges((eds) => [...eds, edge]);
          toast.error("Failed to unlink");
        }
      }

      // Project → Client: set clientId to null
      if (edge.source.startsWith("project-") && edge.target.startsWith("client-")) {
        const projectId = edge.source.replace("project-", "");

        setEdges((eds) => eds.filter((e) => e.id !== edge.id));

        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: null }),
          });
          if (!res.ok) throw new Error("Failed");
          setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? { ...p, clientId: null } : p))
          );
          toast.success("Project unlinked from client");
        } catch {
          setEdges((eds) => [...eds, edge]);
          toast.error("Failed to unlink");
        }
      }
    },
    [rules, setEdges]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)] text-[var(--text-olive)]">
        Loading canvas...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] w-full">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <h1 className="font-serif text-[28px] font-semibold text-[var(--text-forest)]">Canvas</h1>
        <p className="text-[13px] text-[var(--text-olive)]">
          Drag between nodes to link. Double-click edges to unlink.
        </p>
      </div>
      <div className="h-[calc(100%-60px)] rounded-[var(--radius-xl)] border border-[var(--border-subtle)] mx-4 md:mx-6 overflow-hidden bg-[var(--bg-cream)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            type: "default",
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border-subtle)" gap={20} />
          <Controls
            className="!bg-[var(--bg-cream)] !border-[var(--border-subtle)] !shadow-[var(--shadow-card)] !rounded-[var(--radius-lg)]"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
