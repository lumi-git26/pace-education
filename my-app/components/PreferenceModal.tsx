"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar as CalendarIcon, AlertCircle, Clock } from "lucide-react";
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

  // Kiểm tra xem learner có đang chọn số buổi học ít hơn đề xuất không
  const isFallingBehind = useMemo(() => {
    if (suggestedLessonsPerWeek === null || lessonsPerWeek === null) return false;
    return lessonsPerWeek < suggestedLessonsPerWeek;
  }, [suggestedLessonsPerWeek, lessonsPerWeek]);

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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-[0_24px_40px_-12px_rgba(0,0,0,0.1)] backdrop-blur-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden custom-scrollbar"
        >
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold tracking-tight text-slate-800">
                Study Schedule
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Tap the times that work for you. We'll build a pace that fits your life.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Time Slot Grid */}
          <div className="mb-8 overflow-x-auto pb-2">
            <table className="w-full min-w-[420px] border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="w-16"></th>
                  {DAY_COLS.map((d) => (
                    <th
                      key={d.key}
                      className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="pr-3 text-right text-xs font-medium text-slate-400 whitespace-nowrap">
                      {row.label}
                    </td>
                    {DAY_COLS.map((d) => {
                      const active = selectedSlots.has(slotKey(d.key, row.key));
                      return (
                        <td key={d.key}>
                          <button
                            onClick={() => toggleSlot(d.key, row.key)}
                            aria-label={`${row.label} ${d.label}`}
                            className={`w-full aspect-square rounded-xl transition-all duration-200 ${
                              active
                                ? "bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.3)] ring-2 ring-teal-500 ring-offset-2 ring-offset-white"
                                : "bg-slate-100 hover:bg-slate-200"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <hr className="mb-6 border-slate-200/60" />

          {/* Deadline Toggle */}
          <label className="group flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200/60 bg-white/50 p-4 transition-colors hover:bg-white/80">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${hasDeadline ? 'bg-teal-50 text-teal-600' : 'bg-slate-50 text-slate-400'}`}>
                <Clock size={20} />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                I have a specific deadline
              </span>
            </div>
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasDeadline ? 'bg-teal-500' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasDeadline ? 'translate-x-6' : 'translate-x-1'}`} />
              <input
                type="checkbox"
                className="hidden"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
              />
            </div>
          </label>

          {/* Deadline Configuration */}
          <AnimatePresence>
            {hasDeadline && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4">
                  
                  {/* Date Picker */}
                  <div className="relative">
                    <input
                      type="date"
                      value={targetDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-400/10"
                    />
                    <CalendarIcon
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>

                  {distinctDays.size === 0 && (
                    <p className="text-xs font-medium text-amber-600 bg-amber-50 rounded-lg p-3">
                      Please select at least one time slot above to see your pacing.
                    </p>
                  )}

                  {suggestedLessonsPerWeek != null && (
                    <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            Pacing target
                          </p>
                          <p className="text-xs text-slate-500">
                            Lessons per week to hit your goal
                          </p>
                        </div>
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
                          className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-bold text-slate-700 outline-none transition-all focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                        />
                      </div>

                      {/* Warning if falling behind */}
                      {isFallingBehind && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-4 flex items-start gap-2.5 rounded-xl bg-orange-50 border border-orange-100 p-3"
                        >
                          <AlertCircle size={16} className="mt-0.5 shrink-0 text-orange-500" />
                          <p className="text-xs font-medium leading-relaxed text-orange-700">
                            With this pace, you might fall short of completing all {totalLessons} lessons by your deadline. Consider adding more slots!
                          </p>
                        </motion.div>
                      )}

                      {estimatedCompletionDate && (
                        <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                            <CalendarIcon size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Estimated Finish
                            </p>
                            <p className="text-xs font-bold text-slate-700">
                              {estimatedCompletionDate.toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="mt-4 text-center text-sm font-medium text-red-500">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {saving ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}