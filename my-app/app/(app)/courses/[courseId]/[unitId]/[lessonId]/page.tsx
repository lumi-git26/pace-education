"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, Clock, Box } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion, useScroll, useSpring } from "framer-motion";
import "katex/dist/katex.min.css";

// === ĐỊNH NGHĨA CÁC KIỂU BLOCK ===
type Block = {
  type: "markdown" | "image" | "interactive_diagram" | "title" | "heading" | string;
  data?: string;       
  text?: string;       
  level?: number;      
  url?: string;        
  caption?: string;    
  diagram_id?: string; 
  [key: string]: any;
};

type LessonDetail = {
  id: string;
  title: string;
  content_type: string;
  content: any;
  est_minutes: number;
  unit_id: string;
};

type TocItem = { id: string; text: string; level: number };

function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD") 
    .replace(/[\u0300-\u036f]/g, "") 
    .toLowerCase()
    .trim()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9 -]/g, "") 
    .replace(/\s+/g, "-") 
    .replace(/-+/g, "-"); 
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

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

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

  const blocks: Block[] = useMemo(() => {
    if (!lesson?.content) return [];
    
    let parsedContent = lesson.content;
    if (typeof parsedContent === "string") {
      try { parsedContent = JSON.parse(parsedContent); } 
      catch (e) { return [{ type: "markdown", data: parsedContent }]; }
    }

    if (Array.isArray(parsedContent.blocks)) {
      return parsedContent.blocks;
    }
    if (parsedContent.body) {
      return [{ type: "markdown", data: parsedContent.body }];
    }
    return [];
  }, [lesson?.content]);

  const toc = useMemo(() => {
    const items: TocItem[] = [];
    blocks.forEach((b) => {
      if (b.type === "title" || b.type === "heading") {
        const text = b.data || b.text || "";
        const level = b.level || 2;
        if (text) items.push({ id: slugify(text), text, level });
      } 
      else if (b.type === "markdown") {
        items.push(...extractToc(b.data || ""));
      }
    });
    return items;
  }, [blocks]);

  async function handleDone() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("lesson_completions")
        .upsert(
          { learner_id: user.id, lesson_id: lessonId },
          { onConflict: "learner_id,lesson_id" }
        );

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

      const progressPct = allLessonIds.length > 0
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
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F9F9F8]">
        <div className="w-8 h-8 border-4 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen w-full bg-[#F9F9F8] flex flex-col items-center justify-center gap-4 px-6 text-center">
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
      <div className="min-h-screen w-full bg-[#F9F9F8] flex items-center justify-center">
        <p className="text-sm text-muted">
          Couldn&apos;t load this lesson{error ? `: ${error}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F9F9F8]">
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 h-1 bg-[#F2994A] origin-left"
        style={{ scaleX }}
      />

      <div className="px-8 py-10 lg:px-16">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-[13px] font-bold text-muted hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft size={16} /> Back to {courseTitle || "course"}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 items-start max-w-5xl mx-auto">
          {/* NỘI DUNG BÀI HỌC CHÍNH */}
          <div className="rounded-[32px] bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm p-8 md:p-12">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-4">
              <Clock size={14} className="text-[#F2994A]" />
              {lesson.est_minutes} min lesson
            </div>

            <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink leading-tight mb-8">
              {lesson.title}
            </h1>

            {/* BLOCK RENDERER: Giảm gap xuống để các đoạn khít lại */}
            <div className="flex flex-col gap-1.5">
              {blocks.length > 0 ? (
                blocks.map((block, idx) => {
                  
                  // 1. Dạng Title riêng biệt
                  if (block.type === "title" || block.type === "heading") {
                    const text = block.data || block.text || "";
                    const level = block.level || 2;
                    // Đồng bộ kiểu Header: Level 1 (H2 Thường In đậm), Level 2 (H2 Nghiêng In đậm), Level 3 (H3 Nghiêng)
                    if (level === 1) return <h2 key={idx} id={slugify(text)} className="mt-8 mb-2 font-serif font-bold text-2xl not-italic text-ink">{text}</h2>;
                    if (level === 2) return <h2 key={idx} id={slugify(text)} className="mt-8 mb-2 font-serif font-bold italic text-xl text-ink">{text}</h2>;
                    if (level >= 3) return <h3 key={idx} id={slugify(text)} className="mt-6 mb-1.5 font-serif font-normal italic text-lg text-ink/80">{text}</h3>;
                  }

                  // 2. Dạng văn bản Markdown
                  if (block.type === "markdown") {
                    return (
                      <div 
                        key={idx} 
                        // Tinh chỉnh lề đoạn văn, loại bỏ !my-0 thừa để nó ôm sát nội dung
                        className="prose prose-sm md:prose-base max-w-none font-['Charter','Times_New_Roman',serif] text-justify prose-p:text-ink/90 prose-p:leading-[1.2] prose-p:mb-[5pt] prose-p:mt-0 prose-strong:text-ink prose-a:text-[#F2994A] !my-0"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            // Cấu hình Header trong Markdown
                            h1: ({ children }) => <h2 id={slugify(String(children))} className="mt-8 mb-2 font-serif font-bold text-2xl not-italic text-ink">{children}</h2>,
                            h2: ({ children }) => <h2 id={slugify(String(children))} className="mt-8 mb-2 font-serif font-bold italic text-xl text-ink">{children}</h2>,
                            h3: ({ children }) => <h3 id={slugify(String(children))} className="mt-6 mb-1.5 font-serif font-normal italic text-lg text-ink/80">{children}</h3>,
                            
                            // Cấu hình Blockquote biến thành Callout Box
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-[#F2994A] bg-[#F2994A]/10 px-5 py-2.5 rounded-r-xl text-ink/90 not-italic my-4 shadow-sm">
                                {children}
                              </blockquote>
                            ),
                            
                            // CẤU HÌNH TẠO BẢNG (TABLE) CHÍNH XÁC
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-5">
                                <table className="w-full text-left border-collapse border border-line/60 rounded-xl overflow-hidden shadow-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-slate-100/80 border-b border-line/60">{children}</thead>,
                            th: ({ children }) => <th className="p-3.5 font-sans font-bold text-sm text-ink border-r border-line/60 last:border-0">{children}</th>,
                            td: ({ children }) => <td className="p-3.5 text-[14.5px] text-ink/80 border-t border-r border-line/40 last:border-r-0 align-top">{children}</td>,

                            // Hình ảnh
                            img: ({ src, alt }) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={src} alt={alt} className="rounded-2xl w-full border border-line/50 shadow-sm my-6" />
                            ),
                          }}
                        >
                          {block.data || ""}
                        </ReactMarkdown>
                      </div>
                    );
                  }

                  // 3. Dạng hình ảnh chuyên biệt
                  if (block.type === "image") {
                    return (
                      <figure key={idx} className="my-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={block.url} 
                          alt={block.caption || "Lesson Image"} 
                          className="w-full rounded-2xl border border-line/60 shadow-sm"
                        />
                        {block.caption && (
                          <figcaption className="text-center text-[12px] text-muted mt-3 font-medium">
                            {block.caption}
                          </figcaption>
                        )}
                      </figure>
                    );
                  }

                  // 4. Dạng biểu đồ tương tác
                  if (block.type === "interactive_diagram") {
                    return (
                      <div key={idx} className="w-full aspect-video rounded-2xl border-2 border-dashed border-[#F2994A]/40 bg-[#F2994A]/5 flex flex-col items-center justify-center p-6 text-center group cursor-pointer hover:bg-[#F2994A]/10 transition-colors my-5">
                        <Box size={32} className="text-[#F2994A] mb-3" />
                        <h4 className="font-bold text-ink mb-1">Interactive Diagram</h4>
                        <p className="text-[12px] text-muted max-w-[250px]">
                          Diagram ID: <span className="font-mono bg-white px-1 py-0.5 rounded">{block.diagram_id}</span>
                          <br/> (Will be rendered by Canvas engine)
                        </p>
                      </div>
                    );
                  }

                  return null;
                })
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
                <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-4">
                  On this page
                </h3>
                <ul className="space-y-3">
                  {toc.map((item) => (
                    <li key={item.id} style={{ paddingLeft: (item.level - 1) * 12 }}>
                      <a
                        href={`#${item.id}`}
                        className="text-[13px] font-medium text-ink/60 hover:text-[#F2994A] transition-colors block leading-tight"
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