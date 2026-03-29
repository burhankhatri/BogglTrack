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

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto px-6">
      <div className="flex flex-col items-center mb-8">
        <div className="h-12 w-12 rounded-full bg-[var(--accent-olive)] flex items-center justify-center mb-4">
          <Clock className="h-6 w-6 text-[var(--text-forest)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-forest)]">
          Welcome back
        </h1>
        <p className="text-sm text-[var(--text-olive)] mt-1">
          Sign in to your BogglTrack account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-[var(--text-forest)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex h-10 w-full rounded-lg border border-[var(--border-medium)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] placeholder:text-[var(--text-olive)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-olive)]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-[var(--text-forest)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="flex h-10 w-full rounded-lg border border-[var(--border-medium)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] placeholder:text-[var(--text-olive)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-olive)]"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--accent-coral)] bg-[var(--accent-coral)]/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--accent-olive)] px-4 text-sm font-medium text-[var(--text-forest)] hover:bg-[var(--accent-olive-hover)] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-olive)]">
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
