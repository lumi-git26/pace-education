"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type LessonDetail = {
  id: string;
  title: string;
  content_type: string;
  // FIX: Để content là 'any' để bắt được cả String hoặc Object
  content: any; 
  est_minutes: number;
  unit_id: string;
};

type TocItem = { id: string; text: string; level: number };

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.*)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      items.push({ id: slugify(text), text, level });
    }
  }
  return items;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const unitId = params.unitId as string;
  const lessonId = params.lessonId as string;

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [needsScroll, setNeedsScroll] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", courseId)
        .eq("learner_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!enrollment) {
        setIsEnrolled(false);
        setLoading(false);
        return;
      }

      setIsEnrolled(true);

      const { data: courseRow } = await supabase
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .single();

      if (!cancelled && courseRow) setCourseTitle(courseRow.title);

      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, content_type, content, est_minutes, unit_id")
        .eq("id", lessonId)
        .single();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setLesson(data);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, router]);

  // ==========================================
  // FIX: Lấy dữ liệu an toàn dù nó là chuỗi hay Object
  // ==========================================
  const body = useMemo(() => {
    if (!lesson?.content) return "";
    if (typeof lesson.content === "string") return lesson.content;
    return lesson.content.body || "";
  }, [lesson?.content]);

  const toc = useMemo(() => extractToc(body), [body]);

  useEffect(() => {
    function onScroll() {
      const el = contentRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight - window.innerHeight;

      if (total <= 0) {
        setNeedsScroll(false);
        setScrollProgress(0);
        return;
      }

      setNeedsScroll(true);
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setScrollProgress((scrolled / total) * 100);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [body]);

  async function handleDone() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("lesson_completions")
        .upsert(
          { learner_id: user.id, lesson_id: lessonId },
          { onConflict: "learner_id,lesson_id" }
        );

      // Recompute and save overall course progress.
      const { data: courseUnits } = await supabase
        .from("units")
        .select("id, lessons(id)")
        .eq("course_id", courseId);

      const allLessonIds = (courseUnits ?? []).flatMap((u: any) =>
        (u.lessons ?? []).map((l: any) => l.id)
      );

      const { data: completions } = await supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("learner_id", user.id)
        .in("lesson_id", allLessonIds);

      const progressPct =
        allLessonIds.length > 0
          ? Math.round(((completions?.length ?? 0) / allLessonIds.length) * 100)
          : 0;

      await supabase
        .from("enrollments")
        .update({ progress_pct: progressPct })
        .eq("course_id", courseId)
        .eq("learner_id", user.id);
    }

    router.push(`/courses/${courseId}/${unitId}/${lessonId}/quiz`);
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-serif text-2xl font-semibold text-ink">
          You&apos;re not enrolled in this course
        </p>
        <Link
          href="/explore"
          className="mt-2 rounded-full bg-ink text-white px-6 py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          Go to Explore
        </Link>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">
          Couldn&apos;t load this lesson{error ? `: ${error}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F9F9F8]">
      {/* Scroll Progress Bar */}
      {needsScroll && (
        <div className="fixed top-0 left-0 right-0 z-40 h-1 bg-line/40">
          <div
            className="h-full bg-accent transition-[width] duration-150 ease-out"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      )}

      <div className="px-8 py-10 lg:px-16">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft size={16} /> Back to {courseTitle || "course"}
        </Link>

        <div
          ref={contentRef}
          className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 items-start max-w-5xl mx-auto"
        >
          {/* Nội dung chính bài học */}
          <div className="rounded-[32px] bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm p-8 md:p-12">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-4">
              <Clock size={14} className="text-accent" />
              {lesson.est_minutes} min lesson
            </div>

            <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink leading-tight mb-8">
              {lesson.title}
            </h1>

            <div className="prose prose-sm md:prose-base max-w-none prose-headings:font-serif prose-headings:text-ink prose-p:text-ink/80 prose-p:leading-7 prose-strong:text-ink prose-a:text-accent">
              {body ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({ children }) => (
                      <h2 id={slugify(String(children))}>{children}</h2>
                    ),
                    h2: ({ children }) => (
                      <h2 id={slugify(String(children))}>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 id={slugify(String(children))}>{children}</h3>
                    ),
                    img: ({ src, alt }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={alt} className="rounded-2xl w-full border border-line/50 shadow-sm my-6" />
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              ) : (
                <div className="py-10 text-center border border-dashed border-line/80 rounded-2xl bg-white/50">
                  <p className="text-muted">This lesson doesn&apos;t have content yet.</p>
                </div>
              )}
            </div>

            <div className="mt-12 pt-8 border-t border-line/60">
              <button
                onClick={handleDone}
                className="w-full bg-ink text-white rounded-full py-4 text-sm font-semibold hover:bg-ink/80 transition-all shadow-md hover:shadow-lg"
              >
                Mark as Done & Continue
              </button>
            </div>
          </div>

          {/* Table of Contents */}
          {toc.length > 0 && (
            <div className="hidden lg:block sticky top-8">
              <div className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm p-6">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
                  On this page
                </h3>
                <ul className="space-y-3">
                  {toc.map((item) => (
                    <li key={item.id} style={{ paddingLeft: (item.level - 1) * 12 }}>
                      <a
                        href={`#${item.id}`}
                        className="text-[13px] font-medium text-ink/60 hover:text-accent transition-colors block leading-tight"
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}