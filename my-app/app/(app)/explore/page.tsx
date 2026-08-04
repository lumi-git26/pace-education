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

// Dữ liệu giả (Mock Data) để cậu test giao diện thẻ khóa học khi DB trống
const MOCK_COURSES: CourseCardData[] = [
  { id: 'mock-1', title: 'IELTS Mastery: Band 8.0+', publisherName: 'Kira', lessonCount: 24, hoursToComplete: 40 },
  { id: 'mock-2', title: 'Corporate Finance 101', publisherName: 'Pace Education', lessonCount: 12, hoursToComplete: 15 },
  { id: 'mock-3', title: 'Data Analysis with Python', publisherName: 'Kira', lessonCount: 18, hoursToComplete: 25 },
];

export default function ExplorePage() {
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [topicIndex, setTopicIndex] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Hiệu ứng đổi từ khóa
  useEffect(() => {
    const interval = setInterval(() => {
      setTopicIndex((prev) => (prev + 1) % LEARNING_TOPICS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Data + Mock Data Fallback
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
        setCourses(MOCK_COURSES); // Nếu lỗi DB, hiện Mock Data để test UI
        setLoading(false);
        return;
      }

      // Nếu có data thật thì dùng, không thì tự động fallback về Mock Data
      if (data && data.length > 0) {
        const mapped: CourseCardData[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          publisherName: row.profiles?.full_name ?? "Unknown",
          lessonCount: Math.floor(Math.random() * 20) + 10,
          hoursToComplete: Math.floor(Math.random() * 40) + 20,
        }));
        setCourses(mapped);
      } else {
        setCourses(MOCK_COURSES);
      }
      
      setLoading(false);
    }

    fetchCourses();
    return () => { cancelled = true; };
  }, []);

  // Theo dõi cuộn trang
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  const visible = useMemo(() => {
    return courses.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [courses, query]);

  const SearchBar = ({ className, size = "large" }: { className?: string, size?: "large" | "small" }) => (
    <motion.div layoutId="search-bar" className={`relative w-full ${className}`} initial={false}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm kiếm khóa học..."
        className={`w-full rounded-pill border border-line bg-surface/80 backdrop-blur-md text-ink outline-none placeholder:text-muted focus:border-accent shadow-sm transition-all hover:shadow-md ${
          size === "large" ? "py-4 pl-6 pr-16 text-lg" : "py-2.5 pl-4 pr-12 text-sm"
        }`}
      />
      <button
        aria-label="Search"
        className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
          size === "large" ? "right-2 h-11 w-11" : "right-1.5 h-8 w-8"
        }`}
      >
        <Search size={size === "large" ? 20 : 16} />
      </button>
    </motion.div>
  );

  return (
    <div className="relative w-full">
      {/* 1. Hình ảnh trang trí Gradient nền phía sau (Fixed full màn hình) */}
      <div className="fixed inset-0 -z-10 bg-[#EFEDE7] overflow-hidden">
        {/* Vệt cam góc trên */}
        <div className="absolute top-[-10%] right-[10%] w-[50%] h-[50%] rounded-full bg-[#F2994A]/20 blur-[120px]" />
        {/* Vệt tím góc trái */}
        <div className="absolute top-[20%] left-[-10%] w-[40%] h-[60%] rounded-full bg-[#C9A6E0]/20 blur-[120px]" />
        {/* Vệt xanh lơ góc dưới */}
        <div className="absolute bottom-[-10%] left-[30%] w-[60%] h-[50%] rounded-full bg-[#6FB1D6]/20 blur-[120px]" />
      </div>

      {/* 2. Sentinel để bắt sự kiện cuộn (đặt cách top 20vh) */}
      <div ref={sentinelRef} className="absolute top-[20vh] h-10 w-full pointer-events-none" />

      {/* 3. Sticky Header (Chỉ hiện khi cuộn) */}
      <div className={`sticky top-0 z-50 flex items-center justify-between px-6 pb-4 pt-4 bg-[#EFEDE7]/60 backdrop-blur-xl transition-all duration-300 ${
        isScrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      }`}>
        <div className="flex items-center gap-3 text-ink font-medium">
          <ArrowLeft size={20} className="cursor-pointer hover:text-accent transition-colors" />
          <span className="font-serif text-lg">Explore</span>
        </div>
        <div className="w-72">
          {isScrolled && <SearchBar size="small" />}
        </div>
      </div>

      {/* 4. Main Section (Chiếm 85% chiều cao màn hình để thẻ khóa học lấp ló bên dưới) */}
      <div className="flex flex-col min-h-[85vh] px-6">
        
        {/* Khối Hero căn giữa tuyệt đối cả dọc lẫn ngang */}
        <motion.div 
          className="flex-1 flex flex-col md:flex-row items-center justify-center gap-10"
          animate={{ opacity: isScrolled ? 0 : 1, scale: isScrolled ? 0.95 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Avatar phác thảo tối giản */}
          <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 flex items-center justify-center">
            <motion.img 
              src="https://api.dicebear.com/9.x/notionists/svg?seed=Kira&backgroundColor=transparent&scale=120" 
              alt="Study Character"
              className="w-full h-full object-contain"
              animate={{ y: [0, -8, 0] }} 
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            />
          </div>

          {/* Text & Search Bar */}
          <div className="flex-1 w-full max-w-2xl text-left">
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink tracking-tight mb-8 flex flex-wrap items-center gap-x-3">
              <span>Today, I want to learn</span>
              <div className="inline-block relative h-[50px] min-w-[280px] overflow-hidden align-bottom">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={topicIndex}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "circOut" }}
                    className="absolute left-0 text-accent font-bold whitespace-nowrap"
                  >
                    {LEARNING_TOPICS[topicIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </h1>

            <div className="w-full">
              {!isScrolled && <SearchBar size="large" />}
            </div>
          </div>
        </motion.div>

        {/* Tabs - Nằm sát mép dưới của khung 85vh */}
        <div className="flex items-center gap-10 border-b border-line/80 mt-auto pb-2">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                "relative pb-3 text-sm font-semibold transition-colors",
                tab === key ? "text-accent" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {label}
              {tab === key && (
                <motion.span 
                  layoutId="active-tab"
                  className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent rounded-t-full" 
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Course Section (Phần này sẽ nhô lên một xíu ở mép dưới màn hình) */}
      <div className="px-6 mt-8 pb-32">
        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-[24px] border border-line bg-surface/50" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="rounded-[24px] border border-line bg-surface/50 backdrop-blur-md p-12 text-center text-sm text-muted">
            <p className="text-lg mb-2">No courses found 🌱</p>
            {query ? `We couldn't find anything for "${query}"` : "Try adjusting your search."}
          </div>
        )}

        {!loading && visible.length > 0 && (
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