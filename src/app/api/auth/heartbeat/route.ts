import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

// Session keep-alive. Calling getSession() inside the refresh window lets
// Neon Auth / better-auth roll the session forward, so an active user never
// logs out while the app is open. Returns 401 when the session is missing or
// invalid — the client uses that signal to prompt re-sign-in without losing
// the running timer (which is persisted in localStorage).
export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.json({
      ok: true,
      expiresAt: session.session.expiresAt,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
