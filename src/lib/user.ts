import { prisma } from "./prisma";
import { auth } from "./auth/server";

export async function getAuthUser() {
  try {
    const { data: session } = await auth.getSession();

    if (!session?.user) {
      return null;
    }

    const authUser = session.user;

    // Find or create app user linked to the Neon Auth user
    let user = await prisma.user.findFirst({
      where: { email: authUser.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: authUser.name || "Freelancer",
          email: authUser.email,
          defaultHourlyRate: 50,
        },
      });
    }

    return user;
  } catch {
    return null;
  }
}
