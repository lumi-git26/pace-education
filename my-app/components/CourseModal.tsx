"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, PlayCircle, Clock, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { CourseCardData } from "./CourseCard";
import PreferenceModal from "./PreferenceModal";

const UNIT_PREVIEW_LIMIT = 5;
const LESSON_PREVIEW_LIMIT = 3;

export default function CourseModal({
  course,
  onClose,
  onEnrolled,
}: {
  course: CourseCardData;
  onClose: () => void;
  onEnrolled?: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isTitleScrolled, setIsTitleScrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(true);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkEnrollment() {
      setCheckingEnrollment(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCheckingEnrollment(false);
        return;
      }

      const { data } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", course.id)
        .eq("learner_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setIsEnrolled(!!data);
        setCheckingEnrollment(false);
      }
    }

    checkEnrollment();
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setIsTitleScrolled(scrollTop > 120);
  };

  const units = course.units ?? [];
  const visibleUnits = units.slice(0, UNIT_PREVIEW_LIMIT);
  const lockedUnitCount = Math.max(0, units.length - UNIT_PREVIEW_LIMIT);

  async function handleEnroll() {
    if (isEnrolled) {
      router.push(`/courses/${course.id}`);
      return;
    }

    setEnrolling(true);
    setEnrollError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEnrollError("You need to be signed in to enroll.");
      setEnrolling(false);
      return;
    }

    const { error } = await supabase.from("enrollments").upsert(
      {
        course_id: course.id,
        learner_id: user.id,
        status: "active",
      },
      { onConflict: "course_id,learner_id" }
    );

    setEnrolling(false);

    if (error) {
      setEnrollError(error.message);
      return;
    }

    setIsEnrolled(true);
    onEnrolled?.();
    setShowPreferenceModal(true);
  }

  function handlePreferenceDone() {
    setShowPreferenceModal(false);
    router.push(`/courses/${course.id}`);
  }

  if (!mounted) return null;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative w-full max-w-5xl max-h-[90vh] md:h-[75vh] h-full overflow-hidden rounded-[32px] bg-paper shadow-2xl flex flex-col md:flex-row"
            >
              <button
                onClick={onClose}
                className="absolute top-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-md border border-line/50 text-ink hover:bg-ink hover:text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div className="relative w-full md:w-1/2 flex flex-col h-full overflow-hidden">
                <AnimatePresence>
                  {isTitleScrolled && (
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 bg-paper/90 backdrop-blur-md px-8 md:px-12 py-5 pr-16 md:pr-12 border-b border-line/60 shadow-sm"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-accent/20 to-accent/40 flex items-center justify-center text-accent font-serif font-bold text-sm border border-white">
                        {course.title.charAt(0)}
                      </div>
                      <h2 className="font-serif text-lg font-bold text-ink truncate">
                        {course.title}
                      </h2>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-8 md:p-12 pb-10"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent/20 to-accent/40 flex items-center justify-center text-accent font-serif font-bold text-2xl mb-6 border border-white">
                    {course.title.charAt(0)}
                  </div>

                  <h2 className="font-serif text-4xl font-bold text-ink leading-tight mb-2">
                    {course.title}
                  </h2>
                  <p className="text-sm text-muted mb-6">
                    Published by{" "}
                    <span className="text-ink font-medium">
                      {course.publisherName}
                    </span>
                  </p>

                  <div className="flex items-center gap-4 mb-8 text-sm text-ink">
                    <span className="flex items-center gap-1.5 bg-ink/5 px-3 py-1.5 rounded-full">
                      <BookOpen size={14} /> {course.lessonCount ?? 0} lessons
                    </span>
                    <span className="flex items-center gap-1.5 bg-ink/5 px-3 py-1.5 rounded-full">
                      <Clock size={14} /> {course.hoursToComplete ?? 0}h
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                    Welcome & Overview
                  </h3>
                  <p className="text-[15px] leading-7 text-ink/80 whitespace-pre-line">
                    {course.description || "No overview available yet."}
                  </p>
                </div>

                <div className="relative px-8 md:px-12 pb-8 md:pb-12 shrink-0 bg-paper">
                  <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-paper to-transparent pointer-events-none" />
                  {enrollError && (
                    <p className="mb-3 text-sm text-red-600 relative z-10">
                      {enrollError}
                    </p>
                  )}
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling || checkingEnrollment}
                    className={[
                      "w-full rounded-pill py-4 text-[15px] font-medium transition-transform relative z-10 shadow-xl",
                      isEnrolled
                        ? "bg-green-600 text-white hover:scale-[1.02] cursor-pointer"
                        : "bg-ink text-white hover:bg-ink/80 hover:scale-[1.02] cursor-pointer",
                      (enrolling || checkingEnrollment) &&
                        "opacity-60 cursor-not-allowed hover:scale-100",
                    ].join(" ")}
                  >
                    {checkingEnrollment
                      ? "Checking…"
                      : enrolling
                      ? "Enrolling…"
                      : isEnrolled
                      ? "✓ Enrolled — Go to course"
                      : "Enroll"}
                  </button>
                </div>
              </div>

              <div className="w-full md:w-1/2 bg-white/60 border-t md:border-t-0 md:border-l border-line/60 p-8 md:p-12 overflow-y-auto h-full relative">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-5">
                  What&apos;s inside
                </h3>

                {units.length === 0 && (
                  <p className="text-sm text-muted">
                    Course content is being prepared.
                  </p>
                )}

                <div className="space-y-4">
                  {visibleUnits.map((unit, unitIdx) => {
                    const visibleLessons = unit.lessons.slice(0, LESSON_PREVIEW_LIMIT);
                    const lockedLessonCount = Math.max(
                      0,
                      unit.lessons.length - LESSON_PREVIEW_LIMIT
                    );

                    return (
                      <div
                        key={unit.id}
                        className="rounded-2xl border border-line/60 bg-white/70 p-5"
                      >
                        <p className="text-sm font-semibold text-ink mb-3">
                          Unit {unitIdx + 1}: {unit.title}
                        </p>
                        <ul className="space-y-2.5">
                          {visibleLessons.map((lesson) => (
                            <li
                              key={lesson.id}
                              className="flex items-center gap-2.5 text-sm text-ink/80"
                            >
                              <PlayCircle
                                size={15}
                                className="text-accent shrink-0"
                              />
                              {lesson.title}
                            </li>
                          ))}

                          {lockedLessonCount > 0 && (
                            <li className="relative mt-2 overflow-hidden rounded-lg select-none -mx-2 py-2">
                              <div className="flex items-center gap-2.5 text-sm text-ink/40 blur-[2px] px-2">
                                <PlayCircle
                                  size={15}
                                  className="text-accent/40 shrink-0"
                                />
                                Lesson {visibleLessons.length + 1}
                              </div>

                              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1.5px]">
                                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink/80">
                                  <Lock size={14} className="text-muted" />
                                  {lockedLessonCount} more lesson
                                  {lockedLessonCount > 1 ? "s" : ""}
                                </div>
                              </div>
                            </li>
                          )}
                        </ul>
                      </div>
                    );
                  })}

                  {lockedUnitCount > 0 && (
                    <div className="relative rounded-2xl border border-line/60 bg-white/40 p-5 overflow-hidden select-none min-h-[120px]">
                      <div className="opacity-30 blur-[3px]">
                        <p className="text-sm font-semibold text-ink mb-3">
                          Unit {visibleUnits.length + 1}: Locked Module
                        </p>
                        <ul className="space-y-2.5">
                          <li className="flex items-center gap-2.5 text-sm text-ink/80">
                            <PlayCircle size={15} className="shrink-0" /> Lesson 1
                          </li>
                          <li className="flex items-center gap-2.5 text-sm text-ink/80">
                            <PlayCircle size={15} className="shrink-0" /> Lesson 2
                          </li>
                        </ul>
                      </div>

                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                        <div className="flex items-center gap-2 text-sm font-bold text-ink/90">
                          <Lock size={16} className="text-muted" />
                          {lockedUnitCount} more unit{lockedUnitCount > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {showPreferenceModal && (
        <PreferenceModal
          courseId={String(course.id)}
          onClose={handlePreferenceDone}
          onSaved={handlePreferenceDone}
        />
      )}
    </>
  );
}