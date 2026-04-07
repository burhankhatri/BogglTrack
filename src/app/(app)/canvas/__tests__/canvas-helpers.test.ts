import { describe, it, expect } from "vitest";
import {
  groupEntryDescriptions,
  buildNodes,
  buildEdges,
} from "../canvas-helpers";

describe("groupEntryDescriptions", () => {
  it("groups identical descriptions into one node with count", () => {
    const entries = [
      { id: "1", description: "joshua", projectId: "p1", duration: 100 },
      { id: "2", description: "joshua", projectId: "p1", duration: 200 },
      { id: "3", description: "joshua", projectId: null, duration: 50 },
    ];
    const grouped = groupEntryDescriptions(entries);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].description).toBe("joshua");
    expect(grouped[0].count).toBe(3);
    expect(grouped[0].entryIds).toEqual(["1", "2", "3"]);
    expect(grouped[0].totalDuration).toBe(350);
  });

  it("keeps different descriptions as separate nodes", () => {
    const entries = [
      { id: "1", description: "joshua1", projectId: null, duration: 60 },
      { id: "2", description: "joshua2", projectId: null, duration: 120 },
      { id: "3", description: "joshua3", projectId: null, duration: 180 },
    ];
    const grouped = groupEntryDescriptions(entries);
    expect(grouped).toHaveLength(3);
  });

  it("uses the projectId from the majority of entries", () => {
    const entries = [
      { id: "1", description: "work", projectId: "p1", duration: 100 },
      { id: "2", description: "work", projectId: "p1", duration: 100 },
      { id: "3", description: "work", projectId: null, duration: 100 },
    ];
    const grouped = groupEntryDescriptions(entries);
    expect(grouped[0].projectId).toBe("p1");
  });
});

describe("buildNodes", () => {
  it("creates client nodes at x=0", () => {
    const nodes = buildNodes(
      [{ id: "c1", name: "Acme" }],
      [],
      []
    );
    const clientNode = nodes.find((n) => n.id === "client-c1");
    expect(clientNode).toBeDefined();
    expect(clientNode!.position.x).toBe(0);
    expect(clientNode!.type).toBe("clientNode");
  });

  it("creates project nodes at x=400", () => {
    const nodes = buildNodes(
      [],
      [{ id: "p1", name: "Web", color: "#f00", clientId: null }],
      []
    );
    const projNode = nodes.find((n) => n.id === "project-p1");
    expect(projNode).toBeDefined();
    expect(projNode!.position.x).toBe(400);
  });

  it("creates entry nodes at x=800", () => {
    const nodes = buildNodes(
      [],
      [],
      [{ description: "work", count: 3, entryIds: ["1", "2", "3"], projectId: "p1", totalDuration: 100 }]
    );
    const entryNode = nodes.find((n) => n.id === "entry-work");
    expect(entryNode).toBeDefined();
    expect(entryNode!.position.x).toBe(800);
  });

  it("spaces nodes vertically within each column", () => {
    const nodes = buildNodes(
      [{ id: "c1", name: "A" }, { id: "c2", name: "B" }],
      [],
      []
    );
    const n1 = nodes.find((n) => n.id === "client-c1")!;
    const n2 = nodes.find((n) => n.id === "client-c2")!;
    expect(n2.position.y).toBeGreaterThan(n1.position.y);
  });
});

describe("buildEdges", () => {
  it("creates edge from project to client when clientId exists", () => {
    const edges = buildEdges(
      [{ id: "p1", name: "Web", color: "#f00", clientId: "c1" }],
      [],
      []
    );
    const edge = edges.find(
      (e) => e.source === "project-p1" && e.target === "client-c1"
    );
    expect(edge).toBeDefined();
  });

  it("creates edge from entry to project via description rule", () => {
    const edges = buildEdges(
      [],
      [{ description: "work", projectId: "p1", entryIds: ["1"], count: 1, totalDuration: 0 }],
      [{ id: "r1", description: "work", projectId: "p1" }]
    );
    const edge = edges.find(
      (e) => e.source === "entry-work" && e.target === "project-p1"
    );
    expect(edge).toBeDefined();
  });

  it("does not create entry edge when no rule exists", () => {
    const edges = buildEdges(
      [],
      [{ description: "work", projectId: null, entryIds: ["1"], count: 1, totalDuration: 0 }],
      []
    );
    expect(edges).toHaveLength(0);
  });

  it("does not create project-client edge when clientId is null", () => {
    const edges = buildEdges(
      [{ id: "p1", name: "Web", color: "#f00", clientId: null }],
      [],
      []
    );
    expect(edges).toHaveLength(0);
  });
});
