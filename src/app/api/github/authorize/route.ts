import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeUrl } from "@/lib/github/oauth";
import { getAuthUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/github/authorize
// Starts the OAuth dance: generates a state token, stores it in a short-lived
// httpOnly cookie, and redirects the user to GitHub's authorize page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const origin = new URL(req.url).origin;
  const state = crypto.randomBytes(24).toString("base64url");

  const url = authorizeUrl({ origin, state });

  const res = NextResponse.redirect(url);
  // 10-minute state cookie — user has to complete OAuth within that window.
  res.cookies.set("gh_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
