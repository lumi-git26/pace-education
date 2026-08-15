"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { BookOpen } from "lucide-react";

export default function CreatorCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("courses")
        .select("id, title, status")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setCourses(data ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-ink mb-10">
        Your Courses
      </h1>

      {loading ? (
        <div className="h-40 animate-pulse rounded-[24px] bg-line/40" />
      ) : courses.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line/60 bg-white/40 p-14 text-center">
          <BookOpen size={28} className="mx-auto mb-4 text-muted" />
          <p className="font-serif text-xl font-semibold text-ink mb-2">
            No courses yet
          </p>
          <p className="text-sm text-muted">
            Course authoring UI is coming — for now courses are seeded via
            SQL.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c) => (
            <div
              key={c.id}
              className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6"
            >
              <span
                className={[
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full",
                  c.status === "published"
                    ? "bg-green-100 text-green-700"
                    : "bg-line/40 text-muted",
                ].join(" ")}
              >
                {c.status}
              </span>
              <h3 className="font-serif text-lg font-bold text-ink mt-3">
                {c.title}
              </h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}