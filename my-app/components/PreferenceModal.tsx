"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sun, Sunset, Moon, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const TIME_OPTIONS = [
  { key: "morning", label: "Morning", icon: Sun },
  { key: "afternoon", label: "Afternoon", icon: Sunset },
  { key: "evening", label: "Evening", icon: Moon },
] as const;

const DAY_OPTIONS = [
  { key: 0, label: "Sun" },
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
];

function weeksBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24 * 7)));
}

export default function PreferenceModal({
  courseId,
  onClose,
  onSaved,
}: {
  courseId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [timesOfDay, setTimesOfDay] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [totalLessons, setTotalLessons] = useState<number | null>(null);
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLessonCount() {
      const { data } = await supabase
        .from("units")
        .select("lessons(id)")
        .eq("course_id", courseId);

      const count = (data ?? []).reduce(
        (sum: number, u: any) => sum + (u.lessons?.length ?? 0),
        0
      );
      if (!cancelled) setTotalLessons(count);
    }

    loadLessonCount();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Suggested pace: only meaningful once days are picked and a deadline
  // is set, since it's grounded in "how many study sessions can actually
  // happen" rather than guessed at.
  const suggestedLessonsPerWeek = useMemo(() => {
    if (!hasDeadline || !targetDate || days.length === 0 || !totalLessons) {
      return null;
    }
    const weeks = weeksBetween(new Date(), new Date(targetDate));
    const raw = totalLessons / weeks;
    // Can't suggest more sessions per week than available days.
    return Math.min(days.length, Math.max(1, Math.ceil(raw)));
  }, [hasDeadline, targetDate, days, totalLessons]);

  useEffect(() => {
    if (suggestedLessonsPerWeek != null && lessonsPerWeek == null) {
      setLessonsPerWeek(suggestedLessonsPerWeek);
    }
  }, [suggestedLessonsPerWeek, lessonsPerWeek]);

  const estimatedCompletionDate = useMemo(() => {
    if (!lessonsPerWeek || !totalLessons) return null;
    const weeksNeeded = Math.ceil(totalLessons / lessonsPerWeek);
    const d = new Date();
    d.setDate(d.getDate() + weeksNeeded * 7);
    return d;
  }, [lessonsPerWeek, totalLessons]);

  function toggleTime(key: string) {
    setTimesOfDay((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

  function toggleDay(key: number) {
    setDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You need to be signed in.");
      setSaving(false);
      return;
    }

    // Ensure a learner_preferences row exists (defaults are fine here).
    await supabase
      .from("learner_preferences")
      .upsert(
        { learner_id: user.id },
        { onConflict: "learner_id", ignoreDuplicates: true }
      );

    const { error } = await supabase.from("schedule_preferences").insert({
      learner_id: user.id,
      course_id: courseId,
      time_of_day: timesOfDay,
      available_days: days,
      target_date: hasDeadline && targetDate ? targetDate : null,
      lessons_per_week: lessonsPerWeek,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSaved?.();
    onClose();
  }

  function handleSkip() {
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-[28px] bg-paper shadow-2xl p-7 max-h-[85vh] overflow-y-auto"
        >
          <button
            onClick={handleSkip}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <h2 className="font-serif text-2xl font-bold text-ink mb-1">
            When do you want to study?
          </h2>
          <p className="text-sm text-muted mb-6">
            This helps us pace your lessons. You can change this anytime.
          </p>

          {/* Time of day */}
          <div className="mb-6">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              Time of day
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_OPTIONS.map(({ key, label, icon: Icon }) => {
                const active = timesOfDay.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTime(key)}
                    className={[
                      "flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-medium transition-colors border",
                      active
                        ? "bg-ink text-white border-ink"
                        : "bg-white/60 text-ink/70 border-line/60 hover:bg-ink/5",
                    ].join(" ")}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Days available */}
          <div className="mb-6">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              Days available
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_OPTIONS.map(({ key, label }) => {
                const active = days.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleDay(key)}
                    className={[
                      "flex items-center justify-center rounded-xl py-2.5 text-[11px] font-semibold transition-colors border",
                      active
                        ? "bg-accent text-white border-accent"
                        : "bg-white/60 text-ink/70 border-line/60 hover:bg-ink/5",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deadline */}
          <div className="mb-3">
            <label className="flex items-center gap-2.5 text-sm font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
                className="rounded"
              />
              I have a deadline for this course
            </label>
          </div>

          {hasDeadline && (
            <div className="mb-6 space-y-4">
              <div className="relative">
                <input
                  type="date"
                  value={targetDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <CalendarIcon
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
              </div>

              {days.length === 0 && (
                <p className="text-xs text-muted">
                  Pick at least one available day to see a suggested pace.
                </p>
              )}

              {suggestedLessonsPerWeek != null && (
                <div className="rounded-2xl bg-accent/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-ink">
                      Lessons per week
                    </p>
                    <input
                      type="number"
                      min={1}
                      max={days.length}
                      value={lessonsPerWeek ?? suggestedLessonsPerWeek}
                      onChange={(e) =>
                        setLessonsPerWeek(
                          Math.max(1, Math.min(days.length, Number(e.target.value)))
                        )
                      }
                      className="w-16 rounded-lg border border-line px-2 py-1 text-sm text-center outline-none focus:border-accent"
                    />
                  </div>
                  {estimatedCompletionDate && (
                    <p className="text-xs text-muted">
                      Estimated completion:{" "}
                      <span className="font-medium text-ink">
                        {estimatedCompletionDate.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 rounded-pill border border-line py-3 text-sm font-medium text-muted hover:bg-ink/5 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-pill bg-ink text-white py-3 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}