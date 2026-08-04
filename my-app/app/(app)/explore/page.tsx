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

  // Hiệu ứng đổi từ khóa Morphing mượt mà
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
      
      {/* 1. NỀN CHẤM BI (DOTTED NOTEBOOK) - Code CSS cực xịn đảm bảo 100% hiện thị sắc nét */}
      <div 
        className="fixed inset-0 -z-30 pointer-events-none"
        style={{ 
          backgroundColor: '#EFEDE7',
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1.5px, transparent 1.5px)', 
          backgroundSize: '24px 24px'
        }} 
      />
      
      {/* Các hình vẽ Notionist tĩnh trang trí góc */}
      <div className="fixed inset-0 -z-20 pointer-events-none opacity-20">
        <Pencil className="absolute top-[25%] right-[12%] text-ink rotate-45 w-14 h-14" strokeWidth={1} />
        <Ruler className="absolute bottom-[35%] left-[8%] text-ink -rotate-12 w-20 h-20" strokeWidth={1} />
        <BookOpen className="absolute top-[18%] left-[18%] text-ink rotate-12 w-12 h-12" strokeWidth={1} />
        <NotebookPen className="absolute bottom-[25%] right-[15%] text-ink -rotate-[20deg] w-16 h-16" strokeWidth={1} />
      </div>

      {/* Background Gradient lơ lửng tạo chiều sâu */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none mix-blend-multiply opacity-50">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#F2994A]/25 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[60%] bg-[#C9A6E0]/25 blur-[120px] rounded-full" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-[#6FB1D6]/20 blur-[120px] rounded-full" />
      </div>

      {/* Điểm kích hoạt Morphing */}
      <div ref={sentinelRef} className="absolute top-[15vh] h-10 w-full pointer-events-none" />

      {/* 2. STICKY HEADER - Kính mờ siêu mượt, opacity nhạt hơn */}
      <div className={`fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 pb-4 pt-4 bg-[#EFEDE7]/20 backdrop-blur-xl border-b border-white/10 transition-all duration-300 ${
        isScrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      }`}>
        <div className="flex items-center gap-3 text-ink font-medium">
          <ArrowLeft size={20} className="cursor-pointer hover:text-accent transition-colors" />
          <span className="font-serif text-lg">Explore</span>
        </div>
        <div className="w-72 mr-4 md:mr-10">
          {isScrolled && <SearchBar size="small" />}
        </div>
      </div>

      {/* 3. HERO SECTION (SEARCH BAR CENTERED Ttuyệt đối) */}
      <div className="absolute top-[50vh] left-1/2 w-full max-w-[800px] px-6 -translate-x-1/2 -translate-y-1/2 z-20">
        
        {/* Cụm Text và Avatar (Nằm ngang 1 dòng, ghim sát mép trên thanh Search) */}
        <div className="absolute bottom-[calc(100%+20px)] left-0 w-full flex flex-row items-end justify-start px-2">
          
          {/* Avatar Notionist đứng yên */}
          <div className="w-32 h-32 md:w-36 md:h-36 shrink-0 mr-4 -ml-4 z-10">
            <img 
              src="https://api.dicebear.com/9.x/notionists/svg?seed=Books&backgroundColor=transparent" 
              className="w-full h-full object-bottom drop-shadow-sm" 
              alt="Student" 
            />
          </div>
          
          {/* Message - Đã fix hoàn toàn lỗi rớt đuôi chữ "G" */}
          <h1 className="font-serif text-[38px] md:text-[46px] font-semibold text-ink leading-none flex items-end pb-3">
            <span className="mr-3">Today, I want to learn</span>
            {/* Box chứa chữ Animated: min-w đủ to, align-bottom để nằm cùng baseline với chữ Today */}
            <span className="relative inline-block h-[1.1em] min-w-[280px] overflow-hidden align-bottom">
              <AnimatePresence mode="popLayout">
                <motion.span 
                  key={topicIndex}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  // bottom-0 giúp các chữ như "English" tha hồ thò đuôi "g" xuống mà không bị cắt
                  className="absolute bottom-0 left-0 text-accent font-bold pb-1"
                >
                  {LEARNING_TOPICS[topicIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>
        </div>

        {/* Thanh Search Bar (Nằm chính giữa tâm màn hình) */}
        {!isScrolled && <SearchBar size="large" />}
      </div>

      {/* 4. TABS & CARDS PEEKING SECTION */}
      {/* Cục Spacer này sẽ đẩy nội dung xuống dưới mốc 82vh, tạo ra hiệu ứng "nhô lên 1 xíu" từ cạnh dưới màn hình */}
      <div className="h-[82vh] w-full pointer-events-none" />
      
      <div className="w-full px-6 pb-32 z-10 relative">
        
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

        {/* Khóa học */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-[24px] border border-line bg-surface/50" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="rounded-[24px] border border-line bg-surface/50 backdrop-blur-md p-12 text-center text-sm text-muted shadow-sm">
            <p className="text-lg mb-2 text-ink font-medium">No courses found 🌱</p>
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