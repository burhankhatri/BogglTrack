import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchGitHubProfile } from "@/lib/github/oauth";
import { encryptToken } from "@/lib/github/crypto";
import { getAuthUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/github/callback?code=...&state=...
// GitHub sends the user here after they approve the OAuth app.
// Verifies state, swaps code for a token, upserts the GitHubAccount row,
// then redirects back to /settings with a status flag for the UI.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const redirectWith = (flag: string) =>
    NextResponse.redirect(new URL(`/settings?github=${flag}`, req.url));

  if (error) {
    // User denied, or GitHub returned an error — bail cleanly.
    return redirectWith(`error-${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return redirectWith("error-missing-code");
  }

  const storedState = req.cookies.get("gh_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    // CSRF check failed — the state cookie must match what we sent to GitHub.
    return redirectWith("error-state-mismatch");
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  try {
    const { accessToken, scope } = await exchangeCodeForToken({
      code,
      origin: url.origin,
    });
    const profile = await fetchGitHubProfile(accessToken);

    await prisma.gitHubAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        githubUserId: String(profile.id),
        githubLogin: profile.login,
        githubName: profile.name,
        githubAvatarUrl: profile.avatar_url,
        accessToken: encryptToken(accessToken),
        scope,
      },
      update: {
        githubUserId: String(profile.id),
        githubLogin: profile.login,
        githubName: profile.name,
        githubAvatarUrl: profile.avatar_url,
        accessToken: encryptToken(accessToken),
        scope,
      },
    });

    const res = redirectWith("connected");
    res.cookies.delete("gh_oauth_state");
    return res;
  } catch (e) {
    console.error("[github/callback]", e);
    return redirectWith("error-exchange");
  }
}
