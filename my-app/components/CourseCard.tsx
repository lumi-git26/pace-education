import Link from "next/link";

export type CourseCardData = {
  id: string;
  title: string;
  publisherName: string;
  lessonCount: number;
  hoursToComplete: number;
};

// Deterministic pastel accent per course so cards don't all look identical
// before real illustrations are wired in.
const ACCENTS = ["#F2994A", "#6FB1D6", "#8FC9A9", "#D68FB0", "#C9A6E0"];

function accentFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export default function CourseCard({ course }: { course: CourseCardData }) {
  const accent = accentFor(course.id);

  return (
    <Link
      href={`/personal/${course.id}`}
      className="group relative block h-56 overflow-hidden rounded-card border border-line bg-surface transition-shadow hover:shadow-md"
    >
      <div
        className="absolute inset-y-0 right-0 w-2/3 rounded-r-card"
        style={{
          background: `radial-gradient(120% 120% at 100% 0%, ${accent} 0%, ${accent}CC 60%, ${accent}00 100%)`,
        }}
      />
      <div
        className="absolute inset-0 rounded-card"
        style={{
          background:
            "linear-gradient(90deg, #FFFFFF 35%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0) 75%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-6">
        <div>
          <h3 className="font-serif text-2xl font-semibold leading-tight text-ink">
            {course.title}
          </h3>
          <p className="mt-1 text-sm text-muted">by {course.publisherName}</p>
        </div>
        <div className="space-y-1 text-sm text-ink/80">
          <p>{course.lessonCount} lessons</p>
          <p>{course.hoursToComplete}h to complete</p>
        </div>
      </div>
    </Link>
  );
}