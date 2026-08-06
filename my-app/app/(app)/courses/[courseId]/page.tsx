"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Lock, PlayCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Lesson = { id: string; title: string; order_index: number };
type Unit = { id: string; title: string; order_index: number; lessons: Lesson[] };
type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  units: Unit[];
};

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          "id, title, description, units(id, title, order_index, lessons(id, title, order_index))"
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
          lessons: (u.lessons ?? []).slice().sort(
            (a: any, b: any) => a.order_index - b.order_index
          ),
        }));

      setCourse({
        id: data.id,
        title: data.title,
        description: data.description,
        units: sortedUnits,
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

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

  return (
    <div className="min-h-screen w-full px-8 py-16 lg:px-16">
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Back to your courses
      </Link>

      <h1 className="font-serif text-4xl font-semibold text-ink mb-3">
        {course.title}
      </h1>
      {course.description && (
        <p className="text-[15px] text-ink/70 max-w-2xl mb-10">
          {course.description}
        </p>
      )}

      <div className="space-y-4 max-w-2xl">
        {course.units.map((unit, unitIdx) => (
          <div
            key={unit.id}
            className="rounded-2xl border border-line/60 bg-white/70 p-5"
          >
            <p className="text-sm font-semibold text-ink mb-3">
              Unit {unitIdx + 1}: {unit.title}
            </p>
            <ul className="space-y-2.5">
              {unit.lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex items-center gap-2.5 text-sm text-ink/80"
                >
                  <PlayCircle size={15} className="text-accent shrink-0" />
                  {lesson.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}