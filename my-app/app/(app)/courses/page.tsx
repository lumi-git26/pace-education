"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";
import { Search as SearchIcon, PlayCircle, Users } from "lucide-react";

type Tab = "active" | "archived" | "classes";

type CourseRow = { id: string; title: string; status: string; progress?: number };
type ClassRow = { id: string; title: string; subjectCode: string | null };

export default function CoursesPage() {
  const { profile } = useProfile();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setCourses([]);
          setClasses([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("enrollments")
        .select("status, progress_pct, courses(id, title, status)")
        .eq("learner_id", user.id)
        .order("enrolled_at", { ascending: false });

      const { data: classData } = await supabase
        .from("classroom_members")
        .select("classrooms(id, title, subject_code)")
        .eq("learner_id", user.id)
        .eq("status", "active");

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setCourses([]);
      } else {
        const mapped: CourseRow[] = (data ?? [])
          .filter((row: any) => row.courses)
          .map((row: any) => ({
            id: row.courses.id,
            title: row.courses.title,
            status: row.status,
            progress: Math.round(row.progress_pct ?? 0),
          }));
        setCourses(mapped);
      }

      setClasses(
        (classData ?? [])
          .filter((row: any) => row.classrooms)
          .map((row: any) => ({
            id: row.classrooms.id,
            title: row.classrooms.title,
            subjectCode: row.classrooms.subject_code,
          }))
      );

      setLoading(false);
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCourses = courses.filter((c) => {
    const matchTab = tab === "active" ? c.status !== "archived" : c.status === "archived";
    return matchTab && c.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const visibleClasses = classes.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen w-full">
      <div className="w-full px-8 py-16 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
          <h1 className="font-serif text-[38px] font-semibold text-ink">
            Hi, {firstName}
          </h1>

          <div className="relative w-full max-w-[320px]">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-pill border border-line bg-white/60 backdrop-blur-md py-3 pl-6 pr-12 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent shadow-sm transition-all"
            />
            <button className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white hover:scale-105 transition-transform cursor-pointer">
              <SearchIcon size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-10 border-b border-line/80 pb-3 mb-8">
          {[
            { key: "active", label: "Your courses" },
            { key: "classes", label: "Your Class" },
            { key: "archived", label: "Archived" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={[
                "relative pb-3 text-[15px] font-semibold transition-colors",
                tab === key ? "text-accent" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {label}
              {tab === key && (
                <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-accent rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="pb-12">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[260px] animate-pulse rounded-[32px] border border-line bg-white/40" />
              ))}
            </div>
          ) : tab === "classes" ? (
            visibleClasses.length === 0 ? (
              <div className="pt-24 pb-12 text-center">
                <Users size={28} className="mx-auto mb-4 text-muted" />
                <p className="font-serif text-[28px] font-medium text-ink mb-3">
                  No classes yet 🌱
                </p>
                <p className="text-[15px] text-muted">
                  Head to Explore to find a live class to join.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleClasses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/classroom/${c.id}`)}
                    className="h-[260px] rounded-[32px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {c.subjectCode && (
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 block">
                          {c.subjectCode}
                        </span>
                      )}
                      <h3 
                        className="font-serif text-[20px] font-bold text-ink mt-1 line-clamp-2"
                        title={c.title}
                      >
                        {c.title}
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-indigo-600 shrink-0 mt-4">
                      Live Classroom
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : visibleCourses.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => router.push(`/courses/${course.id}`)}
                  className="group relative flex flex-col justify-between h-[260px] rounded-[32px] border border-white/60 bg-white/40 backdrop-blur-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent/20 to-accent/40 flex items-center justify-center text-accent font-serif font-bold text-lg mb-4 border border-white shrink-0">
                      {course.title.charAt(0)}
                    </div>
                    <h3 
                      className="font-serif text-[20px] font-bold text-ink leading-tight group-hover:text-accent transition-colors line-clamp-2"
                      title={course.title}
                    >
                      {course.title}
                    </h3>
                  </div>
                  <div className="mt-4 shrink-0">
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