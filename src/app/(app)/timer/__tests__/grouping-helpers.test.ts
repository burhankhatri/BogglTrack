import { describe, it, expect } from "vitest";
import { groupEntriesByDesc, type GroupableTimeEntry } from "../grouping-helpers";

const projectA = {
  id: "proj-a",
  name: "Project A",
  color: "#2D6B5A",
  hourlyRate: 100,
  client: { id: "client-1", name: "Client One" },
};
const projectB = {
  id: "proj-b",
  name: "Project B",
  color: "#B8663F",
  hourlyRate: 120,
  client: { id: "client-2", name: "Client Two" },
};

function make(
  id: string,
  overrides: Partial<GroupableTimeEntry> = {}
): GroupableTimeEntry {
  return {
    id,
    description: "bug fix",
    startTime: "2026-04-19T09:00:00Z",
    endTime: "2026-04-19T10:00:00Z",
    duration: 3600,
    billable: true,
    projectId: projectA.id,
    project: projectA,
    tags: [],
    commits: null,
    ...overrides,
  };
}

describe("groupEntriesByDesc — strict composite merge key", () => {
  it("merges two entries with identical description + project + billable + tags", () => {
    const grouped = groupEntriesByDesc([
      make("1"),
      make("2", { startTime: "2026-04-19T11:00:00Z", endTime: "2026-04-19T12:00:00Z" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].entries).toHaveLength(2);
    expect(grouped[0].totalDuration).toBe(7200);
  });

  it("does NOT merge entries with the same description but different projects", () => {
    const grouped = groupEntriesByDesc([
      make("1", { projectId: projectA.id, project: projectA }),
      make("2", { projectId: projectB.id, project: projectB }),
    ]);

    expect(grouped).toHaveLength(2);
    const projectIds = grouped.map((g) => g.projectId).sort();
    expect(projectIds).toEqual([projectA.id, projectB.id]);
  });

  it("does NOT merge entries that differ in billable flag", () => {
    const grouped = groupEntriesByDesc([
      make("1", { billable: true }),
      make("2", { billable: false }),
    ]);

    expect(grouped).toHaveLength(2);
  });

  it("does NOT merge entries with different tag sets", () => {
    const tagDesign = { tagId: "t-design", tag: { id: "t-design", name: "design", color: "#f0f" } };
    const tagDev = { tagId: "t-dev", tag: { id: "t-dev", name: "dev", color: "#0ff" } };

    const grouped = groupEntriesByDesc([
      make("1", { tags: [tagDesign] }),
      make("2", { tags: [tagDev] }),
    ]);

    expect(grouped).toHaveLength(2);
  });

  it("merges entries with identical tags regardless of tag order", () => {
    const tagA = { tagId: "t-a", tag: { id: "t-a", name: "a", color: "#aaa" } };
    const tagB = { tagId: "t-b", tag: { id: "t-b", name: "b", color: "#bbb" } };

    const grouped = groupEntriesByDesc([
      make("1", { tags: [tagA, tagB] }),
      make("2", { tags: [tagB, tagA] }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].entries).toHaveLength(2);
  });

  it("merges two no-project entries with the same description", () => {
    const grouped = groupEntriesByDesc([
      make("1", { projectId: null, project: null }),
      make("2", { projectId: null, project: null }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].entries).toHaveLength(2);
  });

  it("does NOT merge a no-project entry with a project-A entry of the same description", () => {
    const grouped = groupEntriesByDesc([
      make("1", { projectId: null, project: null }),
      make("2", { projectId: projectA.id, project: projectA }),
    ]);

    expect(grouped).toHaveLength(2);
  });

  it("uses the earliest startTime and latest endTime in merged rows", () => {
    const grouped = groupEntriesByDesc([
      make("1", { startTime: "2026-04-19T12:00:00Z", endTime: "2026-04-19T13:00:00Z" }),
      make("2", { startTime: "2026-04-19T09:00:00Z", endTime: "2026-04-19T10:00:00Z" }),
      make("3", { startTime: "2026-04-19T15:00:00Z", endTime: "2026-04-19T16:30:00Z" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].startTime).toBe("2026-04-19T09:00:00Z");
    expect(grouped[0].endTime).toBe("2026-04-19T16:30:00Z");
  });

  it("merges empty-description entries together", () => {
    const grouped = groupEntriesByDesc([
      make("1", { description: "" }),
      make("2", { description: "" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].entries).toHaveLength(2);
  });
});
