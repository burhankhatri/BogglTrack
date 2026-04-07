interface Rule {
  description: string;
  projectId: string;
}

export function shouldAutoLink(
  description: string,
  rules: Rule[]
): string | null {
  if (!description) return null;
  const match = rules.find((r) => r.description === description);
  return match?.projectId ?? null;
}
