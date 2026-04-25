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
});
