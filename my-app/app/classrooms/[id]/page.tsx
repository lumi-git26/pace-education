"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, Users, User, BookOpen, CheckCircle2, Calendar } from "lucide-react";

type ClassroomDetail = {
  id: string;
  title: string;
  subject_code: string | null;
  cohort_label: string | null;
  schedule_summary: string | null;
  profiles: { full_name: string } | null;
};

export default function ClassroomDetailPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;

  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClassroom() {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();

      const { data: classData, error: classErr } = await supabase
        .from("classrooms")
        .select("id, title, subject_code, cohort_label, schedule_summary, profiles(full_name)")
        .eq("id", classId)
        .single();

      if (classErr) {
        setError("Classroom not found.");
        setLoading(false);
        return;
      }

      const formattedClass = {
        ...classData,
        profiles: Array.isArray(classData.profiles) ? classData.profiles[0] : classData.profiles,
      };
      
      setClassroom(formattedClass);

      if (user) {
        const { data: membership } = await supabase
          .from("classroom_members")
          .select("id")
          .eq("learner_id", user.id)
          .eq("classroom_id", classId)
          .eq("status", "active")
          .maybeSingle();
        
        if (membership) setIsEnrolled(true);
      }

      setLoading(false);
    }

    if (classId) loadClassroom();
  }, [classId]);

  async function handleJoinClass() {
    setEnrolling(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: insertErr } = await supabase
      .from("classroom_members")
      .insert({
        learner_id: user.id,
        classroom_id: classId,
        status: "active",
      });

    if (insertErr) {
      setError("Could not join the class. Please try again.");
      setEnrolling(false);
      return;
    }

    setIsEnrolled(true);
    setEnrolling(false);
    
    setTimeout(() => {
      router.push("/personal");
    }, 1500);
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F9F9F8] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !classroom) {
    return (
      <div className="min-h-screen w-full bg-[#F9F9F8] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-xl font-semibold text-ink mb-2">Oops!</p>
        <p className="text-muted">{error || "Something went wrong."}</p>
        <button 
          onClick={() => router.back()}
          className="mt-6 px-6 py-2 rounded-full bg-white border border-line shadow-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full px-6 py-12 md:py-20 lg:px-16 overflow-x-hidden">
      <div
        className="fixed inset-0 -z-30 pointer-events-none bg-[#F9F9F8]"
        style={{
          backgroundImage: "radial-gradient(#D1D1D1 1.5px, transparent 1.5px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none mix-blend-multiply opacity-[0.35]">
        <div className="absolute top-[0%] left-[20%] w-[40%] h-[50%] bg-[#C9A6E0]/40 blur-[150px] rounded-full" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[40%] bg-[#F2994A]/30 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-[800px] mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-muted hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft size={16} /> Back to Explore
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-12"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12 border-b border-line/60 pb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {classroom.subject_code && (
                  <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                    {classroom.subject_code}
                  </span>
                )}
                {classroom.cohort_label && (
                  <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {classroom.cohort_label}
                  </span>
                )}
              </div>
              
              <h1 className="font-serif text-[32px] md:text-[40px] font-bold text-ink leading-tight mb-6">
                {classroom.title}
              </h1>
              
              {/* === BỐ CỤC THÔNG TIN LỚP HỌC MỚI === */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-muted">
                  <div className="w-9 h-9 rounded-full bg-ink/10 flex items-center justify-center text-[12px] font-bold text-ink/70">
                    {classroom.profiles?.full_name?.charAt(0) ?? "I"}
                  </div>
                  <p className="text-[15px] font-medium">
                    Led by <span className="font-bold text-ink">{classroom.profiles?.full_name ?? "Instructor"}</span>
                  </p>
                </div>

                {/* Khung lịch nét đứt nằm dưới tên giảng viên */}
                {classroom.schedule_summary && (
                  <div className="flex items-center gap-2 mt-1 px-4 py-2.5 bg-[#F9F9F8] rounded-xl border border-dashed border-line/80 w-fit">
                    <Calendar size={14} className="text-orange-500" />
                    <span className="text-[13px] font-medium text-ink/80">
                      {classroom.schedule_summary}
                    </span>
                  </div>
                )}
              </div>
              {/* ================================== */}
            </div>

            <div className="w-full md:w-[260px] shrink-0 bg-white/80 rounded-[24px] p-6 shadow-sm border border-white">
              {isEnrolled ? (
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="font-bold text-ink mb-1">You're in!</h3>
                  <p className="text-[12px] text-muted mb-4">You are successfully enrolled in this classroom.</p>
                  <button 
                    onClick={() => router.push('/personal')}
                    className="w-full py-3 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink/80 transition-colors"
                  >
                    Go to Workspace
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <h3 className="font-bold text-ink mb-2">Join Classroom</h3>
                  <p className="text-[12px] text-muted mb-5 leading-relaxed">
                    Enroll now to access live sessions, materials, and announcements from the lecturer.
                  </p>
                  <button 
                    onClick={handleJoinClass}
                    disabled={enrolling}
                    className="w-full py-3 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {enrolling ? (
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Users size={16} /> Enroll Now</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-[#F9F9F8] border border-dashed border-line/80">
              <BookOpen size={20} className="text-indigo-500 mb-3" />
              <h4 className="font-bold text-ink mb-1 text-sm">Curated Materials</h4>
              <p className="text-[12px] text-muted leading-relaxed">Access specific learning tracks and materials selected by your instructor.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F9F9F8] border border-dashed border-line/80">
              <Calendar size={20} className="text-orange-500 mb-3" />
              <h4 className="font-bold text-ink mb-1 text-sm">Live Sessions</h4>
              <p className="text-[12px] text-muted leading-relaxed">Join regular meetings and interact directly with peers and lecturers.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F9F9F8] border border-dashed border-line/80">
              <User size={20} className="text-teal-500 mb-3" />
              <h4 className="font-bold text-ink mb-1 text-sm">Cohort Based</h4>
              <p className="text-[12px] text-muted leading-relaxed">Learn together with a dedicated group of students in the same schedule.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}