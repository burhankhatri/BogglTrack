import { describe, it, expect } from "vitest";
import { validateRuleBody } from "../helpers";

describe("validateRuleBody", () => {
  it("returns null for valid body", () => {
    expect(validateRuleBody({ description: "joshua", projectId: "proj-1" })).toBeNull();
  });

  it("returns error for missing description", () => {
    expect(validateRuleBody({ projectId: "proj-1" })).toBe("description is required");
  });

  it("returns error for missing projectId", () => {
    expect(validateRuleBody({ description: "test" })).toBe("projectId is required");
  });

  it("returns error for empty description", () => {
    expect(validateRuleBody({ description: "", projectId: "p" })).toBe("description is required");
  });

  it("returns error for whitespace-only description", () => {
    expect(validateRuleBody({ description: "   ", projectId: "p" })).toBe("description is required");
  });
});
