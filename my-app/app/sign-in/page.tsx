"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

const PANEL_COPY = {
  "sign-in": {
    gradient:
      "radial-gradient(120% 100% at 20% 0%, #F2994A 0%, #E8A860 35%, #C9A6E0 70%, #6FB1D6 100%)",
    heading: "Study a little every day, remember it forever.",
    body: "Courses, lessons, and reviews — paced by what actually works for your memory.",
  },
  "sign-up": {
    gradient:
      "radial-gradient(120% 100% at 80% 100%, #6FB1D6 0%, #8FC9A9 35%, #F2994A 70%, #D68FB0 100%)",
    heading: "Your next skill starts with one small lesson.",
    body: "Pick a course, learn in short sessions, and let spaced repetition do the remembering for you.",
  },
};

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const copy = PANEL_COPY[mode];

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "sign-up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      else window.location.href = "/explore";
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen p-3 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-[1400px] overflow-hidden rounded-[28px] bg-[#EFEDE7]">
        <div className="relative hidden w-[46%] shrink-0 overflow-hidden lg:block">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              className="absolute inset-0"
              style={{ background: copy.gradient }}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </AnimatePresence>

          <div className="relative flex h-full flex-col justify-between p-12">
            <span className="font-serif text-2xl font-semibold text-white">
              pace
            </span>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <p className="max-w-xs font-serif text-3xl font-semibold leading-snug text-white">
                  {copy.heading}
                </p>
                <p className="mt-4 max-w-xs text-sm text-white/85">
                  {copy.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm overflow-hidden">
            <span className="font-serif text-2xl font-semibold text-ink lg:hidden">
              pace
            </span>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <h1 className="mt-6 font-serif text-3xl font-semibold text-ink lg:mt-0">
                  {mode === "sign-in" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-2 text-sm text-muted">
                  {mode === "sign-in"
                    ? "Sign in to pick up right where you left off."
                    : "Start learning at your own pace."}
                </p>

                <button
                  onClick={handleGoogleSignIn}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-pill border border-line bg-surface py-3.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-ink/5"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path
                      fill="#4285F4"
                      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
                    />
                    <path
                      fill="#34A853"
                      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
                    />
                    <path
                      fill="#EA4335"
                      d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div className="mt-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-xs text-muted">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
                  <AnimatePresence initial={false}>
                    {mode === "sign-up" && (
                      <motion.input
                        key="fullName"
                        type="text"
                        required
                        placeholder="Full name"
                        value={fullName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFullName(e.target.value)
                        }
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25 }}
                        className="block w-full rounded-pill border border-line bg-surface px-5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
                      />
                    )}
                  </AnimatePresence>

                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEmail(e.target.value)
                    }
                    className="w-full rounded-pill border border-line bg-surface px-5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    className="w-full rounded-pill border border-line bg-surface px-5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
                  />

                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {message && (
                    <p className="text-sm text-green-700">{message}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-pill bg-ink py-3.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loading
                      ? "Please wait…"
                      : mode === "sign-in"
                      ? "Sign in"
                      : "Sign up"}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-muted">
                  {mode === "sign-in" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        onClick={() => switchMode("sign-up")}
                        className="font-medium text-ink underline underline-offset-2"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        onClick={() => switchMode("sign-in")}
                        className="font-medium text-ink underline underline-offset-2"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}