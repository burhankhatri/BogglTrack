"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid email or password");
        setLoading(false);
        return;
      }

      router.push("/timer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto px-6">
      <div className="flex flex-col items-center mb-8">
        <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--text-forest)] flex items-center justify-center mb-4">
          <Clock className="h-5 w-5 text-[var(--text-cream)]" />
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-forest)]">
          Welcome back
        </h1>
        <p className="text-[13px] text-[var(--text-olive)] mt-1">
          Sign in to your BogglTrack account
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex h-10 w-full rounded-[var(--radius-md)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] shadow-[var(--shadow-card)] placeholder:text-[var(--text-olive)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wide">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-[var(--text-forest)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-olive)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-[var(--text-forest)] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
