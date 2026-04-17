import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const authMiddleware = auth.middleware({
  loginUrl: "/sign-in",
});

// Public routes — never gated by auth.
const PUBLIC_ROUTES = new Set<string>(["/"]);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect legacy /download → / so any existing links keep working.
  if (pathname === "/download") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Root landing page is public — no auth check.
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Everything else flows through Neon Auth's middleware (redirects to
  // /sign-in when the session cookie is missing or expired).
  return authMiddleware(req);
}

export const config = {
  // Keep excluding auth/sign-in routes and Next internals so we never wrap them.
  matcher: [
    "/((?!sign-in|sign-up|forgot-password|reset-password|api|_next|favicon|.*\\..*).*)",
  ],
};
