import { describe, it, expect } from "vitest";
import { shouldAutoLink } from "@/lib/auto-link";

describe("shouldAutoLink", () => {
  it("returns projectId when rule matches", () => {
    const rules = [{ description: "joshua", projectId: "proj-1" }];
    expect(shouldAutoLink("joshua", rules)).toBe("proj-1");
  });

  it("returns null when no rule matches", () => {
    const rules = [{ description: "other", projectId: "proj-1" }];
    expect(shouldAutoLink("joshua", rules)).toBeNull();
  });

  it("returns null when description is empty", () => {
    expect(shouldAutoLink("", [])).toBeNull();
  });

  it("returns null when rules array is empty", () => {
    expect(shouldAutoLink("joshua", [])).toBeNull();
  });
});
