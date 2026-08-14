"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Target,
  BookOpen,
  Award,
  Flame,
  LineChart,
  Users,
  Video,
  ArrowUpRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";

type EnrolledCourse = { id: string; title: string; progress: number };
type NextLesson = {
  courseId: string;
  courseTitle: string;
  unitId: string;
  lessonId: string;
  lessonTitle: string;
};
type Goal = { title: string; daysLeft: number };
type HeatmapDay = { date: Date; level: 0 | 1 | 2 | 3; hours: number };
type WeekBarData = { dayLabel: string; hours: number; fullDate: string };

type ClassroomInfo = {
  id: string;
  title: string;
  subjectCode: string | null;
  cohortLabel: string | null;
  meetingLink: string | null;
  teacherName: string;
  latestAnnouncement: {
    title: string | null;
    body: string;
    type: string;
  } | null;
};

type ScheduledTask = {
  id: string;
  scheduled_date: string;
  type: string;
  reference_id: string;
  course_id: string;
  estimated_minutes: number;
  status: string;
  courses: { title: string } | null;
};

function getNext7Days() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const dayStrings = new Set(dates.map((d) => new Date(d).toDateString()));
  let streak = 0;
  const cursor = new Date();
  if (!dayStrings.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayStrings.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function levelFromSeconds(totalSeconds: number): 0 | 1 | 2 | 3 {
  const minutes = totalSeconds / 60;
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 60) return 2;
  return 3;
}

