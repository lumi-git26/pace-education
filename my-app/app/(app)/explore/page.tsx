"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import CourseCard, { CourseCardData } from "@/components/CourseCard";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "recent" | "recommend" | "trending";

const TABS: { key: Tab; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "recommend", label: "Recommend" },
  { key: "trending", label: "Trending" },
];

const LEARNING_TOPICS = ["IELTS", "Finance", "English", "Spanish", "Data Analysis"];

export default function ExplorePage() {
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");

  const [isScrolled, setIsScrolled] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);

  // --- TYPING EFFECT ---
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [topicIndex, setTopicIndex] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullText = LEARNING_TOPICS[topicIndex];

    const handleTyping = () => {
      setText(isDeleting
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

  // Fetch real data — includes lesson content so the modal can show
  // a real "Welcome & Overview" pulled from the course's first lesson.
  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, title, description, status, created_at, profiles(full_name), units(id, title, order_index, lessons(id, title, order_index, est_minutes, content))"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setCourses([]);
        setLoading(false);
        return;
      }

      const mapped: CourseCardData[] = (data ?? []).map((row: any) => {
        const sortedUnits = (row.units ?? [])
          .slice()
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((u: any) => ({
            id: u.id,
            title: u.title,
            lessons: (u.lessons ?? [])
              .slice()
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((l: any) => ({
                id: l.id,
                title: l.title,
                content: l.content,
              })),
          }));

        const allLessons = sortedUnits.flatMap((u: any) => u.lessons ?? []);
        const totalMinutes = (row.units ?? [])
          .flatMap((u: any) => u.lessons ?? [])
          .reduce((sum: number, l: any) => sum + (l.est_minutes ?? 0), 0);

        const overviewText =
          sortedUnits[0]?.lessons?.[0]?.content?.body ?? row.description ?? "";

        return {
          id: row.id,
          title: row.title,
          description: overviewText,
          publisherName: row.profiles?.full_name ?? "Unknown",
          lessonCount: allLessons.length,
          hoursToComplete: Math.round((totalMinutes / 60) * 10) / 10,
          units: sortedUnits,
        };
      });

      setCourses(mapped);
      setLoading(false);
    }
    fetchCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll listener
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

  const visible = useMemo(() => {
    return courses.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [courses, query]);

  function renderSearchInput(size: "large" | "small") {
    return (
      <>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm khóa học..."
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
      <div
        className="fixed inset-0 -z-30 pointer-events-none bg-[#F9F9F8]"
        style={{
          backgroundImage: 'radial-gradient(#D1D1D1 1.5px, transparent 1.5px)',
          backgroundSize: '36px 36px'
        }}
      />

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none mix-blend-multiply opacity-[0.35]">
        <div className="absolute top-[10%] right-[10%] w-[50%] h-[50%] bg-[#F2994A]/30 blur-[150px] rounded-full" />
        <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[50%] bg-[#C9A6E0]/30 blur-[150px] rounded-full" />
      </div>

      <div className={`fixed top-0 left-0 w-full z-50 flex items-center justify-between px-8 pb-4 pt-6 bg-[#F9F9F8]/60 backdrop-blur-xl transition-all duration-300 ${
        isScrolled ? "border-b border-line/50 shadow-sm" : "border-b border-transparent"
      }`}>
        <div className="flex items-center gap-4 text-ink font-medium">
          <ArrowLeft size={20} className="cursor-pointer hover:text-accent transition-colors" />
          <span className="font-serif text-lg">Explore</span>
        </div>

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
                <form onSubmit={(e) => e.preventDefault()} className="relative w-full">
                  {renderSearchInput("small")}
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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
          <form onSubmit={(e) => e.preventDefault()} className="relative w-full">
            {renderSearchInput("large")}
          </form>
        </div>
      </div>

      <div className="relative z-10 pt-[88vh] px-6 w-full max-w-[1200px] mx-auto pb-32">
        <div className="flex items-center gap-10 border-b border-line/80 pb-3 mb-8">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                "relative pb-3 text-[15px] font-semibold transition-colors",
                tab === key ? "text-accent" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {label}
              {tab === key && (
                <motion.span
                  layoutId="active-tab"
                  className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-accent rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-[32px] border border-line bg-white/40" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[32px] border border-line bg-white/80 backdrop-blur-md p-14 text-center text-sm text-muted shadow-sm">
            <p className="text-xl mb-3 text-ink font-medium">Couldn&apos;t load courses</p>
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="rounded-[32px] border border-line bg-white/80 backdrop-blur-md p-14 text-center text-sm text-muted shadow-sm">
            <p className="text-xl mb-3 text-ink font-medium">No courses found 🌱</p>
            {query ? `We couldn't find anything for "${query}"` : "Check back soon for new courses."}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {visible.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}