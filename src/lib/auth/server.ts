import { createNeonAuth } from "@neondatabase/auth/next/server";

function initAuth() {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
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
