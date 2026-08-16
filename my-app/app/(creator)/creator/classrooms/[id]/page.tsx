"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, Users, Megaphone, Send, Eye, EyeOff, Check, X as XIcon, FileText } from "lucide-react";
import Link from "next/link";

type Announcement = {
  id: string;
  title: string | null;
  body: string;
  type: string;
  created_at: string;
};

type Member = {
  id: string;
  learner_id: string;
  status: string;
  profiles: { full_name: string | null };
};

export default function ManageClassroomPage() {
  const params = useParams();
  const classroomId = params.id as string;

  const [classroom, setClassroom] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [postBody, setPostBody] = useState("");
  const [postType, setPostType] = useState("announcement");
  const [posting, setPosting] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Member | null>(null);

  async function loadAll() {
    setLoading(true);

    const { data: c } = await supabase
      .from("classrooms")
      .select("*")
      .eq("id", classroomId)
      .single();

    const { data: mems } = await supabase
      .from("classroom_members")
      .select("id, learner_id, status, profiles(full_name)")
      .eq("classroom_id", classroomId);

    const { data: posts } = await supabase
      .from("classroom_announcements")
      .select("id, title, body, type, created_at")
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false });

    setClassroom(c);
    setMembers((mems as any) ?? []);
    setAnnouncements(posts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [classroomId]);

  async function handlePost() {
    if (!postBody.trim()) return;
    setPosting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("classroom_announcements")
      .insert({
        classroom_id: classroomId,
        author_id: user.id,
        body: postBody,
        type: postType,
      })
      .select("id, title, body, type, created_at")
      .single();

    setPosting(false);

    if (!error && data) {
      setAnnouncements((prev) => [data, ...prev]);
      setPostBody("");
    }
  }

  async function togglePublish() {
    const nextStatus = classroom.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("classrooms")
      .update({ status: nextStatus })
      .eq("id", classroomId);
    if (!error) setClassroom((prev: any) => ({ ...prev, status: nextStatus }));
  }

  async function respondToRequest(memberId: string, approve: boolean) {
    await supabase
      .from("classroom_members")
      .update({ status: approve ? "active" : "rejected" })
      .eq("id", memberId);
    loadAll();
  }

  if (loading || !classroom) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const pendingMembers = members.filter((m) => m.status === "pending");
  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <div>
      <Link
        href="/creator/classrooms"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to classrooms
      </Link>

      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            {classroom.title}
          </h1>
          <p className="text-sm text-muted">
            {classroom.subject_code} · {activeMembers.length} students
            {pendingMembers.length > 0 && (
              <span className="text-accent"> · {pendingMembers.length} pending</span>
            )}
          </p>
        </div>
        <button
          onClick={togglePublish}
          className={[
            "flex items-center gap-2 rounded-pill px-5 py-2.5 text-sm font-medium transition-colors",
            classroom.status === "published"
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-ink text-white hover:bg-ink/80",
          ].join(" ")}
        >
          {classroom.status === "published" ? (
            <>
              <Eye size={14} /> Published
            </>
          ) : (
            <>
              <EyeOff size={14} /> Publish
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6">
          {/* Post composer */}
          <div className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
            <h3 className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-4">
              <Megaphone size={14} /> Post to classroom
            </h3>
            <div className="flex gap-2 mb-3">
              {["announcement", "homework", "material"].map((t) => (
                <button
                  key={t}
                  onClick={() => setPostType(t)}
                  className={[
                    "rounded-pill px-4 py-2 text-xs font-medium capitalize transition-colors",
                    postType === t
                      ? "bg-ink text-white"
                      : "bg-white/60 text-muted border border-line/60 hover:bg-ink/5",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="What do you want to share with your students?"
              rows={3}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-accent resize-none mb-3"
            />
            <button
              onClick={handlePost}
              disabled={posting || !postBody.trim()}
              className="flex items-center gap-2 bg-ink text-white rounded-pill px-5 py-2.5 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-50"
            >
              <Send size={14} /> {posting ? "Posting…" : "Post"}
            </button>
          </div>

          {/* Feed */}
          <div className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No posts yet.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded-2xl bg-white/60 border border-white/60 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      {a.type}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-ink/80">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Pending requests */}
          {pendingMembers.length > 0 && (
            <div className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-accent/30 shadow-sm p-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider mb-4">
                Pending Requests ({pendingMembers.length})
              </h3>
              <div className="space-y-2">
                {pendingMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-ink/80 truncate">
                      {m.profiles?.full_name ?? "Unknown"}
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => respondToRequest(m.id, true)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => respondToRequest(m.id, false)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      >
                        <XIcon size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roster */}
          <div className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6">
            <h3 className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-4">
              <Users size={14} /> Students ({activeMembers.length})
            </h3>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-muted">No students enrolled yet.</p>
            ) : (
              <div className="space-y-1">
                {activeMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedStudent(m)}
                    className="w-full flex items-center gap-2.5 text-sm text-ink/80 hover:text-accent hover:bg-ink/5 rounded-lg px-2 py-2 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {m.profiles?.full_name?.charAt(0) ?? "?"}
                    </div>
                    <span className="truncate">{m.profiles?.full_name ?? "Unknown"}</span>
                    <FileText size={13} className="ml-auto text-muted shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedStudent && (
        <StudentSubmissionsModal
          classroomId={classroomId}
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

function StudentSubmissionsModal({
  classroomId,
  student,
  onClose,
}: {
  classroomId: string;
  student: Member;
  onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: assignments } = await supabase
        .from("classroom_assignments")
        .select("id")
        .eq("classroom_id", classroomId);

      const assignmentIds = (assignments ?? []).map((a: any) => a.id);
      if (assignmentIds.length === 0) {
        if (!cancelled) {
          setSubmissions([]);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("homework_submissions")
        .select(
          "id, content, ai_score, ai_feedback, teacher_score, teacher_feedback, status, submitted_at, classroom_assignments(title)"
        )
        .eq("learner_id", student.learner_id)
        .in("assignment_id", assignmentIds)
        .order("submitted_at", { ascending: false });

      if (!cancelled) {
        setSubmissions(data ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [classroomId, student.learner_id]);

  async function saveTeacherReview(submissionId: string, score: number, feedback: string) {
    await supabase
      .from("homework_submissions")
      .update({
        teacher_score: score,
        teacher_feedback: feedback,
        status: "teacher_reviewed",
      })
      .eq("id", submissionId);

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? { ...s, teacher_score: score, teacher_feedback: feedback, status: "teacher_reviewed" }
          : s
      )
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[28px] bg-paper shadow-2xl p-7"
      >
        <h2 className="font-serif text-2xl font-bold text-ink mb-1">
          {student.profiles?.full_name ?? "Student"}
        </h2>
        <p className="text-sm text-muted mb-6">Homework history</p>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted">No submissions yet.</p>
        ) : (
          <div className="space-y-5">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-line/60 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-ink">
                    {s.classroom_assignments?.title ?? "Assignment"}
                  </p>
                  <span className="text-[10px] text-muted">
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-ink/80 mb-3 whitespace-pre-line">
                  {s.content}
                </p>

                {s.ai_score != null && (
                  <div className="rounded-xl bg-indigo-50 p-3 mb-3">
                    <p className="text-xs font-bold text-indigo-700 mb-1">
                      AI Review — {s.ai_score}/100
                    </p>
                    <p className="text-xs text-indigo-900">{s.ai_feedback}</p>
                  </div>
                )}

                {s.status === "teacher_reviewed" ? (
                  <div className="rounded-xl bg-green-50 p-3">
                    <p className="text-xs font-bold text-green-700 mb-1">
                      Your review — {s.teacher_score}/100
                    </p>
                    <p className="text-xs text-green-900">{s.teacher_feedback}</p>
                  </div>
                ) : (
                  <TeacherReviewForm
                    onSubmit={(score, feedback) =>
                      saveTeacherReview(s.id, score, feedback)
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherReviewForm({
  onSubmit,
}: {
  onSubmit: (score: number, feedback: string) => void;
}) {
  const [score, setScore] = useState(80);
  const [feedback, setFeedback] = useState("");

  return (
    <div className="flex gap-2 items-start">
      <input
        type="number"
        min={0}
        max={100}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        className="w-16 rounded-lg border border-line px-2 py-2 text-sm text-center outline-none focus:border-accent"
      />
      <input
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Your feedback"
        className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={() => onSubmit(score, feedback)}
        disabled={!feedback.trim()}
        className="rounded-lg bg-ink text-white px-4 py-2 text-xs font-medium hover:bg-ink/80 disabled:opacity-50 transition-colors"
      >
        Save
      </button>
    </div>
  );
}