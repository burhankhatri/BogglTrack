"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth/client";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Neon Auth (Better Auth) appends `?token=...` when the user clicks the
  // reset-email link. `?error=...` is used to signal invalid/expired tokens.
  const token = searchParams.get("token");
  const urlError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>(urlError ? decodeURIComponent(urlError) : "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token && !urlError) {
      setError("This reset link is invalid. Request a new one from the sign-in page.");
    }
  }, [token, urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Request a new reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (authError) {
        setError(authError.message || "Reset link expired or invalid. Request a new one.");
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
      // Send back to sign-in after a short beat so the user sees the success state.
      setTimeout(() => router.push("/sign-in"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm mx-auto px-6 text-center">
        <div className="mx-auto h-10 w-10 rounded-[var(--radius-md)] bg-[var(--accent-olive-soft)] flex items-center justify-center mb-4">
          <CheckCircle2 className="h-5 w-5 text-[var(--accent-olive-hover)]" />
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-forest)]">
          Password updated
        </h1>
        <p className="text-[13px] text-[var(--text-olive)] mt-2">
          Redirecting you to sign in…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto px-6">
      <div className="flex flex-col items-center mb-8">
        <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--text-forest)] flex items-center justify-center mb-4">
          <Clock className="h-5 w-5 text-[var(--text-cream)]" />
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-forest)]">
          Set a new password
        </h1>
        <p className="text-[13px] text-[var(--text-olive)] mt-1 text-center">
          Choose a password you haven&apos;t used before.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wide">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            disabled={!token}
            className="flex h-10 w-full rounded-[var(--radius-md)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] shadow-[var(--shadow-card)] placeholder:text-[var(--text-olive)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wide">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            disabled={!token}
            className="flex h-10 w-full rounded-[var(--radius-md)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] shadow-[var(--shadow-card)] placeholder:text-[var(--text-olive)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20 disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[13px] text-[var(--accent-coral)] bg-[var(--accent-coral)]/8 rounded-[var(--radius-md)] px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !token}
          className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--text-forest)] px-4 text-sm font-medium text-[var(--text-cream)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-olive)]">
        <Link href="/forgot-password" className="font-medium text-[var(--text-forest)] hover:underline">
          Request a new link
        </Link>
        {" · "}
        <Link href="/sign-in" className="font-medium text-[var(--text-forest)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in App Router.
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm mx-auto px-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-[var(--text-olive)]" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
