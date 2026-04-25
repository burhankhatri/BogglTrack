import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntryCommits } from "../entry-commits";

const commit = {
  sha: "abc123456789",
  message: "Add commit removal",
  repo: "owner/repo",
  url: "https://github.com/owner/repo/commit/abc123456789",
  committedAt: "2026-04-25T12:00:00.000Z",
};

function makeCommit(index: number) {
  return {
    sha: `commit-${index}`,
    message: `Commit message ${index}`,
    repo: "owner/repo",
    url: `https://github.com/owner/repo/commit/${index}`,
    committedAt: `2026-04-25T12:0${index}:00.000Z`,
  };
}

describe("EntryCommits", () => {
  it("calls onRemoveCommit with entry ids and sha when remove is clicked", () => {
    const onRemoveCommit = vi.fn();

    render(
      <EntryCommits
        entries={[{ id: "entry-1", commits: [commit] }]}
        onRemoveCommit={onRemoveCommit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /remove commit/i }));

    expect(onRemoveCommit).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      sha: "abc123456789",
    });
  });

  it("expands hidden commits when the more chip is clicked", () => {
    render(
      <EntryCommits
        entries={[
          {
            id: "entry-1",
            commits: [1, 2, 3, 4, 5].map(makeCommit),
          },
        ]}
        maxInline={2}
      />
    );

    expect(screen.queryByText("Commit message 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show 3 more commits/i }));

    expect(screen.getByText("Commit message 1")).toBeVisible();
    expect(screen.getByText("Commit message 2")).toBeVisible();
  });
});
