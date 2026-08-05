"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";
import { Search as SearchIcon, PlayCircle } from "lucide-react";

type Tab = "active" | "archived";

type CourseRow = {
  id: string;
  title: string;
  status: string;
  progress?: number;
};

export default function CoursesPage() {
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>("active");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
        const mappedData = (data ?? []).map((c) => ({
          ...c,
          progress: Math.floor(Math.random() * 80) + 10,
        }));
        setCourses(mappedData);
      }
      setLoading(false);
    }

    fetchEnrolled();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = courses.filter((c) => {
    const matchTab =
      tab === "active" ? c.status !== "archived" : c.status === "archived";
    const matchSearch = c.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen w-full">
      <div className="w-full px-8 py-16 lg:px-16">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
          <h1 className="font-serif text-[38px] font-semibold text-ink">
            Hi, {firstName}
          </h1>

          <div className="relative w-full max-w-[320px]">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your courses..."
              className="w-full rounded-pill border border-line bg-white/60 backdrop-blur-md py-3 pl-6 pr-12 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent shadow-sm transition-all"
            />
            <button className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white hover:scale-105 transition-transform cursor-pointer">
              <SearchIcon size={16} />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-10 border-b border-line/80 pb-3 mb-8">
          <button
            onClick={() => setTab("active")}
            className={[
              "relative pb-3 text-[15px] font-semibold transition-colors",
              tab === "active" ? "text-accent" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            Your courses
            {tab === "active" && (
              <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-accent rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setTab("archived")}
            className={[
              "relative pb-3 text-[15px] font-semibold transition-colors",
              tab === "archived" ? "text-accent" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            Archived
            {tab === "archived" && (
              <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-accent rounded-t-full" />
            )}
          </button>
        </div>

        {/* COURSE GRID + EMPTY/ERROR STATES */}
        <div className="pb-12">
          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-[32px] border border-line bg-white/40"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="pt-20 text-center">
              <p className="text-[15px] text-muted">
                Couldn&apos;t load your courses. ({error})
              </p>
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="pt-24 pb-12 text-center">
              <p className="font-serif text-[28px] font-medium text-ink mb-3">
                No courses yet 🌱
              </p>
              <p className="text-[15px] text-muted">
                {tab === "active"
                  ? "Time to start learning. Head to Explore to enroll in a course."
                  : "Your archived courses will appear here."}
              </p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((course) => (
                <div
                  key={course.id}
                  className="group relative flex flex-col justify-between h-56 rounded-[32px] border border-white/60 bg-white/40 backdrop-blur-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent/20 to-accent/40 flex items-center justify-center text-accent font-serif font-bold text-lg mb-4 border border-white">
                      {course.title.charAt(0)}
                    </div>
                    <h3 className="font-serif text-[20px] font-bold text-ink leading-tight group-hover:text-accent transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between items-center text-xs font-bold text-muted mb-2 uppercase tracking-wider">
                      <span>Progress</span>
                      <span className="text-accent">{course.progress}%</span>
                    </div>
                    <div className="w-full bg-line/60 rounded-full h-1.5 mb-4 overflow-hidden">
                      <div
                        className="bg-accent h-1.5 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center text-sm font-semibold text-ink group-hover:text-accent transition-colors gap-2">
                      <PlayCircle size={18} />
                      Resume learning
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}