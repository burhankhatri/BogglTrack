export function validateRuleBody(body: Record<string, unknown>): string | null {
  if (
    !body.description ||
    typeof body.description !== "string" ||
    body.description.trim() === ""
  ) {
    return "description is required";
  }
  if (!body.projectId || typeof body.projectId !== "string") {
    return "projectId is required";
  }
  return null;
}
