"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const TIME_ROWS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
] as const;

const DAY_COLS = [
  { key: 0, label: "Sun" },
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
];

type Slot = { day: number; time: string };

function slotKey(day: number, time: string) {
  return `${day}-${time}`;
}

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
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
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

  // Distinct days represented among selected slots — used both for the
  // "pick at least one" gate and to cap lessons/week suggestions.
  const distinctDays = useMemo(() => {
    const days = new Set<number>();
    selectedSlots.forEach((key) => {
      const [day] = key.split("-");
      days.add(Number(day));
    });
    return days;
  }, [selectedSlots]);

  const suggestedLessonsPerWeek = useMemo(() => {
    if (!hasDeadline || !targetDate || distinctDays.size === 0 || !totalLessons) {
      return null;
    }
    const weeks = weeksBetween(new Date(), new Date(targetDate));
    const raw = totalLessons / weeks;
    return Math.min(distinctDays.size, Math.max(1, Math.ceil(raw)));
  }, [hasDeadline, targetDate, distinctDays, totalLessons]);

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

  function toggleSlot(day: number, time: string) {
    const key = slotKey(day, time);
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

    await supabase
      .from("learner_preferences")
      .upsert(
        { learner_id: user.id },
        { onConflict: "learner_id", ignoreDuplicates: true }
      );

    const availability: Slot[] = Array.from(selectedSlots).map((key) => {
      const [day, time] = key.split("-");
      return { day: Number(day), time };
    });

    const { error } = await supabase.from("schedule_preferences").insert({
      learner_id: user.id,
      course_id: courseId,
      availability,
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
          className="relative w-full max-w-lg rounded-[28px] bg-paper shadow-2xl p-7 max-h-[85vh] overflow-y-auto"
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
            Tap the times that work for you. You can change this anytime.
          </p>

          {/* Day x Time grid */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-separate border-spacing-1.5 min-w-[420px]">
              <thead>
                <tr>
                  <th className="w-16" />
                  {DAY_COLS.map((d) => (
                    <th
                      key={d.key}
                      className="text-[10px] font-bold text-muted uppercase pb-1"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="text-xs font-medium text-ink/70 pr-2 whitespace-nowrap">
                      {row.label}
                    </td>
                    {DAY_COLS.map((d) => {
                      const active = selectedSlots.has(slotKey(d.key, row.key));
                      return (
                        <td key={d.key}>
                          <button
                            onClick={() => toggleSlot(d.key, row.key)}
                            aria-label={`${row.label} ${d.label}`}
                            className={[
                              "w-full aspect-square rounded-lg transition-colors border",
                              active
                                ? "bg-accent border-accent"
                                : "bg-white/60 border-line/60 hover:bg-ink/5",
                            ].join(" ")}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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

              {distinctDays.size === 0 && (
                <p className="text-xs text-muted">
                  Select at least one time slot to see a suggested pace.
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
                      max={distinctDays.size}
                      value={lessonsPerWeek ?? suggestedLessonsPerWeek}
                      onChange={(e) =>
                        setLessonsPerWeek(
                          Math.max(
                            1,
                            Math.min(distinctDays.size, Number(e.target.value))
                          )
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