export default function PersonalPage() {
  const { profile } = useProfile();
  const router = useRouter();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [nextLessons, setNextLessons] = useState<NextLesson[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomInfo[]>([]);
  const [totalClassrooms, setTotalClassrooms] = useState(0);

  const [passedCount, setPassedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [avgGrade, setAvgGrade] = useState<number | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [weekBars, setWeekBars] = useState<WeekBarData[]>([]);

  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isGoalVisible, setIsGoalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  
  const [tasksByDay, setTasksByDay] = useState<Record<string, ScheduledTask[]>>({});

  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // --- Enrollments + progress ---
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("progress_pct, courses(id, title)")
        .eq("learner_id", user.id)
        .eq("status", "active");

      const mapped: EnrolledCourse[] = (enrollments ?? [])
        .filter((e: any) => e.courses)
        .map((e: any) => ({
          id: e.courses.id,
          title: e.courses.title,
          progress: Math.round(e.progress_pct ?? 0),
        }));
      if (cancelled) return;
      setCourses(mapped);

      // --- Continue learning (Tối đa 3 bài học) ---
      const inProgressCourses = mapped.filter((c) => c.progress < 100).slice(0, 3);
      const loadedNextLessons: NextLesson[] = [];

      if (inProgressCourses.length > 0) {
        const { data: completions } = await supabase
          .from("lesson_completions")
          .select("lesson_id")
          .eq("learner_id", user.id);

        const completedIds = new Set(
          (completions ?? []).map((c: any) => c.lesson_id)
        );

        for (const ipc of inProgressCourses) {
          const { data: units } = await supabase
            .from("units")
            .select("id, order_index, lessons(id, title, order_index)")
            .eq("course_id", ipc.id)
            .order("order_index");

          let lessonFound = false;
          for (const unit of units ?? []) {
            const lessons = (unit.lessons ?? [])
              .slice()
              .sort((a: any, b: any) => a.order_index - b.order_index);
            
            for (const lesson of lessons) {
              if (!completedIds.has(lesson.id)) {
                loadedNextLessons.push({
                  courseId: ipc.id,
                  courseTitle: ipc.title,
                  unitId: unit.id,
                  lessonId: lesson.id,
                  lessonTitle: lesson.title,
                });
                lessonFound = true;
                break;
              }
            }
            if (lessonFound) break;
          }
        }
      }
      if (!cancelled) setNextLessons(loadedNextLessons);

      // --- Tests passed & Streak & Goal ---
      const { data: passed } = await supabase
        .from("submissions")
        .select("id")
        .eq("learner_id", user.id)
        .eq("submission_type", "unit_final")
        .eq("passed", true);
      if (!cancelled) setPassedCount(passed?.length ?? 0);

      const { data: allCompletions } = await supabase
        .from("lesson_completions")
        .select("completed_at")
        .eq("learner_id", user.id);
      if (!cancelled) {
        setStreak(
          computeStreak((allCompletions ?? []).map((c: any) => c.completed_at))
        );
      }

      const { data: goalRow } = await supabase
        .from("learning_goals")
        .select("title, target_date")
        .eq("learner_id", user.id)
        .order("target_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!cancelled && goalRow) {
        const daysLeft = Math.max(
          0,
          Math.ceil(
            (new Date(goalRow.target_date).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        );
        setGoal({ title: goalRow.title, daysLeft });
      }

      // --- Insights ---
      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 27);
      twentyEightDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentSubmissions } = await supabase
        .from("submissions")
        .select("submitted_at, time_spent_secs, score, submission_type")
        .eq("learner_id", user.id)
        .gte("submitted_at", twentyEightDaysAgo.toISOString());

      if (!cancelled) {
        const rows = recentSubmissions ?? [];
        const scored = rows.filter(
          (r: any) => r.score != null && r.submission_type === "unit_final"
        );
        setAvgGrade(
          scored.length > 0
            ? Math.round(
                (scored.reduce((s: number, r: any) => s + r.score, 0) /
                  scored.length) * 10
              ) / 10
            : null
        );

        const secondsByDay: Record<string, number> = {};
        rows.forEach((r: any) => {
          const key = new Date(r.submitted_at).toDateString();
          secondsByDay[key] = (secondsByDay[key] ?? 0) + (r.time_spent_secs ?? 0);
        });

        const days: HeatmapDay[] = [];
        for (let i = 0; i < 28; i++) {
          const d = new Date();
          d.setDate(d.getDate() - (27 - i));
          const key = d.toDateString();
          const secs = secondsByDay[key] ?? 0;
          days.push({ date: d, level: levelFromSeconds(secs), hours: secs / 3600 });
        }
        setHeatmap(days);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() - daysSinceMonday);

        const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
        const thisWeekBars: WeekBarData[] = [];

        for (let i = 0; i < 7; i++) {
          const d = new Date(currentMonday);
          d.setDate(currentMonday.getDate() + i);
          const key = d.toDateString();
          const secs = secondsByDay[key] ?? 0;
          thisWeekBars.push({
            dayLabel: dayLabels[i],
            hours: Math.round((secs / 3600) * 10) / 10,
            fullDate: key
          });
        }
        setWeekBars(thisWeekBars);

        setActiveDays(
          new Set(Object.keys(secondsByDay).filter((key) => secondsByDay[key] > 0))
        );
      }

      // --- Scheduled Tasks ---
      const { data: upcomingTasks } = await supabase
        .from("scheduled_tasks")
        .select("id, scheduled_date, type, reference_id, course_id, estimated_minutes, status, courses(title)")
        .eq("learner_id", user.id)
        .eq("status", "pending")
        .order("scheduled_date");

      if (!cancelled) {
        const grouped: Record<string, any[]> = {};
        (upcomingTasks ?? []).forEach((t: any) => {
          const key = new Date(t.scheduled_date).toDateString();
          grouped[key] = grouped[key] ?? [];
          grouped[key].push(t);
        });
        setTasksByDay(grouped);
      }

      // --- Classrooms (Lấy nhiều lớp, hiển thị tối đa 2 lớp) ---
      const { data: membership, count: classCount } = await supabase
        .from("classroom_members")
        .select(
          "classrooms(id, title, subject_code, cohort_label, meeting_link, teacher_id, profiles(full_name))",
          { count: "exact" }
        )
        .eq("learner_id", user.id)
        .eq("status", "active");
        // FIX: Đã xóa lệnh .order("created_at") gây lỗi ngầm ở đây

      if (!cancelled && membership) {
        setTotalClassrooms(classCount ?? membership.length);
        const loadedClasses: ClassroomInfo[] = [];

        // Đảo ngược mảng bằng JS để đẩy lớp mới nhất lên đầu thay vì dùng SQL Order
        const reversed = [...membership].reverse();

        for (let i = 0; i < reversed.length; i++) {
          const c: any = reversed[i].classrooms;
          if (!c) continue;

          let latestPost = null;
          // Chỉ lấy Announcements cho 2 lớp học hiển thị trên UI để tiết kiệm tài nguyên
          if (i < 2) {
            const { data } = await supabase
              .from("classroom_announcements")
              .select("title, body, type")
              .eq("classroom_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            latestPost = data;
          }

          loadedClasses.push({
            id: c.id,
            title: c.title,
            subjectCode: c.subject_code,
            cohortLabel: c.cohort_label,
            meetingLink: c.meeting_link,
            teacherName: c.profiles?.full_name ?? "Instructor",
            latestAnnouncement: latestPost ?? null,
          });
        }
        setClassrooms(loadedClasses);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!goal) return;
    const showTimer = setTimeout(() => {
      setIsGoalVisible(true);
      const hideTimer = setTimeout(() => setIsGoalVisible(false), 5000);
      return () => clearTimeout(hideTimer);
    }, 800);
    return () => clearTimeout(showTimer);
  }, [goal]);

  const scheduleDays = getNext7Days();
  const currentWeekTotal = weekBars.reduce((sum, b) => sum + b.hours, 0).toFixed(1);
  const maxWeekHour = Math.max(1, ...weekBars.map((b) => b.hours));

  return (
    <div className="relative min-h-screen w-full px-8 py-12 lg:px-16 overflow-y-auto overflow-x-hidden">
      {/* ============ DYNAMIC ISLAND ============ */}
      <AnimatePresence>
        {isGoalVisible && goal && (
          <motion.div
            key="goal-toast"
            initial={{ opacity: 0, y: -40, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed top-8 left-1/2 z-[100] pointer-events-none"
          >
            <div className="flex items-center gap-4 bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-full px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <Target size={14} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col pr-2">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                  {goal.title}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif font-bold text-lg text-ink leading-none">
                    {goal.daysLeft}
                  </span>
                  <span className="text-[11px] font-medium text-ink/70">
                    days left
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ HEADER ============ */}
      <div className="mb-10">
        <h1 className="font-serif text-[36px] font-semibold text-ink mb-3">
          Hi, {firstName}
        </h1>
        <div className="flex items-center gap-6 text-sm font-medium text-muted">
          <div className="flex items-center gap-2">
            <BookOpen size={16} /> {loading ? "—" : courses.length} Enrolled
          </div>
          <div className="flex items-center gap-2">
            <Award size={16} /> {loading ? "—" : passedCount} Passed
          </div>
          <div className="flex items-center gap-2 text-accent">
            <Flame size={16} /> {loading ? "—" : streak} Day Streak
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* ============ LEFT COLUMN ============ */}
        <div className="space-y-6">
          
          {/* --- 1. ACTIVE CLASSROOMS --- */}
          {loading ? (
            <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
              <div className="h-32 animate-pulse rounded-xl bg-line/40" />
            </div>
          ) : classrooms.length > 0 ? (
            <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6 flex flex-col gap-6">
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-wider">
                <Users size={14} /> Active Classrooms
              </h3>

              <div className="flex flex-col gap-6">
                {classrooms.slice(0, 2).map((cls, idx) => (
                  <div key={cls.id} className={idx > 0 ? "pt-6 border-t border-line/60" : ""}>
                    <div className="flex flex-col md:flex-row gap-5">
                      {/* Left: Info Card */}
                      <div
                        onClick={() => router.push(`/personal/classroom/${cls.id}`)}
                        className="flex-1 rounded-xl bg-white/40 border border-white p-5 hover:bg-white/60 transition-colors cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
                              <span className="font-serif font-bold text-lg">
                                {cls.subjectCode?.slice(0, 2).toUpperCase() ?? "CL"}
                              </span>
                            </div>
                            <div>
                              {cls.subjectCode && (
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                                  {cls.subjectCode}
                                </p>
                              )}
                              <p className="text-[15px] font-semibold text-ink leading-tight group-hover:text-indigo-600 transition-colors">
                                {cls.title}
                              </p>
                            </div>
                          </div>
                          {cls.cohortLabel && (
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0">
                              {cls.cohortLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-line/50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center text-[10px] font-bold text-ink/70">
                              {cls.teacherName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-[9px] text-muted uppercase tracking-wider font-bold mb-0.5">
                                Lecturer
                              </p>
                              <p className="text-[12px] font-semibold text-ink">
                                {cls.teacherName}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/personal/classroom/${cls.id}#message`);
                            }}
                            className="text-muted hover:text-indigo-600 transition-colors"
                          >
                            <MessageSquare size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="w-full md:w-[240px] flex flex-col gap-3">
                        {cls.meetingLink ? (
                          <a
                            href={cls.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between w-full rounded-xl bg-ink text-white p-4 hover:bg-indigo-600 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <Video size={16} className="text-white/70 group-hover:text-white" />
                              <span className="text-[13px] font-semibold">Join Class Meet</span>
                            </div>
                            <ArrowUpRight size={14} className="opacity-50 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <div className="flex items-center justify-between w-full rounded-xl bg-line/40 text-muted p-4 opacity-60 cursor-not-allowed">
                            <div className="flex items-center gap-3">
                              <Video size={16} />
                              <span className="text-[13px] font-semibold">No meeting link yet</span>
                            </div>
                          </div>
                        )}

                        <div className="flex-1 rounded-xl border border-dashed border-line/80 bg-[#F9F9F8] p-4 flex flex-col justify-center relative overflow-hidden group hover:border-indigo-200 transition-colors">
                          {cls.latestAnnouncement ? (
                            <>
                              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                {cls.latestAnnouncement.type === "homework"
                                  ? "Homework"
                                  : cls.latestAnnouncement.type === "material"
                                  ? "New Material"
                                  : "Latest Announcement"}
                              </p>
                              <p className="text-[12px] text-ink/80 leading-relaxed line-clamp-3 font-medium">
                                {cls.latestAnnouncement.body}
                              </p>
                            </>
                          ) : (
                            <p className="text-[12px] text-muted leading-relaxed">
                              No announcements yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* View More Button */}
              {totalClassrooms > 2 && (
                <button 
                  onClick={() => router.push('/personal/classrooms')}
                  className="w-full text-center mt-2 pt-4 border-t border-line/40 text-[13px] font-semibold text-muted hover:text-accent transition-colors"
                >
                  View all {totalClassrooms} classes
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-wider mb-5">
                <Users size={14} /> Active Classrooms
              </h3>
              
              <div className="rounded-xl border border-dashed border-line/80 bg-[#F9F9F8] p-8 flex flex-col items-center justify-center text-center transition-colors hover:border-indigo-200">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 mb-4 shadow-sm">
                  <Users size={20} />
                </div>
                <p className="text-[14px] font-semibold text-ink mb-1.5">No active classes</p>
                <p className="text-[12px] text-muted mb-5 max-w-[260px] leading-relaxed">
                  Join an instructor-led cohort to get live sessions, peer interactions, and the latest announcements.
                </p>
                <button
                  onClick={() => router.push("/explore")}
                  className="rounded-lg bg-ink text-white px-5 py-2.5 text-[12px] font-medium hover:bg-indigo-600 transition-colors shadow-sm"
                >
                  Explore Classes
                </button>
              </div>
            </div>
          )}

          {/* --- 2. CONTINUE LEARNING (Hiện max 3 cái) --- */}
          <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
            <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-4">
              Continue learning
            </h3>
            {loading ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-xl bg-line/40" />
                <div className="h-16 animate-pulse rounded-xl bg-line/40" />
              </div>
            ) : nextLessons.length > 0 ? (
              <div className="flex flex-col gap-3">
                {nextLessons.map((lesson) => (
                  <div
                    key={lesson.courseId}
                    onClick={() =>
                      router.push(`/courses/${lesson.courseId}/${lesson.unitId}/${lesson.lessonId}`)
                    }
                    className="group flex items-center justify-between gap-4 rounded-xl bg-accent/5 hover:bg-accent/10 transition-all duration-300 p-4 border border-accent/10 cursor-pointer"
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-1 line-clamp-1">
                        {lesson.courseTitle}
                      </p>
                      <p className="text-[15px] font-semibold text-ink line-clamp-1">
                        {lesson.lessonTitle}
                      </p>
                    </div>
                    <button className="flex items-center gap-2 bg-ink text-white group-hover:bg-accent group-hover:scale-105 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300 shrink-0 shadow-sm pointer-events-none">
                      <PlayCircle size={16} /> Resume
                    </button>
                  </div>
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted mb-3">
                  You haven&apos;t enrolled in any courses yet.
                </p>
                <button
                  onClick={() => router.push("/explore")}
                  className="rounded-lg bg-ink text-white px-5 py-2 text-sm font-medium hover:bg-ink/80 transition-colors"
                >
                  Explore courses
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4 border border-green-100">
                <CheckCircle2 className="text-green-600" size={18} />
                <p className="text-sm font-medium text-ink">
                  You&apos;re all caught up! Take a break.
                </p>
              </div>
            )}
          </div>

          {/* --- 3. SELF-PACED COURSES (Hiện max 3 cái) --- */}
          <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
            <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-5">
              Self-paced Courses
            </h3>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-line/40" />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <p className="text-sm text-muted">No active courses yet.</p>
            ) : (
              <>
                <div className="space-y-5">
                  {courses.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/courses/${c.id}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-ink group-hover:text-accent transition-colors truncate pr-4">
                          {c.title}
                        </span>
                        <span className="text-xs font-bold text-muted group-hover:text-accent transition-colors">
                          {c.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-line/60 rounded-full h-1.5 overflow-hidden shadow-inner">
                        <div
                          className="bg-accent h-1.5 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
                {/* View More Button */}
                {courses.length > 3 && (
                  <button 
                    onClick={() => router.push('/personal/courses')}
                    className="w-full text-center mt-5 pt-4 border-t border-line/40 text-[13px] font-semibold text-muted hover:text-accent transition-colors"
                  >
                    View all {courses.length} courses
                  </button>
                )}
              </>
            )}
          </div>

        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="space-y-6">
          
          {/* ================= SCHEDULE WIDGET ================= */}
          <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-ink mb-5">
              <CalendarIcon size={16} /> Schedule
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-6">
              {isMounted
                ? scheduleDays.map((d) => {
                    const isSelected =
                      selectedDate && d.toDateString() === selectedDate.toDateString();
                    const dayKey = d.toDateString();
                    const hasTasks = (tasksByDay[dayKey]?.length ?? 0) > 0;
                    const hasPastActivity = activeDays.has(dayKey);
                    
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => setSelectedDate(d)}
                        className={[
                          "relative flex flex-col items-center gap-1 rounded-xl py-2.5 text-center transition-colors duration-200 cursor-pointer",
                          isSelected
                            ? "bg-ink text-white shadow-sm"
                            : "hover:bg-white/60 text-ink/70"
                        ].join(" ")}
                      >
                        <span className={`text-[10px] uppercase font-semibold ${
                          isSelected 
                            ? 'opacity-90' 
                            : isWeekend 
                              ? 'text-red-500 opacity-100' 
                              : 'opacity-70'
                        }`}>
                          {d.toLocaleDateString("en-US", { weekday: "short" }).charAt(0)}
                        </span>
                        <span className="text-[14px] font-bold">{d.getDate()}</span>
                        
                        {(hasTasks || hasPastActivity) && (
                          <span
                            className={[
                              "absolute bottom-1 w-1 h-1 rounded-full",
                              isSelected ? "bg-white" : "bg-red-500",
                            ].join(" ")}
                          />
                        )}
                      </button>
                    );
                  })
                : Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="rounded-xl h-[52px] bg-line/20 animate-pulse" />
                  ))}
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider">
                {selectedDate?.toDateString() === new Date().toDateString()
                  ? "Today's Agenda"
                  : selectedDate?.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
              </h4>
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedDate?.toDateString()}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2.5"
                >
                  {selectedDate &&
                  (tasksByDay[selectedDate.toDateString()]?.length ?? 0) > 0 ? (
                    tasksByDay[selectedDate.toDateString()].map((t: any) => {
                      const isCourse = t.type === "course";
                      const isReview = t.type === "review";
                      const isClass = t.type === "class";
                      
                      const TaskIcon = isCourse ? BookOpen : isReview ? Sparkles : Video;
                      
                      const iconBg = isCourse 
                        ? "bg-accent/10 text-accent" 
                        : isReview 
                        ? "bg-orange-50 text-orange-500" 
                        : "bg-indigo-50 text-indigo-500";
                  
                      const foundClass = classrooms.find(c => c.id === t.reference_id);
                      const title = isCourse 
                        ? t.courses?.title ?? "Lesson" 
                        : isReview 
                        ? "Spaced Repetition" 
                        : isClass && foundClass?.title
                        ? foundClass.title
                        : "Live Class";
                  
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            if (isCourse && t.course_id) {
                              router.push(`/courses/${t.course_id}`);
                            }
                            if (isClass && t.reference_id) {
                              router.push(`/personal/classroom/${t.reference_id}`);
                            }
                          }}
                          className="group flex items-center justify-between p-4 rounded-[16px] bg-white/60 border border-white/80 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] backdrop-blur-md cursor-pointer hover:bg-white/90 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${iconBg}`}>
                              <TaskIcon size={18} strokeWidth={2.5} />
                            </div>
                            <div className="text-left flex flex-col justify-center min-h-[40px]">
                              <p className="text-[14px] font-semibold text-ink leading-tight mb-1 group-hover:text-accent transition-colors line-clamp-1">
                                {title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider">
                                <span>{t.estimated_minutes} min</span>
                                <span className="w-1 h-1 rounded-full bg-line/80" />
                                <span>{t.type}</span>
                              </div>
                            </div>
                          </div>
                          <button className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-ink/5 text-ink/40 group-hover:bg-accent group-hover:text-white transition-colors duration-300">
                            <PlayCircle size={16} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-line/80 bg-[#F9F9F8] p-5 text-center">
                      <p className="text-[12px] text-muted leading-relaxed">
                        No tasks scheduled for this day.
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          {/* ==================================================================== */}

          {/* Insights */}
          <div 
            onClick={() => router.push('/personal/insights')} 
            className="group rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6 cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-wider">
                <LineChart size={14} /> Insights
              </h3>
              <ArrowUpRight 
                size={16} 
                className="text-accent opacity-0 translate-y-1 -translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300 ease-out" 
              />
            </div>

            <div className="grid grid-cols-2 gap-5 mb-6">
              <div>
                <p className="text-[10px] font-semibold text-muted uppercase mb-1">
                  Hours (This week)
                </p>
                <p className="font-serif text-xl font-bold text-ink mb-2">
                  {loading ? "—" : currentWeekTotal}
                </p>
                
                <div className="flex flex-col gap-1.5 mt-auto">
                  <div className="flex items-end h-8 gap-1.5">
                    {weekBars.map((bar, i) => (
                      <div
                        key={i}
                        title={`${bar.hours}h - ${new Date(bar.fullDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`}
                        className="flex-1 bg-accent/30 rounded-[3px] group-hover:bg-accent transition-colors duration-500 relative"
                        style={{
                          height: `${(bar.hours / maxWeekHour) * 100}%`,
                          minHeight: "4px",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {weekBars.map((bar, i) => (
                      <div key={i} className="flex-1 text-center text-[8px] font-bold text-muted uppercase leading-none opacity-80">
                        {bar.dayLabel}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted uppercase mb-1">
                  Avg Score
                </p>
                <p className="font-serif text-xl font-bold text-ink mb-2">
                  {loading ? "—" : avgGrade ?? "—"}
                </p>
                {avgGrade == null && !loading && (
                  <p className="text-[10px] text-muted">
                    No scored submissions yet
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-line/60">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-muted font-medium">
                  Activity Stream
                </span>
                <div className="flex gap-1 items-center opacity-70">
                  <div className="w-[10px] h-[10px] rounded-[2px] bg-line/40" />
                  <div className="w-[10px] h-[10px] rounded-[2px] bg-accent/40" />
                  <div className="w-[10px] h-[10px] rounded-[2px] bg-accent/70" />
                  <div className="w-[10px] h-[10px] rounded-[2px] bg-accent" />
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 pointer-events-none">
                {isMounted && !loading
                  ? heatmap.map((d, i) => (
                      <div
                        key={i}
                        className="w-full aspect-square"
                      >
                        <div
                          className={[
                            "w-full h-full rounded-[4px] transition-all",
                            d.level === 0
                              ? "bg-line/40"
                              : d.level === 1
                              ? "bg-accent/40"
                              : d.level === 2
                              ? "bg-accent/70"
                              : "bg-accent",
                          ].join(" ")}
                        />
                      </div>
                    ))
                  : Array.from({ length: 28 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-full aspect-square rounded-[4px] bg-line/20 animate-pulse"
                      />
                    ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}