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

const MOCK_COURSES: CourseCardData[] = [
  { id: 'mock-1', title: 'IELTS Mastery: Band 8.0+', publisherName: 'Kira', lessonCount: 24, hoursToComplete: 40 },
  { id: 'mock-2', title: 'Corporate Finance 101', publisherName: 'Pace Education', lessonCount: 12, hoursToComplete: 15 },
  { id: 'mock-3', title: 'Data Analysis with Python', publisherName: 'Kira', lessonCount: 18, hoursToComplete: 25 },
  { id: 'mock-4', title: 'Spanish for Beginners', publisherName: 'Kira', lessonCount: 30, hoursToComplete: 50 },
  { id: 'mock-5', title: 'Advanced English Grammar', publisherName: 'Pace Education', lessonCount: 15, hoursToComplete: 20 },
  { id: 'mock-6', title: 'Financial Modeling', publisherName: 'Kira', lessonCount: 20, hoursToComplete: 35 },
  { id: 'mock-7', title: 'IELTS Speaking Pro', publisherName: 'Pace Education', lessonCount: 10, hoursToComplete: 15 },
  { id: 'mock-8', title: 'Machine Learning Basics', publisherName: 'Kira', lessonCount: 25, hoursToComplete: 45 },
];

export default function ExplorePage() {
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  
  const [isScrolled, setIsScrolled] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);

  // --- LOGIC HIỆU ỨNG GÕ CHỮ ---
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

      // Tốc độ xóa phím nhanh hơn gõ phím
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

  // Fetch / Mock Data
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

  // Lắng nghe cuộn
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

  const SearchBar = ({ className, size = "large" }: { className?: string, size?: "large" | "small" }) => (
    <div className={`relative w-full ${className}`}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm kiếm khóa học..."
        className={`w-full rounded-pill border border-line bg-white/60 backdrop-blur-xl text-ink outline-none placeholder:text-muted focus:border-accent shadow-sm transition-all hover:shadow-md ${
          size === "large" ? "py-4 pl-8 pr-16 text-lg" : "py-2.5 pl-5 pr-12 text-sm"
        }`}
      />
      <button
        aria-label="Search"
        className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
          size === "large" ? "right-2.5 h-11 w-11" : "right-1.5 h-8 w-8"
        }`}
      >
        <Search size={size === "large" ? 20 : 16} />
      </button>
    </div>
  );

  return (
    <div className="relative w-full min-h-screen">
      
      {/* NỀN CHẤM BI */}
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

      {/* STICKY HEADER */}
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
                <SearchBar size="small" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* HERO SECTION - CĂN GIỮA VÀ XỬ LÝ RỚT DÒNG */}
      <div className="absolute top-[40vh] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4 flex flex-col items-center z-20 max-w-5xl">
        
        {/* whitespace-nowrap CẤM TUYỆT ĐỐI rớt dòng. Chỉnh responsive font-size để tránh tràn màn hình */}
        <h1 className="font-serif text-[26px] xs:text-[32px] sm:text-[40px] md:text-[54px] font-semibold text-ink flex flex-row items-center justify-center mb-8 w-full leading-tight whitespace-nowrap">
          <span>Today, I want to learn</span>
          
          {/* inline-grid chứa bóng ma và chữ thật */}
          <div className="inline-grid items-center text-accent ml-2 md:ml-3 text-left overflow-visible">
            
            {/* 1. BÓNG MA CỐ ĐỊNH: Lấy "English" làm chuẩn.
                Nó ép khung giữ nguyên độ rộng tối thiểu, làm câu lệch sang trái 1 xíu ngay từ đầu và đứng yên. */}
            <span className="col-start-1 row-start-1 opacity-0 pointer-events-none pr-1">
              English
            </span>
            
            {/* 2. CHỮ THẬT: Nằm đè lên bóng ma. Khi gõ quá dài, nó sẽ làm giãn khung ra và đẩy chữ Today sang trái! */}
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
          <SearchBar size="large" />
        </div>
      </div>

      {/* CONTENT SECTION */}
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

        {!loading && visible.length === 0 && (
          <div className="rounded-[32px] border border-line bg-white/80 backdrop-blur-md p-14 text-center text-sm text-muted shadow-sm">
            <p className="text-xl mb-3 text-ink font-medium">No courses found 🌱</p>
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