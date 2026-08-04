"use client";

import { useProfile } from "@/lib/supabase/useProfile";

export default function PersonalPage() {
  const { profile } = useProfile();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Welcome, {firstName}
      </h1>
      <p className="mt-8 text-sm text-muted">
        Personal dashboard coming next.
      </p>
    </div>
  );
}