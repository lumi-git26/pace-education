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

// Sắp xếp lại thứ 2 đứng đầu theo đúng thiết kế của cậu
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
  
  // === UI & Logic States ===
  const [hasDeadline, setHasDeadline] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false); // Trạng thái đóng/mở Advanced
  
  const [targetDate, setTargetDate] = useState("");
  const [totalLessons, setTotalLessons] = useState<number | null>(null);
  
  // Mặc định luôn là 2 lessons / tuần
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number>(2); 
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Khóa body scroll
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Fetch số bài học
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

  // Tính ngày dự kiến hoàn thành
  const estimatedCompletionDate = useMemo(() => {
    if (!lessonsPerWeek || !totalLessons) return null;
    const weeksNeeded = Math.ceil(totalLessons / lessonsPerWeek);
    const d = new Date();
    d.setDate(d.getDate() + weeksNeeded * 7);
    return d;
  }, [lessonsPerWeek, totalLessons]);

  // Tính toán cảnh báo nếu bị chậm Deadline
  const isFallingBehind = useMemo(() => {
    if (!hasDeadline || !targetDate || !estimatedCompletionDate) return false;
    const target = new Date(targetDate);
    // Tính đến cuối ngày của deadline
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

  // Handle khi tích vào Checkbox Set Deadline
  function handleToggleDeadline() {
    const nextVal = !hasDeadline;
    setHasDeadline(nextVal);
    // Mở luôn Advanced Options nếu tích chọn
    if (nextVal) setShowAdvanced(true);
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

    // Upsert Learner preferences root (nếu cần)
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
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()} // ĐÃ FIX LỖI TẠI ĐÂY
          className="relative flex flex-col md:flex-row bg-white rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] md:max-h-[85vh] w-full max-w-fit mx-auto border border-line/50 custom-scrollbar"
        >
          {/* Nút tắt nhỏ góc trên bên trái màn nhỏ, hoặc ẩn trên md */}
          <button
            onClick={onClose}
            className="md:hidden absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 z-10"
          >
            <X size={16} />
          </button>

          {/* ======================= PANE TRÁI: GRID ======================= */}
          <div className="w-full md:w-[600px] shrink-0 p-6 md:p-10 flex flex-col relative bg-white">
            
            {/* Nút Toggle Advanced Settings */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`hidden md:flex absolute top-8 right-8 h-10 w-10 items-center justify-center rounded-full transition-colors ${
                showAdvanced ? "bg-amber-100 text-amber-600" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              }`}
              title="Advanced Pacing Options"
            >
              <Settings2 size={18} strokeWidth={2.5} />
            </button>

            <h2 className="font-serif text-2xl font-bold text-ink mb-8 md:mb-10 text-center">
              When do you want to study?
            </h2>

            {/* Time Slot Grid */}
            <div className="mb-10 overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full min-w-[460px] border-separate border-spacing-x-3 border-spacing-y-4">
                <thead>
                  <tr>
                    <th className="w-[100px]"></th>
                    {DAY_COLS.map((d) => (
                      <th
                        key={d.key}
                        className={`pb-2 text-[14px] font-bold ${
                          d.isWeekend ? "text-red-400" : "text-ink"
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
                      {/* Tiêu đề dòng (Morning, Afternoon...) */}
                      <td className="pr-3 text-left whitespace-nowrap align-middle">
                        <div className="text-[15px] font-bold text-amber-500 mb-0.5">
                          {row.label}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                          {row.time}
                        </div>
                      </td>
                      {/* Cột Checkbox */}
                      {DAY_COLS.map((d) => {
                        const active = selectedSlots.has(slotKey(d.key, row.key));
                        return (
                          <td key={d.key} className="align-middle">
                            <button
                              onClick={() => toggleSlot(d.key, row.key)}
                              aria-label={`${row.label} ${d.label}`}
                              className={`w-full aspect-square rounded-2xl transition-all duration-200 shadow-sm border ${
                                active
                                  ? "bg-amber-500 border-amber-500 shadow-amber-500/20"
                                  : "bg-slate-100 border-line/40 hover:bg-slate-200"
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

            {/* Deadline Checkbox (Giữa) */}
            <div className="flex justify-center mb-8">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className={`flex items-center justify-center transition-colors ${hasDeadline ? 'text-amber-500' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {hasDeadline ? (
                    <CheckSquare size={22} className="fill-amber-500 text-white rounded-md" />
                  ) : (
                    <Square size={22} className="border-slate-300 rounded-md" />
                  )}
                </div>
                <span className="text-[15px] font-medium text-ink">
                  Set a deadline to this course?
                </span>
                {/* Ẩn checkbox native đi */}
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
                className="w-[140px] rounded-full bg-[#5B5B5B] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#4A4A4A]"
              >
                Skip for now
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-[140px] rounded-full bg-black py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 disabled:opacity-60"
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
                className="border-t md:border-t-0 md:border-l border-line/60 bg-slate-50 overflow-hidden shrink-0"
              >
                <div className="w-full md:w-[320px] p-6 md:p-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-serif text-xl font-bold text-ink">
                      Advanced
                    </h3>
                    {/* Nút đóng Panel trên Desktop */}
                    <button 
                      onClick={() => setShowAdvanced(false)}
                      className="hidden md:flex text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-6 flex-1">
                    {/* Course Deadline */}
                    <div className={`transition-opacity duration-300 ${!hasDeadline ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                      <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                        Course Deadline
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={targetDate}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetDate(e.target.value)} // ĐÃ FIX LỖI TẠI ĐÂY
                          className="w-full appearance-none rounded-xl border border-line/80 bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                        />
                        <CalendarIcon
                          size={16}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                      </div>
                      {!hasDeadline && (
                        <p className="text-[11px] text-slate-500 mt-1.5 font-medium italic">
                          Check the box to set a deadline.
                        </p>
                      )}
                    </div>

                    {/* Lessons per week */}
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                        Pacing Target
                      </label>
                      <div className="rounded-xl border border-line/80 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-ink">
                            Lessons / week
                          </p>
                          <input
                            type="number"
                            min={1}
                            value={lessonsPerWeek}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setLessonsPerWeek(Math.max(1, Number(e.target.value)))
                            } // ĐÃ FIX LỖI TẠI ĐÂY
                            className="w-14 rounded-lg border border-line/60 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold text-amber-600 outline-none transition-all focus:border-amber-400 focus:bg-white"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                          You can study multiple lessons in a single time slot. Defaults to 2.
                        </p>
                      </div>
                    </div>

                    <hr className="border-line/60" />

                    {/* Estimated Completion & Warnings */}
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                        Estimated Completion
                      </label>
                      
                      {estimatedCompletionDate ? (
                        <div className="flex items-center gap-3 bg-white border border-line/50 p-4 rounded-xl shadow-sm">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isFallingBehind ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            <CalendarIcon size={18} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${isFallingBehind ? 'text-red-600' : 'text-emerald-600'}`}>
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
                        <div className="bg-slate-100 border border-line/50 p-4 rounded-xl text-center">
                          <p className="text-xs text-muted">Calculating...</p>
                        </div>
                      )}

                      {/* Cảnh báo chậm trễ */}
                      <AnimatePresence>
                        {isFallingBehind && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3 overflow-hidden"
                          >
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                            <p className="text-xs font-medium leading-relaxed text-red-700">
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