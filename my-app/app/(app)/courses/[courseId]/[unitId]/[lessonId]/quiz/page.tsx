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
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const unitId = params.unitId as string;
  const lessonId = params.lessonId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useState(() => Date.now())[0];
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("questions")
        .select("id, type, content, correct_answer")
        .eq("lesson_id", lessonId)
        .eq("is_final_test", false)
        .order("order_index");

      if (!cancelled) {
        setQuestions(data ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function handleSubmit() {
    let correct = 0;
    questions.forEach((q) => {
      const given = (answers[q.id] ?? "").trim().toLowerCase();
      const rawExpected =
        typeof q.correct_answer === "string"
          ? q.correct_answer
          : JSON.stringify(q.correct_answer ?? "");
      const expected = rawExpected.replace(/^"|"$/g, "").trim().toLowerCase();
      if (given === expected) correct++;
    });

    const pct = questions.length > 0 ? (correct / questions.length) * 100 : 100;
    setScore(pct);
    setSubmitted(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("submissions").insert({
        learner_id: user.id,
        lesson_id: lessonId,
        unit_id: unitId,
        course_id: courseId,
        submission_type: "lesson_quiz",
        score: pct,
        passed: pct >= 70,
        answers,
        time_spent_secs: Math.round((Date.now() - startTimeRef) / 1000),
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">Loading quiz…</p>
      </div>
    );
  }

  if (questions.length === 0 && !loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-serif text-2xl font-semibold text-ink">
          No mini-test for this lesson yet
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

  return (
    <div className="min-h-screen w-full px-8 py-10 lg:px-16">
      <Link
        href={`/courses/${courseId}/${unitId}/${lessonId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Back to lesson
      </Link>

      <div className="max-w-2xl mx-auto rounded-[32px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-8 md:p-12">
        <h1 className="font-serif text-3xl font-bold text-ink mb-8">
          Mini-test
        </h1>

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
            {score >= 70 ? (
              <CheckCircle2 size={40} className="text-green-600 mx-auto mb-4" />
            ) : (
              <XCircle size={40} className="text-red-500 mx-auto mb-4" />
            )}
            <p className="font-serif text-2xl font-semibold text-ink mb-2">
              {Math.round(score)}%
            </p>
            <p className="text-sm text-muted mb-8">
              {score >= 70 ? "Nice work!" : "Keep practicing — try again."}
            </p>
            <button
              onClick={() => router.push(`/courses/${courseId}`)}
              className="rounded-pill bg-ink text-white px-6 py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
            >
              Back to course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}