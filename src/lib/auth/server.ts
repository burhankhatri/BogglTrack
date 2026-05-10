import { createNeonAuth } from "@neondatabase/auth/next/server";

function initAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return null as unknown as ReturnType<typeof createNeonAuth>;
    }
    throw new Error(
      "Neon Auth env vars missing. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET in the runtime environment."
    );
  }
  return createNeonAuth({ baseUrl, cookies: { secret } });
}

export const auth = initAuth();
