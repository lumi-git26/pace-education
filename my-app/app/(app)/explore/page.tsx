"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Search, ArrowLeft, Pencil, Ruler, BookOpen, NotebookPen } from "lucide-react";
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

// Dữ liệu Mock Data để cậu test giao diện
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

  // Hiệu ứng đổi từ khóa Morphing
  useEffect(() => {
    const interval = setInterval(() => {
      setTopicIndex((prev) => (prev + 1) % LEARNING_TOPICS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, created_at, profiles(full_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      
      if (error || !data || data.length === 0) {
        setCourses(MOCK_COURSES);
      } else {
        const mapped: CourseCardData[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          publisherName: row.profiles?.full_name ?? "Unknown",
          lessonCount: Math.floor(Math.random() * 20) + 10,
          hoursToComplete: Math.floor(Math.random() * 40) + 20,
        }));
        setCourses(mapped);
      }
      setLoading(false);
    }
    fetchCourses();
    return () => { cancelled = true; };
  }, []);

  // Bắt sự kiện cuộn để thu nhỏ Header
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

  // Thanh Search dùng chung (Tự Morph khi cuộn)
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
    <div className="relative w-full min-h-screen">
      
      {/* 1. LAYER BACKGROUND - Dotted Notebook, Decor & Gradient */}
      <div className="fixed inset-0 -z-30 bg-[#EFEDE7]"
           style={{ backgroundImage: "radial-gradient(#c8c8c8 1.5px, transparent 1.5px)", backgroundSize: "32px 32px" }} 
      />
      
      {/* Các hình vẽ Study Decors (Notionish style) */}
      <div className="fixed inset-0 -z-20 pointer-events-none opacity-[0.15]">
        <Pencil className="absolute top-[20%] right-[15%] text-ink rotate-45 w-14 h-14" strokeWidth={1} />
        <Ruler className="absolute bottom-[40%] left-[10%] text-ink -rotate-12 w-20 h-20" strokeWidth={1} />
        <BookOpen className="absolute top-[15%] left-[20%] text-ink rotate-12 w-12 h-12" strokeWidth={1} />
        <NotebookPen className="absolute bottom-[30%] right-[12%] text-ink -rotate-[20deg] w-16 h-16" strokeWidth={1} />
      </div>

      {/* Gradient mờ đè lên để tạo ánh sáng không gian */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none mix-blend-multiply opacity-60">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#F2994A]/20 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[70%] bg-[#C9A6E0]/20 blur-[150px] rounded-full" />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-[#6FB1D6]/20 blur-[150px] rounded-full" />
      </div>

      {/* Điểm kích hoạt Morphing (Cắm ở 20% chiều cao màn hình) */}
      <div ref={sentinelRef} className="absolute top-[20vh] h-10 w-full pointer-events-none" />

      {/* 2. STICKY HEADER (Trong suốt hơn, blur mượt hơn) */}
      <div className={`sticky top-0 z-50 flex items-center justify-between px-6 pb-4 pt-4 bg-[#EFEDE7]/30 backdrop-blur-2xl transition-all duration-300 ${
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

      {/* 3. CENTER HERO SECTION (Sử dụng kỹ thuật pt-[50vh] để ép thanh Search luôn ở Center) */}
      <div className="flex flex-col w-full px-6 pt-[50vh]">
        
        {/* Khối Search + Message được kéo ngược lên đúng 28px (nửa chiều cao search bar) để nó nằm chính xác giữa màn hình */}
        <div className="relative w-full max-w-[800px] mx-auto -mt-[28px] z-20">
          
          {/* Cụm Text và Avatar (Nằm ngang 1 dòng, được neo chặt phía trên thanh Search) */}
          <div className="absolute bottom-[calc(100%+16px)] left-0 w-full flex items-end whitespace-nowrap">
            
            {/* Avatar Notionist tĩnh, lùi sang trái 1 chút để nhường tâm điểm cho Text */}
            <div className="w-40 h-40 shrink-0 mr-4 -ml-8">
              <img 
                src="https://api.dicebear.com/9.x/notionists/svg?seed=Books&backgroundColor=transparent" 
                alt="Study Notionist"
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Message với độ cao đủ để không bao giờ khuyết mất phần đuôi chữ "G" */}
            <h1 className="font-serif text-[42px] font-semibold text-ink tracking-tight flex items-end pb-3">
              <span>Today, I want to learn</span>
              <div className="relative inline-block h-[80px] min-w-[300px] overflow-hidden ml-3">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={topicIndex}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "circOut" }}
                    // Nâng chữ lên 15px so với đáy box để dư sức chứa các đuôi chữ rớt xuống
                    className="absolute bottom-[15px] left-0 text-accent font-bold"
                  >
                    {LEARNING_TOPICS[topicIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </h1>
          </div>

          {/* Search Bar To (Vị trí tọa độ trung tâm tuyệt đối 100%) */}
          {!isScrolled && <SearchBar size="large" />}
        </div>

        {/* Khoảng đệm lò xo đẩy phần Tab và Card xuống tít dưới mép màn hình */}
        <div className="flex-1 min-h-[15vh]"></div>

        {/* 4. TABS & CARDS PEEKING SECTION */}
        <div className="w-full z-10 pb-32 mt-12">
          
          {/* Tabs */}
          <div className="flex items-center gap-10 border-b border-line/80 pb-2 mb-6">
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

          {/* Khóa học nhô lên */}
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
    </div>
  );
}