import { prisma } from "./prisma";

export async function getDefaultUser() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { name: "Freelancer", defaultHourlyRate: 50 },
    });
  }
  return user;
}
