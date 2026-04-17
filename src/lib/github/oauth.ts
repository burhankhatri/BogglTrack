// GitHub OAuth App flow helpers.
// Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

export const GITHUB_SCOPES = ["read:user", "user:email", "repo"] as const;

export function getClientId(): string {
  const id = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  if (!id) throw new Error("GITHUB_OAUTH_CLIENT_ID is not set");
  return id;
}

function getClientSecret(): string {
  const s = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim();
  if (!s) throw new Error("GITHUB_OAUTH_CLIENT_SECRET is not set");
  return s;
}

/** Absolute URL to our own OAuth callback, computed from the current request origin. */
export function callbackUrl(origin: string): string {
  return `${origin}/api/github/callback`;
}

/** Build the GitHub authorize URL the user is sent to. */
export function authorizeUrl(params: {
  origin: string;
  state: string;
}): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("redirect_uri", callbackUrl(params.origin));
  url.searchParams.set("scope", GITHUB_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("allow_signup", "false");
  return url.toString();
}

/** Exchange the code we received at /callback for an access token. */
export async function exchangeCodeForToken(params: {
  code: string;
  origin: string;
}): Promise<{ accessToken: string; scope: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code: params.code,
      redirect_uri: callbackUrl(params.origin),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!json.access_token) {
    throw new Error(
      `GitHub returned no access_token: ${json.error_description ?? json.error ?? "unknown"}`
    );
  }
  return { accessToken: json.access_token, scope: json.scope ?? "" };
}

/** Fetch the authenticated GitHub user's profile via REST (simpler than GraphQL for this). */
export async function fetchGitHubProfile(accessToken: string): Promise<{
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub /user fetch failed: ${res.status}`);
  }
  return res.json();
}
