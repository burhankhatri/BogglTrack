import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/sign-in",
});

export const config = {
  matcher: ["/((?!sign-in|sign-up|forgot-password|reset-password|download|api|_next|favicon|.*\\..*).*)"],
};
