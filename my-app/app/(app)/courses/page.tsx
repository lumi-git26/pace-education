"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";

type Tab = "active" | "archived";

type CourseRow = {
  id: string;
  title: string;
  status: string;
};

export default function CoursesPage() {
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>("active");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEnrolled() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setCourses([]);
      } else {
        setCourses(data ?? []);
      }
      setLoading(false);
    }

    fetchEnrolled();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = courses.filter((c) =>
    tab === "active" ? c.status !== "archived" : c.status === "archived"
  );

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Hi, {firstName}
      </h1>

      <div className="mt-6 flex items-center gap-8 border-b border-line">
        <button
          onClick={() => setTab("active")}
          className={[
            "relative pb-3 text-sm font-medium transition-colors",
            tab === "active" ? "text-accent" : "text-muted hover:text-ink",
          ].join(" ")}
        >
          Your courses
          {tab === "active" && (
            <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent" />
          )}
        </button>
        <button
          onClick={() => setTab("archived")}
          className={[
            "relative pb-3 text-sm font-medium transition-colors",
            tab === "archived" ? "text-accent" : "text-muted hover:text-ink",
          ].join(" ")}
        >
          Archived
          {tab === "archived" && (
            <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent" />
          )}
        </button>
      </div>

      <div className="mt-8">
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-card border border-line bg-line/40"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-card border border-line bg-surface p-8 text-sm text-muted">
            Couldn&apos;t load your courses yet ({error}).
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="rounded-card border border-line bg-surface p-8 text-sm text-muted">
            {tab === "active"
              ? "You haven't enrolled in any courses yet. Head to Explore to find one."
              : "No archived courses."}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((course) => (
              <div
                key={course.id}
                className="h-40 rounded-card border border-line bg-surface p-6"
              >
                <p className="font-serif text-lg font-semibold text-ink">
                  {course.title}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}