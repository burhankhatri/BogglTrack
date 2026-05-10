import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    out.db = "ok";
  } catch (err) {
    out.db = "down";
    out.dbError = err instanceof Error ? err.message : String(err);
  }

  try {
    await auth.getSession();
    out.auth = "ok";
  } catch (err) {
    out.auth = "error";
    out.authError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(out);
}
