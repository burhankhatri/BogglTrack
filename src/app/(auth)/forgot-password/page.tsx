"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Neon Auth (Better Auth) sends a reset email. The `redirectTo` URL is
      // where the user lands *after* clicking the link — the token is appended
      // as a `?token=` query param by the auth service.
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "/reset-password";

      const { error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });

      if (authError) {
        setError(authError.message || "Could not send reset email");
        setLoading(false);
        return;
      }

      // Always confirm-by-default — avoids leaking whether an email is registered.
      setSent(true);
      setLoading(false);
    } catch (err) {
      // Don't leak — show the generic confirmation for network errors too, but
      // surface a real error if something structural broke.
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center mb-6">
          <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--accent-olive-soft)] flex items-center justify-center mb-4">
            <CheckCircle2 className="h-5 w-5 text-[var(--accent-olive-hover)]" />
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-forest)] text-center">
            Check your email
          </h1>
          <p className="text-[13px] text-[var(--text-olive)] mt-2 text-center">
            If an account exists for <span className="font-medium text-[var(--text-forest)]">{email}</span>,
            we&apos;ve sent a link to reset your password. The link expires in 1 hour.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-muted)] px-4 text-sm font-medium text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)] transition-colors"
          >
            Use a different email
          </button>
          <Link
            href="/sign-in"
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-4 text-[13px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
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
          Forgot password?
        </h1>
        <p className="text-[13px] text-[var(--text-olive)] mt-1 text-center">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wide">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex h-10 w-full rounded-[var(--radius-md)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] shadow-[var(--shadow-card)] placeholder:text-[var(--text-olive)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20"
          />
        </div>

        {error && (
          <p className="text-[13px] text-[var(--accent-coral)] bg-[var(--accent-coral)]/8 rounded-[var(--radius-md)] px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--text-forest)] px-4 text-sm font-medium text-[var(--text-cream)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
        </button>
      </form>

      <Link
        href="/sign-in"
        className="mt-6 inline-flex items-center justify-center gap-1.5 w-full text-[13px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}
