"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, Users, Megaphone, Send, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type Announcement = {
  id: string;
  title: string | null;
  body: string;
  type: string;
  created_at: string;
};

export default function ManageClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.id as string;

  const [classroom, setClassroom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [postBody, setPostBody] = useState("");
  const [postType, setPostType] = useState("announcement");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: c } = await supabase
        .from("classrooms")
        .select("*")
        .eq("id", classroomId)
        .single();

      const { data: mems } = await supabase
        .from("classroom_members")
        .select("id, joined_at, profiles(full_name)")
        .eq("classroom_id", classroomId);

      const { data: posts } = await supabase
        .from("classroom_announcements")
        .select("id, title, body, type, created_at")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setClassroom(c);
        setMembers(mems ?? []);
        setAnnouncements(posts ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
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

  if (loading || !classroom) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

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
            {classroom.subject_code} · {members.length} students
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
              <p className="text-sm text-muted text-center py-8">
                No posts yet.
              </p>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl bg-white/60 border border-white/60 p-5"
                >
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

        {/* Roster */}
        <div className="rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm p-6 h-fit">
          <h3 className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-4">
            <Users size={14} /> Students ({members.length})
          </h3>
          {members.length === 0 ? (
            <p className="text-sm text-muted">No students enrolled yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 text-sm text-ink/80"
                >
                  <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center text-[10px] font-bold">
                    {m.profiles?.full_name?.charAt(0) ?? "?"}
                  </div>
                  {m.profiles?.full_name ?? "Unknown"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}