import { supabase } from "@/lib/supabase/client";

type AvailabilitySlot = { day: number; time: string };

// Picks `lessonsPerWeek` days out of the learner's chosen availability,
// spreading them out rather than clustering the first N chosen.
function pickSpacedDays(distinctDays: number[], lessonsPerWeek: number): number[] {
  const sorted = [...distinctDays].sort((a, b) => a - b);
  if (sorted.length <= lessonsPerWeek) return sorted;
  const step = sorted.length / lessonsPerWeek;
  const picked: number[] = [];
  for (let i = 0; i < lessonsPerWeek; i++) {
    picked.push(sorted[Math.floor(i * step)]);
  }
  return Array.from(new Set(picked));
}

/**
 * Generates one scheduled_tasks row per remaining (incomplete) lesson in
 * a course, placing them on the learner's chosen weekdays going forward,
 * one lesson per matching day, repeating weekly until all are scheduled.
 * Existing pending 'course' tasks for this course are cleared first, so
 * re-saving a preference doesn't create duplicates.
 */
export async function generateCourseSchedule(
  learnerId: string,
  courseId: string,
  availability: AvailabilitySlot[],
  lessonsPerWeek: number
) {
  if (availability.length === 0 || lessonsPerWeek < 1) return;

  const distinctDays = Array.from(new Set(availability.map((a) => a.day)));
  const chosenDays = pickSpacedDays(distinctDays, lessonsPerWeek);
  if (chosenDays.length === 0) return;

  const { data: units } = await supabase
    .from("units")
    .select("id, order_index, lessons(id, title, order_index, est_minutes)")
    .eq("course_id", courseId)
    .order("order_index");

  const allLessons = (units ?? [])
    .slice()
    .sort((a: any, b: any) => a.order_index - b.order_index)
    .flatMap((u: any) =>
      (u.lessons ?? [])
        .slice()
        .sort((a: any, b: any) => a.order_index - b.order_index)
    );

  const { data: completions } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("learner_id", learnerId);
  const completedIds = new Set((completions ?? []).map((c: any) => c.lesson_id));

  const remaining = allLessons.filter((l: any) => !completedIds.has(l.id));
  if (remaining.length === 0) return;

  // Clear any previously scheduled, not-yet-done course tasks for this
  // course, so changing preferences replaces the plan instead of stacking.
  await supabase
    .from("scheduled_tasks")
    .delete()
    .eq("learner_id", learnerId)
    .eq("course_id", courseId)
    .eq("type", "course")
    .eq("status", "pending");

  const chosenDaysSorted = [...chosenDays].sort((a, b) => a - b);
  const tasks: any[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1); // start tomorrow
  let lessonIdx = 0;
  let safety = 0;

  while (lessonIdx < remaining.length && safety < 400) {
    if (chosenDaysSorted.includes(cursor.getDay())) {
      const lesson = remaining[lessonIdx];
      tasks.push({
        learner_id: learnerId,
        type: "course",
        reference_id: lesson.id,
        course_id: courseId,
        scheduled_date: cursor.toISOString().slice(0, 10),
        estimated_minutes: lesson.est_minutes ?? 30,
        status: "pending",
      });
      lessonIdx++;
    }
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }

  if (tasks.length > 0) {
    await supabase.from("scheduled_tasks").insert(tasks);
  }
}