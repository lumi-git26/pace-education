"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import CourseCard, { CourseCardData } from "@/components/CourseCard";
import { motion, AnimatePresence } from "framer-motion";

// 1. Đổi "recent" thành "all", và "classrooms" có thể giữ key nhưng đổi label
type Tab = "all" | "recommend" | "trending" | "classrooms";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recommend", label: "Recommend" },
  { key: "trending", label: "Trending" },
  { key: "classrooms", label: "Classroom" },
];

const LEARNING_TOPICS = ["IELTS", "Finance", "English", "Spanish", "Data Analysis"];
const SEARCH_HISTORY_KEY = "pace_recent_searches";

type ClassroomData = {
  id: string;
  title: string;
  subject_code: string | null;
  cohort_label: string | null;
  profiles: { full_name: string } | null;
};

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecentSearch(term: string) {
  if (typeof window === "undefined" || !term.trim()) return;
  const existing = getRecentSearches().filter(
    (t) => t.toLowerCase() !== term.toLowerCase()
  );
  const updated = [term, ...existing].slice(0, 3);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
}

export default function ExplorePage() {
  const router = useRouter();

  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Mặc định hiển thị tab All
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const [isScrolled, setIsScrolled] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [topicIndex, setTopicIndex] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);

  // Hiệu ứng Typing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullText = LEARNING_TOPICS[topicIndex];

    const handleTyping = () => {
      setText(
        isDeleting
          ? fullText.substring(0, text.length - 1)
          : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 40 : 100);

      if (!isDeleting && text === fullText) {
        timer = setTimeout(() => setIsDeleting(true), 1500);
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        setTopicIndex((prev) => (prev + 1) % LEARNING_TOPICS.length);
        setTypingSpeed(500);
      } else {
        timer = setTimeout(handleTyping, typingSpeed);
      }
    };

    timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, topicIndex, typingSpeed]);

  // Data Fetching
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      // 1. Lấy dữ liệu Courses
      const { data: courseRows, error: courseErr } = await supabase
        .from("courses")
        .select("id, title, description, status, created_at, profiles(full_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false }); // Đã tự động sort mới nhất lên đầu

      if (cancelled) return;

      if (courseErr) {
        setError(courseErr.message);
        setCourses([]);
        setClassrooms([]);
        setLoading(false);
        return;
      }

      // 2. Lấy dữ liệu Classrooms
      const { data: classRows } = await supabase
        .from("classrooms")
        .select("id, title, subject_code, cohort_label, profiles(full_name)");

      // Tính toán thông tin Enrollments (Độ Hot)
      const { data: enrollmentRows } = await supabase
        .from("enrollments")
        .select("course_id");

      const countByCourse: Record<string, number> = {};
      (enrollmentRows ?? []).forEach((row: any) => {
        countByCourse[row.course_id] = (countByCourse[row.course_id] ?? 0) + 1;
      });
      const counts = Object.values(countByCourse);
      const averageEnrollment =
        counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

      // RPC Preview cho Courses
      const mappedCourses: CourseCardData[] = await Promise.all(
        (courseRows ?? []).map(async (row: any) => {
          const { data: previewRows } = await supabase.rpc("get_course_preview", {
            p_course_id: row.id,
          });

          const unitsMap = new Map<string, any>();
          (previewRows ?? []).forEach((r: any) => {
            if (!unitsMap.has(r.unit_id)) {
              unitsMap.set(r.unit_id, {
                id: r.unit_id,
                title: r.unit_title,
                lessons: [],
              });
            }
            unitsMap.get(r.unit_id).lessons.push({
              id: r.lesson_id,
              title: r.lesson_title,
            });
          });
          const sortedUnits = Array.from(unitsMap.values());
          const allLessons = sortedUnits.flatMap((u: any) => u.lessons);

          const totalMinutes = (previewRows ?? []).reduce(
            (sum: number, r: any) => sum + (r.est_minutes ?? 0),
            0
          );

          return {
            id: row.id,
            title: row.title,
            description: row.description ?? "",
            publisherName: row.profiles?.full_name ?? "Unknown",
            lessonCount: allLessons.length,
            hoursToComplete: Math.round((totalMinutes / 60) * 10) / 10,
            units: sortedUnits,
            enrolledCount: countByCourse[row.id] ?? 0,
            isHot:
              (countByCourse[row.id] ?? 0) > averageEnrollment &&
              (countByCourse[row.id] ?? 0) > 0,
          };
        })
      );

      if (!cancelled) {
        const formattedClassrooms: ClassroomData[] = (classRows ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          subject_code: c.subject_code,
          cohort_label: c.cohort_label,
          profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
        }));

        setCourses(mappedCourses);
        setClassrooms(formattedClassrooms);
        setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Xử lý thanh tìm kiếm dính (sticky)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    if (searchBarRef.current) observer.observe(searchBarRef.current);
    return () => observer.disconnect();
  }, []);

  function handleSearchSubmit() {
    pushRecentSearch(query);
  }

  // Lọc dữ liệu Khóa học (Đã cập nhật logic cho tab "all")
  const visibleCourses = useMemo(() => {
    let list = courses.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );

    if (tab === "trending") {
      list = list
        .filter((c) => c.isHot)
        .slice()
        .sort((a, b) => (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0));
    } else if (tab === "recommend") {
      const searches = getRecentSearches().map((s) => s.toLowerCase());
      if (searches.length > 0) {
        list = list
          .filter((c) => {
            const haystack = `${c.title} ${c.description ?? ""}`.toLowerCase();
            return searches.some((s) => haystack.includes(s));
          })
          .slice()
          .sort((a, b) => (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0));
      } else {
        list = list
          .slice()
          .sort((a, b) => (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0));
      }
    }
    // Nếu tab === "all", list sẽ giữ nguyên (chỉ bị lọc bởi query tìm kiếm) 
    // và mặc định đã được sort descending theo created_at từ Supabase.

    return list;
  }, [courses, query, tab]);

  // Lọc dữ liệu Lớp học
  const visibleClassrooms = useMemo(() => {
    return classrooms.filter(
      (c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        (c.subject_code && c.subject_code.toLowerCase().includes(query.toLowerCase()))
    );
  }, [classrooms, query]);

  function renderSearchInput(size: "large" | "small") {
    return (
      <>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm khóa học hoặc lớp học..."
          className={`w-full rounded-pill border border-line bg-white/60 backdrop-blur-xl text-ink outline-none placeholder:text-muted focus:border-accent shadow-sm transition-all hover:shadow-md ${
            size === "large" ? "py-4 pl-8 pr-16 text-lg" : "py-2.5 pl-5 pr-12 text-sm"
          }`}
        />
        <button
          type="submit"
          aria-label="Search"
          className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
            size === "large" ? "right-2.5 h-11 w-11" : "right-1.5 h-8 w-8"
          }`}
        >
          <Search size={size === "large" ? 20 : 16} />
        </button>
      </>
    );
  }

  return (
    <div className="relative w-full min-h-screen">
      {/* Background Decorators */}
      <div
        className="fixed inset-0 -z-30 pointer-events-none bg-[#F9F9F8]"
        style={{
          backgroundImage: "radial-gradient(#D1D1D1 1.5px, transparent 1.5px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none mix-blend-multiply opacity-[0.35]">
        <div className="absolute top-[10%] right-[10%] w-[50%] h-[50%] bg-[#F2994A]/30 blur-[150px] rounded-full" />
        <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[50%] bg-[#C9A6E0]/30 blur-[150px] rounded-full" />
      </div>

      {/* Sticky Top Nav (khi cuộn) */}
      <div
        className={`fixed top-0 left-0 w-full z-50 flex items-center justify-between px-8 pb-4 pt-6 bg-[#F9F9F8]/60 backdrop-blur-xl transition-all duration-300 ${
          isScrolled ? "border-b border-line/50 shadow-sm" : "border-b border-transparent"
        }`}
      >
        <div />
        <div className="h-10 w-80 mr-4 md:mr-10 flex items-center justify-end">
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="w-full"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchSubmit();
                  }}
                  className="relative w-full"
                >
                  {renderSearchInput("small")}
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero Section */}
      <div className="absolute top-[40vh] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4 flex flex-col items-center z-20 max-w-5xl">
        <h1 className="font-serif text-[26px] xs:text-[32px] sm:text-[40px] md:text-[54px] font-semibold text-ink flex flex-row items-center justify-center mb-8 w-full leading-tight whitespace-nowrap">
          <span>Today, I want to learn</span>
          <div className="inline-grid items-center text-accent ml-2 md:ml-3 text-left overflow-visible">
            <span className="col-start-1 row-start-1 opacity-0 pointer-events-none pr-1">
              English
            </span>
            <span className="col-start-1 row-start-1 flex items-center">
              {text}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className="inline-block w-[2px] md:w-[3px] h-[0.9em] bg-accent ml-[2px] md:ml-1 rounded-[1px]"
              />
            </span>
          </div>
        </h1>

        <div ref={searchBarRef} className="w-full max-w-[760px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit();
            }}
            className="relative w-full"
          >
            {renderSearchInput("large")}
          </form>
        </div>
      </div>

      {/* Main Content (Tabs + Grid) */}
      <div className="relative z-10 pt-[88vh] px-6 w-full max-w-[1200px] mx-auto pb-32">
        <div className="sticky top-[80px] z-40 bg-[#F9F9F8]/90 backdrop-blur-md pt-4 pb-0 mb-8 -mx-6 px-6 border-b border-line/80">
          <div className="flex items-center gap-10 pb-3">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="relative flex flex-col items-center pb-3 text-[15px] font-semibold transition-colors"
              >
                <span
                  className={
                    tab === key 
                      ? "text-accent"
                      : "text-muted hover:text-accent transition-colors"
                  }
                >
                  {label}
                </span>
                {tab === key && (
                  <motion.span
                    layoutId="active-tab"
                    className="absolute -bottom-[1px] h-[2px] w-full bg-ink rounded-t-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[80vh]"> 
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {/* === Skeleton Loading === */}
              {loading && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-56 animate-pulse rounded-[32px] border border-line bg-white/40"
                    />
                  ))}
                </div>
              )}

              {/* === Error State === */}
              {!loading && error && (
                <div className="rounded-[32px] border border-line bg-white/80 backdrop-blur-md p-14 text-center text-sm text-muted shadow-sm">
                  <p className="text-xl mb-3 text-ink font-medium">Couldn&apos;t load data</p>
                  {error}
                </div>
              )}

              {/* === Empty State (Courses) === */}
              {!loading && !error && tab !== "classrooms" && visibleCourses.length === 0 && (
                <div className="rounded-[32px] border border-line bg-white/80 backdrop-blur-md p-14 text-center text-sm text-muted shadow-sm">
                  <p className="text-xl mb-3 text-ink font-medium">
                    {tab === "all" && "No courses found 🌱"}
                    {tab === "recommend" && "Nothing to recommend yet 🌱"}
                    {tab === "trending" && "Nothing trending yet 🌱"}
                  </p>
                  {tab === "all" && "Check back later for new courses."}
                  {tab === "recommend" && "Search for a topic, and we'll recommend related courses."}
                  {tab === "trending" && "Trending courses appear once enrollment picks up."}
                </div>
              )}

              {/* === Empty State (Classrooms) === */}
              {!loading && !error && tab === "classrooms" && visibleClassrooms.length === 0 && (
                <div className="rounded-[32px] border border-line bg-white/80 backdrop-blur-md p-14 text-center text-sm text-muted shadow-sm">
                  <p className="text-xl mb-3 text-ink font-medium">No classrooms found 🌱</p>
                  Try searching for a different subject or cohort.
                </div>
              )}

              {/* === Grid View (Courses) === */}
              {!loading && !error && tab !== "classrooms" && visibleCourses.length > 0 && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
                  {visibleCourses.map((course) => (
                        <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              )}

              {/* === Grid View (Classrooms) === */}
              {!loading && !error && tab === "classrooms" && visibleClassrooms.length > 0 && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
                  {visibleClassrooms.map((c) => (
                    <div 
                      key={c.id} 
                      onClick={() => router.push(`/classrooms/${c.id}`)}
                      className="rounded-[24px] bg-white/60 border border-white/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] backdrop-blur-md p-6 hover:bg-white/90 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
                          <span className="font-serif font-bold text-lg">
                            {c.subject_code?.slice(0, 2).toUpperCase() ?? "CL"}
                          </span>
                        </div>
                        <div>
                          {c.subject_code && (
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                              {c.subject_code}
                            </p>
                          )}
                          <p className="text-[16px] font-semibold text-ink leading-tight group-hover:text-accent transition-colors">
                            {c.title}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-line/50">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center text-[10px] font-bold text-ink/70">
                            {c.profiles?.full_name?.charAt(0) ?? "I"}
                          </div>
                          <div>
                            <p className="text-[9px] text-muted uppercase tracking-wider font-bold mb-0.5">
                              Lecturer
                            </p>
                            <p className="text-[12px] font-semibold text-ink">
                              {c.profiles?.full_name ?? "Instructor"}
                            </p>
                          </div>
                        </div>
                        {c.cohort_label && (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                            {c.cohort_label}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}