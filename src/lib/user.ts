import { prisma } from "./prisma";
import { auth } from "./auth/server";

const CACHE_TTL = 30_000; // 30 seconds
const userCache = new Map<string, { user: NonNullable<Awaited<ReturnType<typeof prisma.user.findFirst>>>; timestamp: number }>();

export async function getAuthUser() {
  try {
    const { data: session } = await auth.getSession();

    if (!session?.user) {
      return null;
    }

    const authUser = session.user;
    const email = authUser.email;

    // Check in-memory cache first
    const cached = userCache.get(email);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.user;
    }

    // Find or create app user linked to the Neon Auth user
    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: authUser.name || "Freelancer",
          email,
          defaultHourlyRate: 50,
        },
      });
    }

    userCache.set(email, { user, timestamp: Date.now() });
    return user;
  } catch {
    return null;
  }
}
