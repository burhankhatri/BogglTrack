import { createNeonAuth } from "@neondatabase/auth/next/server";

function initAuth() {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    // During build time, env vars may not be available.
    // Return a dummy that will never be called at build time.
    return null as unknown as ReturnType<typeof createNeonAuth>;
  }
  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookies: {
      secret: process.env.NEON_AUTH_COOKIE_SECRET,
    },
  });
}

export const auth = initAuth();
