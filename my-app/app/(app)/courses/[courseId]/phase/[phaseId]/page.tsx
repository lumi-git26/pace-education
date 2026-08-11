"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

type Question = {
  id: string;
  type: string;
  content: { prompt: string; options?: string[] };
  correct_answer: any;
  lesson_id: string;
};

function unwrapAnswer(raw: any): string {
  const str = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  return str.replace(/^"|"$/g, "").trim().toLowerCase();
}

export default function PhaseTestPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const phaseId = params.phaseId as string;

  const [phaseTitle, setPhaseTitle] = useState("");
  const [passingScore, setPassingScore] = useState(85);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allPhaseLessonIds, setAllPhaseLessonIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useState(() => Date.now())[0];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: phase, error: phaseErr } = await supabase
        .from("phases")
        .select("title, passing_score")
        .eq("id", phaseId)
        .single();

      if (cancelled) return;

      if (phaseErr || !phase) {
        setError("Couldn't load this test.");
        setLoading(false);
        return;
      }

      setPhaseTitle(phase.title);
      setPassingScore(phase.passing_score ?? 85);

      const { data: units } = await supabase
        .from("units")
        .select("id, lessons(id)")
        .eq("phase_id", phaseId);

      const lessonIds = (units ?? []).flatMap((u: any) =>
        (u.lessons ?? []).map((l: any) => l.id)
      );
      setAllPhaseLessonIds(lessonIds);

      if (lessonIds.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      const { data: qs } = await supabase
        .from("questions")
        .select("id, type, content, correct_answer, lesson_id")
        .in("lesson_id", lessonIds)
        .order("order_index");

      if (!cancelled) {
        setQuestions(qs ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [phaseId]);

  async function handleSubmit() {
    const wrongLessonIds = new Set<string>();
    const correctLessonIds = new Set<string>();
    let correct = 0;

    questions.forEach((q) => {
      const given = (answers[q.id] ?? "").trim().toLowerCase();
      const expected = unwrapAnswer(q.correct_answer);
      if (given === expected) {
        correct++;
        correctLessonIds.add(q.lesson_id);
      } else {
        wrongLessonIds.add(q.lesson_id);
      }
      
    });

    const pct = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const passed = pct >= passingScore;
    setScore(pct);
    setSubmitted(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

      await supabase.from("submissions").insert({
        learner_id: user.id,
        course_id: courseId,
        phase_id: phaseId,
        submission_type: "unit_final",
        score: pct,
        passed,
        answers,
        time_spent_secs: Math.round((Date.now() - startTimeRef) / 1000),
      });

    if (passed) {
      // Mark every lesson in this phase complete, EXCEPT ones tied to a
      // wrong answer — those stay incomplete and get scheduled for review.
      const lessonsToComplete = allPhaseLessonIds.filter(
        (id) => !wrongLessonIds.has(id)
      );

      if (lessonsToComplete.length > 0) {
        await supabase.from("lesson_completions").upsert(
          lessonsToComplete.map((lesson_id) => ({
            learner_id: user.id,
            lesson_id,
          })),
          { onConflict: "learner_id,lesson_id" }
        );
      }

      for (const lessonId of wrongLessonIds) {
        await supabase.from("spaced_repetition").upsert(
          {
            learner_id: user.id,
            lesson_id: lessonId,
            ease_factor: 2.5,
            interval_days: 1,
            repetitions: 0,
            next_review_date: new Date().toISOString().slice(0, 10),
          },
          { onConflict: "learner_id,lesson_id" }
        );
      }

      // Recompute overall course progress the same way the lesson page does.
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
  }

  function handleRetry() {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">Loading test…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">{error}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-serif text-2xl font-semibold text-ink">
          No test questions yet for {phaseTitle}
        </p>
        <button
          onClick={() => router.push(`/courses/${courseId}`)}
          className="rounded-pill bg-ink text-white px-6 py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          Back to course
        </button>
      </div>
    );
  }

  const passed = score >= passingScore;

  return (
    <div className="min-h-screen w-full px-8 py-10 lg:px-16">
      <Link
        href={`/courses/${courseId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Back to course
      </Link>

      <div className="max-w-2xl mx-auto rounded-[32px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-8 md:p-12">
        <h1 className="font-serif text-3xl font-bold text-ink mb-1">
          {phaseTitle} — Final Test
        </h1>
        <p className="text-sm text-muted mb-8">
          Pass with {passingScore}% or higher to skip ahead. Lessons tied to
          any wrong answers will come back later for review.
        </p>

        {!submitted ? (
          <div className="space-y-8">
            {questions.map((q, idx) => (
              <div key={q.id}>
                <p className="text-sm font-semibold text-ink mb-3">
                  {idx + 1}. {q.content.prompt}
                </p>

                {q.type === "multiple_choice" && q.content.options ? (
                  <div className="space-y-2">
                    {q.content.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-3 rounded-xl border border-line/60 bg-white/70 px-4 py-3 text-sm cursor-pointer hover:bg-ink/5"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                    }
                    placeholder="Your answer"
                    className="w-full rounded-pill border border-line px-5 py-3 text-sm outline-none focus:border-accent"
                  />
                )}
              </div>
            ))}

            <button
              onClick={handleSubmit}
              className="w-full bg-ink text-white rounded-pill py-4 text-sm font-medium hover:bg-ink/80 transition-colors"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            {passed ? (
              <CheckCircle2 size={40} className="text-green-600 mx-auto mb-4" />
            ) : (
              <XCircle size={40} className="text-red-500 mx-auto mb-4" />
            )}
            <p className="font-serif text-2xl font-semibold text-ink mb-2">
              {Math.round(score)}%
            </p>
            <p className="text-sm text-muted mb-8">
              {passed
                ? "You passed! Lessons you got right are marked complete — missed ones will come back for review."
                : `You need ${passingScore}% to pass. Try again — questions may be reordered.`}
            </p>
            <div className="flex gap-3 justify-center">
              {!passed && (
                <button
                  onClick={handleRetry}
                  className="rounded-pill bg-accent text-white px-6 py-3 text-sm font-medium hover:bg-accent-dark transition-colors"
                >
                  Retry test
                </button>
              )}
              <button
                onClick={() => router.push(`/courses/${courseId}`)}
                className="rounded-pill bg-ink text-white px-6 py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
              >
                Back to course
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}