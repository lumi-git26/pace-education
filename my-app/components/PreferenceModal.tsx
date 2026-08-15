"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  Settings2, 
  CheckSquare, 
  Square 
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const TIME_ROWS = [
  { key: "morning", label: "Morning", time: "7:00 - 11:00" },
  { key: "afternoon", label: "Afternoon", time: "14:00 - 16:00" },
  { key: "evening", label: "Evening", time: "18:00 - 22:00" },
] as const;

const DAY_COLS = [
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat", isWeekend: true },
  { key: 0, label: "Sun", isWeekend: true },
];

type Slot = { day: number; time: string };

function slotKey(day: number, time: string) {
  return `${day}-${time}`;
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [targetDate, setTargetDate] = useState("");
  const [totalLessons, setTotalLessons] = useState<number | null>(null);
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number>(2); 
  
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
    return () => { cancelled = true; };
  }, [courseId]);

  const estimatedCompletionDate = useMemo(() => {
    if (!lessonsPerWeek || !totalLessons) return null;
    const weeksNeeded = Math.ceil(totalLessons / lessonsPerWeek);
    const d = new Date();
    d.setDate(d.getDate() + weeksNeeded * 7);
    return d;
  }, [lessonsPerWeek, totalLessons]);

  const isFallingBehind = useMemo(() => {
    if (!hasDeadline || !targetDate || !estimatedCompletionDate) return false;
    const target = new Date(targetDate);
    target.setHours(23, 59, 59, 999);
    return estimatedCompletionDate > target;
  }, [hasDeadline, targetDate, estimatedCompletionDate]);

  function toggleSlot(day: number, time: string) {
    const key = slotKey(day, time);
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleToggleDeadline() {
    const nextVal = !hasDeadline;
    setHasDeadline(nextVal);
    if (nextVal) setShowAdvanced(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

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

    const { error: insertErr } = await supabase.from("schedule_preferences").insert({
      learner_id: user.id,
      course_id: courseId,
      availability,
      target_date: hasDeadline && targetDate ? targetDate : null,
      lessons_per_week: lessonsPerWeek,
    });

    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
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
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          // Vibe Minimal: Nền giấy F9F9F8, shadow nhẹ, viền mỏng
          className="relative flex flex-col md:flex-row bg-[#F9F9F8] rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden max-h-[90vh] md:max-h-[85vh] w-full max-w-fit mx-auto border border-line/60 custom-scrollbar"
        >
          {/* Nút tắt Mobile */}
          <button
            onClick={onClose}
            className="md:hidden absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-line/50 text-muted z-10"
          >
            <X size={16} />
          </button>

          {/* ======================= PANE TRÁI: GRID ======================= */}
          <div className="w-full md:w-[620px] shrink-0 p-6 md:p-10 flex flex-col relative bg-transparent">
            
            {/* Toggle Advanced Button */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`hidden md:flex absolute top-8 right-8 h-10 w-10 items-center justify-center rounded-full transition-colors border ${
                showAdvanced 
                  ? "bg-[#F2994A]/10 text-[#F2994A] border-[#F2994A]/20" 
                  : "bg-white text-muted border-line/50 hover:bg-slate-50"
              }`}
              title="Advanced Settings"
            >
              <Settings2 size={18} strokeWidth={2.5} />
            </button>

            <h2 className="font-serif text-[28px] font-bold text-ink mb-10 text-center">
              When do you want to study?
            </h2>

            {/* Time Slot Grid */}
            <div className="mb-10 overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full min-w-[500px] border-separate border-spacing-y-4">
                <thead>
                  <tr>
                    <th className="w-[110px]"></th>
                    {DAY_COLS.map((d) => (
                      <th
                        key={d.key}
                        // Set width cố định cho header để bảng ko bị bóp
                        className={`w-[52px] pb-3 text-[14px] font-bold text-center ${
                          d.isWeekend ? "text-[#E07A5F]" : "text-ink"
                        }`}
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="pr-4 text-left align-middle">
                        <div className="text-[15px] font-bold text-[#F2994A] mb-0.5">
                          {row.label}
                        </div>
                        <div className="text-[11px] font-medium text-muted">
                          {row.time}
                        </div>
                      </td>
                      {DAY_COLS.map((d) => {
                        const active = selectedSlots.has(slotKey(d.key, row.key));
                        return (
                          <td key={d.key} className="align-middle text-center">
                            <button
                              onClick={() => toggleSlot(d.key, row.key)}
                              aria-label={`${row.label} ${d.label}`}
                              // Kích thước vuông vức cố định (w-11 h-11), ko dùng w-full nữa
                              className={`w-11 h-11 mx-auto rounded-[14px] transition-all duration-200 border ${
                                active
                                  ? "bg-[#F2994A] border-[#F2994A]"
                                  : "bg-white border-line/60 hover:bg-slate-50"
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

            {/* Deadline Checkbox */}
            <div className="flex justify-center mb-10">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`flex items-center justify-center transition-colors ${hasDeadline ? 'text-[#F2994A]' : 'text-muted group-hover:text-ink'}`}>
                  {hasDeadline ? (
                    <CheckSquare size={20} className="fill-[#F2994A] text-white rounded-[4px]" />
                  ) : (
                    <Square size={20} className="border-line rounded-[4px]" />
                  )}
                </div>
                <span className="text-[15px] font-medium text-ink">
                  Set a deadline to this course?
                </span>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={hasDeadline}
                  onChange={handleToggleDeadline}
                />
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mt-auto">
              <button
                onClick={onClose}
                className="w-[140px] rounded-full bg-white border border-line py-3.5 text-sm font-semibold text-muted transition-colors hover:bg-slate-50 hover:text-ink"
              >
                Skip for now
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-[140px] rounded-full bg-ink py-3.5 text-sm font-semibold text-white transition-all hover:bg-ink/80 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Done"}
              </button>
            </div>
          </div>

          {/* ======================= PANE PHẢI: ADVANCED OPTIONS ======================= */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                // Vibe minimal: Cùng màu nền, ngăn cách bằng đường kẻ mỏng
                className="border-t md:border-t-0 md:border-l border-line/60 bg-transparent overflow-hidden shrink-0"
              >
                <div className="w-full md:w-[340px] p-6 md:p-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="font-serif text-[22px] font-bold text-ink">
                      Advanced
                    </h3>
                    <button 
                      onClick={() => setShowAdvanced(false)}
                      className="hidden md:flex text-muted hover:text-ink transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-8 flex-1">
                    {/* Course Deadline */}
                    <div className={`transition-opacity duration-300 ${!hasDeadline ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-3">
                        Course Deadline
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={targetDate}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetDate(e.target.value)}
                          className="w-full appearance-none rounded-xl border border-line/80 bg-white px-4 py-3.5 text-sm font-medium text-ink outline-none transition-all focus:border-[#F2994A]"
                        />
                        <CalendarIcon
                          size={16}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Lessons per week */}
                    <div>
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-3">
                        Pacing Target
                      </label>
                      <div className="rounded-xl border border-line/80 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[14px] font-medium text-ink">
                            Lessons / week
                          </p>
                          <div className="flex items-center border border-[#F2994A]/40 rounded-lg overflow-hidden bg-[#F9F9F8]">
                            <input
                              type="number"
                              min={1}
                              value={lessonsPerWeek}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setLessonsPerWeek(Math.max(1, Number(e.target.value)))
                              }
                              className="w-12 py-1.5 text-center text-sm font-bold text-[#F2994A] bg-transparent outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted mt-3 leading-relaxed">
                          You can study multiple lessons in a single time slot. Defaults to 2.
                        </p>
                      </div>
                    </div>

                    <hr className="border-dashed border-line/80" />

                    {/* Estimated Completion & Warnings */}
                    <div>
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-3">
                        Estimated Completion
                      </label>
                      
                      {estimatedCompletionDate ? (
                        <div className="flex items-center gap-3 bg-white border border-line/80 p-4 rounded-xl">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${isFallingBehind ? 'bg-red-50 text-[#E07A5F]' : 'bg-[#E8F3EC] text-[#2A9D8F]'}`}>
                            <CalendarIcon size={18} />
                          </div>
                          <div>
                            <p className={`text-[15px] font-bold ${isFallingBehind ? 'text-[#E07A5F]' : 'text-[#2A9D8F]'}`}>
                              {estimatedCompletionDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-[11px] font-medium text-muted">
                              Based on {lessonsPerWeek} lessons/wk
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white/50 border border-dashed border-line/80 p-4 rounded-xl text-center">
                          <p className="text-[12px] text-muted">Calculating...</p>
                        </div>
                      )}

                      {/* Cảnh báo chậm trễ */}
                      <AnimatePresence>
                        {isFallingBehind && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="flex items-start gap-2.5 rounded-xl bg-red-50/50 border border-[#E07A5F]/30 p-3 overflow-hidden"
                          >
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#E07A5F]" />
                            <p className="text-[12px] leading-relaxed text-[#E07A5F]">
                              Warning: This pace might miss your deadline. Consider increasing your weekly lessons.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}