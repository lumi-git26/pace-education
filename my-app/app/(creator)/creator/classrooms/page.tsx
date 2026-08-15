"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Plus, Users, X } from "lucide-react";

type ClassroomRow = {
  id: string;
  title: string;
  subject_code: string | null;
  cohort_label: string | null;
  status: string;
  memberCount: number;
};

export default function CreatorClassroomsPage() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("classrooms")
        .select("id, title, subject_code, cohort_label, status, classroom_members(id)")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setClassrooms(
          (data ?? []).map((c: any) => ({
            id: c.id,
            title: c.title,
            subject_code: c.subject_code,
            cohort_label: c.cohort_label,
            status: c.status,
            memberCount: c.classroom_members?.length ?? 0,
          }))
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [showCreate]);

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="font-serif text-3xl font-semibold text-ink">
          Your Classrooms
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-ink text-white rounded-pill px-5 py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          <Plus size={16} /> New Classroom
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[24px] bg-line/40" />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line/60 bg-white/40 p-14 text-center">
          <Users size={28} className="mx-auto mb-4 text-muted" />
          <p className="font-serif text-xl font-semibold text-ink mb-2">
            No classrooms yet
          </p>
          <p className="text-sm text-muted">
            Create one to start hosting live sessions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/creator/classrooms/${c.id}`)}
              className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                {c.subject_code && (
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    {c.subject_code}
                  </span>
                )}
                <span
                  className={[
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full",
                    c.status === "published"
                      ? "bg-green-100 text-green-700"
                      : "bg-line/40 text-muted",
                  ].join(" ")}
                >
                  {c.status}
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-ink mb-2 line-clamp-2">
                {c.title}
              </h3>
              <p className="text-xs text-muted">{c.memberCount} students</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClassroomModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function CreateClassroomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [cohortLabel, setCohortLabel] = useState("");
  const [description, setDescription] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [scheduleSummary, setScheduleSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
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

    const { data, error: insertErr } = await supabase
      .from("classrooms")
      .insert({
        teacher_id: user.id,
        title,
        subject_code: subjectCode || null,
        cohort_label: cohortLabel || null,
        description: description || null,
        meeting_link: meetingLink || null,
        schedule_summary: scheduleSummary || null,
        status: "draft",
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    router.push(`/creator/classrooms/${data.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] bg-paper shadow-2xl p-7 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5"
        >
          <X size={16} />
        </button>

        <h2 className="font-serif text-2xl font-bold text-ink mb-6">
          New Classroom
        </h2>

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Personal Finance Management)"
            className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder="Subject code (FIN1)"
              className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <input
              value={cohortLabel}
              onChange={(e) => setCohortLabel(e.target.value)}
              placeholder="Cohort (FTU K63)"
              className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent resize-none"
          />
          <input
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="Meeting link (Google Meet / Zoom)"
            className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <input
            value={scheduleSummary}
            onChange={(e) => setScheduleSummary(e.target.value)}
            placeholder="Schedule (e.g. Mon & Wed, 7-9pm)"
            className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full mt-6 rounded-pill bg-ink text-white py-3.5 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create classroom"}
        </button>
      </div>
    </div>
  );
}