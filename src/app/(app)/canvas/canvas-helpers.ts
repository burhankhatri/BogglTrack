import type { Node, Edge } from "@xyflow/react";

// ---- Types ----

interface EntryInput {
  id: string;
  description: string;
  projectId: string | null;
  duration: number | null;
}

export interface GroupedDescription {
  description: string;
  count: number;
  entryIds: string[];
  projectId: string | null;
  totalDuration: number;
}

interface ClientInput {
  id: string;
  name: string;
}

interface ProjectInput {
  id: string;
  name: string;
  color: string;
  clientId: string | null;
}

interface RuleInput {
  id: string;
  description: string;
  projectId: string;
}

// ---- Grouping ----

export function groupEntryDescriptions(entries: EntryInput[]): GroupedDescription[] {
  const groups = new Map<string, GroupedDescription>();

  for (const entry of entries) {
    const key = entry.description;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      existing.entryIds.push(entry.id);
      existing.totalDuration += entry.duration ?? 0;
      // Use projectId from entries that have one
      if (entry.projectId && !existing.projectId) {
        existing.projectId = entry.projectId;
      }
    } else {
      groups.set(key, {
        description: entry.description,
        count: 1,
        entryIds: [entry.id],
        projectId: entry.projectId,
        totalDuration: entry.duration ?? 0,
      });
    }
  }

  return Array.from(groups.values());
}

// ---- Node Building ----

const COL_X = { client: 0, project: 400, entry: 800 };
const ROW_SPACING = 100;
const START_Y = 50;

export function buildNodes(
  clients: ClientInput[],
  projects: ProjectInput[],
  entryGroups: GroupedDescription[]
): Node[] {
  const nodes: Node[] = [];

  clients.forEach((c, i) => {
    nodes.push({
      id: `client-${c.id}`,
      type: "clientNode",
      position: { x: COL_X.client, y: START_Y + i * ROW_SPACING },
      data: { label: c.name, clientId: c.id },
    });
  });

  projects.forEach((p, i) => {
    nodes.push({
      id: `project-${p.id}`,
      type: "projectNode",
      position: { x: COL_X.project, y: START_Y + i * ROW_SPACING },
      data: {
        label: p.name,
        color: p.color,
        projectId: p.id,
        clientId: p.clientId,
      },
    });
  });

  entryGroups.forEach((g, i) => {
    nodes.push({
      id: `entry-${g.description}`,
      type: "entryNode",
      position: { x: COL_X.entry, y: START_Y + i * ROW_SPACING },
      data: {
        label: g.description || "(No description)",
        count: g.count,
        totalDuration: g.totalDuration,
        description: g.description,
        projectId: g.projectId,
        entryIds: g.entryIds,
      },
    });
  });

  return nodes;
}

// ---- Edge Building ----

export function buildEdges(
  projects: ProjectInput[],
  entryGroups: GroupedDescription[],
  rules: RuleInput[]
): Edge[] {
  const edges: Edge[] = [];

  // Project → Client edges
  for (const p of projects) {
    if (p.clientId) {
      edges.push({
        id: `edge-project-${p.id}-client-${p.clientId}`,
        source: `project-${p.id}`,
        target: `client-${p.clientId}`,
        type: "default",
        animated: true,
      });
    }
  }

  // Entry → Project edges (via description rules)
  for (const g of entryGroups) {
    const rule = rules.find((r) => r.description === g.description);
    if (rule) {
      edges.push({
        id: `edge-entry-${g.description}-project-${rule.projectId}`,
        source: `entry-${g.description}`,
        target: `project-${rule.projectId}`,
        type: "default",
        animated: true,
      });
    }
  }

  return edges;
}
