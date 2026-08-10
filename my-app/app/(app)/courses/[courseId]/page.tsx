"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";
import {
  Lock,
  PlayCircle,
  ArrowLeft,
  Search,
  ChevronDown,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import Link from "next/link";

type Lesson = { id: string; title: string; order_index: number };
type Unit = {
  id: string;
  title: string;
  order_index: number;
  phase_id: string | null;
  lessons: Lesson[];
};
type Phase = {
  id: string;
  title: string;
  order_index: number;
  passing_score: number;
};
type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  units: Unit[];
  phases: Phase[];
};

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useProfile();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
    new Set()
  );
  const [passedPhaseIds, setPassedPhaseIds] = useState<Set<string>>(new Set());
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openUnitId, setOpenUnitIdState] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function setOpenUnitId(id: string | null) {
    setOpenUnitIdState(id);
    if (id) localStorage.setItem(`pace_last_unit_${courseId}`, id);
  }

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
        .select("id, status")
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

      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, title, description, units(id, title, order_index, phase_id, lessons(id, title, order_index)), phases(id, title, order_index, passing_score)"
        )
        .eq("id", courseId)
        .single();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const sortedUnits = (data.units ?? [])
        .slice()
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((u: any) => ({
          ...u,
          lessons: (u.lessons ?? [])
            .slice()
            .sort((a: any, b: any) => a.order_index - b.order_index),
        }));

      const sortedPhases = (data.phases ?? [])
        .slice()
        .sort((a: any, b: any) => a.order_index - b.order_index);

      const { data: completions } = await supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("learner_id", user.id);

      const { data: passedSubmissions } = await supabase
        .from("submissions")
        .select("phase_id")
        .eq("learner_id", user.id)
        .eq("course_id", courseId)
        .eq("submission_type", "unit_final")
        .eq("passed", true);

      if (!cancelled) {
        setCompletedLessonIds(
          new Set((completions ?? []).map((c: any) => c.lesson_id))
        );
        setPassedPhaseIds(
          new Set((passedSubmissions ?? []).map((s: any) => s.phase_id))
        );

        const savedUnitId = localStorage.getItem(`pace_last_unit_${courseId}`);
        const validSavedUnit = sortedUnits.find(
          (u: any) => u.id === savedUnitId
        );

        setCourse({
          id: data.id,
          title: data.title,
          description: data.description,
          units: sortedUnits,
          phases: sortedPhases,
        });
        setOpenUnitIdState(
          validSavedUnit ? savedUnitId : sortedUnits[0]?.id ?? null
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  let nextLesson: Lesson | null = null;
  let nextUnit: Unit | null = null;
  if (course) {
    outer: for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        if (!completedLessonIds.has(lesson.id)) {
          nextLesson = lesson;
          nextUnit = unit;
          break outer;
        }
      }
    }
  }

  const totalLessons =
    course?.units.reduce((sum, u) => sum + u.lessons.length, 0) ?? 0;
  const completedCount = completedLessonIds.size;

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">Loading course…</p>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Lock size={32} className="text-muted" />
        <p className="font-serif text-2xl font-semibold text-ink">
          You&apos;re not enrolled in this course
        </p>
        <p className="text-sm text-muted max-w-sm">
          Head to Explore to view the course details and enroll before
          accessing its content.
        </p>
        <Link
          href="/explore"
          className="mt-4 rounded-pill bg-ink text-white px-6 py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          Go to Explore
        </Link>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">
          Couldn&apos;t load this course{error ? `: ${error}` : ""}.
        </p>
      </div>
    );
  }

  const filteredUnits = course.units
    .map((unit) => ({
      ...unit,
      lessons: unit.lessons.filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(
      (unit) =>
        !search ||
        unit.title.toLowerCase().includes(search.toLowerCase()) ||
        unit.lessons.length > 0
    );

  const unitsByPhase: Record<string, Unit[]> = {};
  filteredUnits.forEach((u) => {
    if (u.phase_id) {
      unitsByPhase[u.phase_id] = unitsByPhase[u.phase_id] ?? [];
      unitsByPhase[u.phase_id].push(u);
    }
  });

  return (
    <div className="min-h-screen w-full px-8 py-10 lg:px-16">
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Back to your courses
      </Link>

      <div className="rounded-[32px] bg-white/50 backdrop-blur-xl border border-white/60 shadow-sm p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
              Welcome, {firstName}
            </h1>
            <p className="font-serif text-2xl font-bold text-accent mb-1">
              {course.title}
            </p>
            {course.description && (
              <p className="text-sm text-muted max-w-lg">
                {course.description}
              </p>
            )}
          </div>

          <div className="relative w-full max-w-[280px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons"
              className="w-full rounded-pill border border-line bg-white/70 py-2.5 pl-5 pr-11 text-sm text-ink outline-none placeholder:text-muted focus:border-accent shadow-sm"
            />
            <button className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white">
              <Search size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div className="rounded-[24px] bg-white p-3 space-y-4">
            {course.phases.map((phase, phaseIdx) => {
              const phaseUnits = unitsByPhase[phase.id] ?? [];
              if (phaseUnits.length === 0) return null;

              const previousPhase = course.phases[phaseIdx - 1];
              const phaseLocked =
                phaseIdx > 0 &&
                previousPhase &&
                !passedPhaseIds.has(previousPhase.id);
              const phasePassed = passedPhaseIds.has(phase.id);

              return (
                <div key={phase.id} className="space-y-2">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider px-2">
                    {phase.title}
                  </p>

                  {phaseLocked ? (
                    <div className="flex items-center gap-3 rounded-2xl px-5 py-6 border border-line/50 bg-line/10 opacity-70">
                      <Lock size={18} className="text-muted" />
                      <p className="text-sm text-muted">
                        Pass &quot;{previousPhase.title}&quot; to unlock this
                        phase.
                      </p>
                    </div>
                  ) : (
                    <>
                      {phaseUnits.map((unit) => {
                        const unitIdx =
                          course.units.findIndex((u) => u.id === unit.id) + 1;
                        const open = openUnitId === unit.id;
                        return (
                          <div
                            key={unit.id}
                            className="rounded-2xl border border-line/60 overflow-hidden"
                          >
                            <button
                              onClick={() =>
                                setOpenUnitId(open ? null : unit.id)
                              }
                              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-ink/5 transition-colors"
                            >
                              <span className="text-sm font-semibold text-ink">
                                Unit {unitIdx}: {unit.title}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted">
                                  {unit.lessons.length} lesson
                                  {unit.lessons.length !== 1 ? "s" : ""}
                                </span>
                                <ChevronDown
                                  size={16}
                                  className={`text-muted transition-transform ${
                                    open ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </button>

                            {open && (
                              <ul className="border-t border-line/50 bg-white/60">
                                {unit.lessons.map((lesson) => {
                                  const done = completedLessonIds.has(
                                    lesson.id
                                  );
                                  return (
                                    <li key={lesson.id}>
                                      <button
                                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-sm text-ink/80 hover:bg-ink/5 hover:text-ink transition-colors border-b border-line/30 last:border-b-0"
                                        onClick={() =>
                                          router.push(
                                            `/courses/${courseId}/${unit.id}/${lesson.id}`
                                          )
                                        }
                                      >
                                        {done ? (
                                          <CheckCircle2
                                            size={16}
                                            className="text-green-600 shrink-0"
                                          />
                                        ) : (
                                          <PlayCircle
                                            size={16}
                                            className="text-accent shrink-0"
                                          />
                                        )}
                                        {lesson.title}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}

                      <button
                        onClick={() =>
                          router.push(`/courses/${courseId}/phase/${phase.id}`)
                        }
                        className={[
                          "w-full flex items-center gap-3 rounded-2xl px-5 py-4 border text-left transition-colors",
                          phasePassed
                            ? "border-green-300 bg-green-50 hover:bg-green-100"
                            : "border-accent/40 bg-accent/10 hover:bg-accent/15",
                        ].join(" ")}
                      >
                        {phasePassed ? (
                          <CheckCircle2 size={18} className="text-green-600" />
                        ) : (
                          <FileCheck size={18} className="text-accent" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink">
                            {phase.title} — Final Test
                          </p>
                          <p className="text-xs text-muted">
                            {phasePassed
                              ? "Passed — retake anytime"
                              : `Take anytime — score ${phase.passing_score}%+ to skip ahead`}
                          </p>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-[24px] bg-white p-6 h-fit sticky top-8">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
              Continue learning
            </h3>

            {nextLesson && nextUnit ? (
              <>
                <div className="rounded-2xl bg-accent/10 p-4 mb-5">
                  <p className="text-xs font-medium text-accent mb-1">
                    {nextUnit.title}
                  </p>
                  <p className="text-sm font-semibold text-ink">
                    {nextLesson.title}
                  </p>
                </div>
                <button
                  onClick={() =>
                    router.push(
                      `/courses/${courseId}/${nextUnit!.id}/${nextLesson!.id}`
                    )
                  }
                  className="w-full bg-ink text-white rounded-pill py-3 text-sm font-medium hover:bg-ink/80 transition-colors mb-6"
                >
                  {completedCount > 0 ? "Continue" : "Start lesson"}
                </button>
              </>
            ) : (
              <div className="rounded-2xl bg-green-50 p-4 mb-6 text-center">
                <CheckCircle2 size={24} className="text-green-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-ink">
                  All lessons complete!
                </p>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-muted">
                <span>Progress</span>
                <span className="text-ink font-medium">
                  {completedCount}/{totalLessons}
                </span>
              </div>
              <div className="w-full bg-line/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-accent h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totalLessons > 0
                        ? (completedCount / totalLessons) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}