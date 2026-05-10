import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { auth } from "./auth/server";

export class AuthSessionError extends Error {
  readonly code = "session_invalid" as const;
}
export class AuthBackendError extends Error {
  readonly code = "auth_backend_unavailable" as const;
}

const CACHE_TTL = 30_000;
const userCache = new Map<
  string,
  { user: NonNullable<Awaited<ReturnType<typeof prisma.user.findFirst>>>; timestamp: number }
>();

export async function getAuthUser() {
  let session;
  try {
    ({ data: session } = await auth.getSession());
  } catch (err) {
    console.error("[auth] getSession failed", err);
    throw new AuthSessionError(err instanceof Error ? err.message : String(err));
  }
  if (!session?.user) return null;

  const email = session.user.email;
  const cached = userCache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.user;

  try {
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name: session.user.name || "Freelancer", email },
      });
    }
    userCache.set(email, { user, timestamp: Date.now() });
    return user;
  } catch (err) {
    console.error("[auth] prisma user lookup failed", err);
    throw new AuthBackendError(err instanceof Error ? err.message : String(err));
  }
}

type AppUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;
type UserResult =
  | { user: AppUser; error: null }
  | { user: null; error: NextResponse };

export async function requireUserOrErrorResponse(): Promise<UserResult> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { user: null, error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    }
    return { user, error: null };
  } catch (err) {
    if (err instanceof AuthSessionError) {
      return {
        user: null,
        error: NextResponse.json({ error: "session_invalid" }, { status: 401 }),
      };
    }
    if (err instanceof AuthBackendError) {
      return {
        user: null,
        error: NextResponse.json({ error: "auth_backend_unavailable" }, { status: 503 }),
      };
    }
    throw err;
  }
}
