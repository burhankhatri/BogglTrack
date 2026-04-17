"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Failed to create account");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
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
          Create account
        </h1>
        <p className="text-[13px] text-[var(--text-olive)] mt-1">
          Start tracking your time with BogglTrack
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wide">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="flex h-10 w-full rounded-[var(--radius-md)] bg-[var(--bg-cream)] px-3 py-2 text-sm text-[var(--text-forest)] shadow-[var(--shadow-card)] placeholder:text-[var(--text-olive)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-forest)]/20"
          />
        </div>

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
          <label htmlFor="password" className="text-[12px] font-medium text-[var(--text-olive)] uppercase tracking-wide">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-olive)]">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-[var(--text-forest)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
