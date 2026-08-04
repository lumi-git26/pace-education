"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";
import CourseCard, { CourseCardData } from "@/components/CourseCard";

type Tab = "recent" | "recommend" | "trending";

const TABS: { key: Tab; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "recommend", label: "Recommend" },
  { key: "trending", label: "Trending" },
];

export default function ExplorePage() {
  const { profile } = useProfile();
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchCourses() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, created_at, profiles(full_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setCourses([]);
        setLoading(false);
        return;
      }

      const mapped: CourseCardData[] = (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        publisherName: row.profiles?.full_name ?? "Unknown",
        lessonCount: 0,
        hoursToComplete: 0,
      }));

      setCourses(mapped);
      setLoading(false);
    }

    fetchCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    return courses.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [courses, query]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Hi {firstName}, ready to make progress today?
      </h1>

      <div className="relative mt-8 max-w-xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses"
          className="w-full rounded-pill border border-line bg-surface py-3.5 pl-5 pr-14 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          aria-label="Search"
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-dark"
        >
          <Search size={16} />
        </button>
      </div>

      <div className="mt-10 flex items-center gap-8 border-b border-line">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "relative pb-3 text-sm font-medium transition-colors",
              tab === key ? "text-accent" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {label}
            {tab === key && (
              <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-card border border-line bg-line/40"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-card border border-line bg-surface p-8 text-sm text-muted">
            Couldn&apos;t load courses yet ({error}). Once the{" "}
            <code className="rounded bg-ink/5 px-1.5 py-0.5">courses</code>{" "}
            table is set up in Supabase, they&apos;ll show up here.
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="rounded-card border border-line bg-surface p-8 text-sm text-muted">
            No courses found{query ? ` for "${query}"` : ""}.
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}