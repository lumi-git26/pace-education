"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, PlayCircle, Link, Mail, Flame } from "lucide-react";
import CourseModal from "./CourseModal";

export interface UnitPreview {
  id: string;
  title: string;
  lessons: { id: string; title: string; content?: any }[];
}

export interface CourseCardData {
  id: string | number;
  title: string;
  description?: string;
  publisherName: string;
  lessonCount?: number;
  hoursToComplete?: number;
  units?: UnitPreview[];
}

export default function CourseCard({ course }: { course: CourseCardData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const previewUnits = (course.units ?? []).slice(0, 3);

  return (
    <>
      <motion.div
        layout
        className="relative rounded-[32px] bg-white/40 backdrop-blur-2xl border border-white/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden group p-6 cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/80 backdrop-blur-md border border-line/50 flex items-center justify-center text-ink hover:bg-ink hover:text-white transition-all z-10 shadow-sm"
          aria-label="Expand preview"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 135 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ArrowUpRight size={20} />
          </motion.div>
        </button>

        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-accent/20 to-accent/40 flex items-center justify-center text-accent font-serif font-bold text-xl mb-4 border border-white">
          {course.title.charAt(0)}
        </div>

        <div className="w-[85%] mb-6">
          <h3 className="font-serif text-[22px] font-bold text-ink leading-tight mb-1.5 group-hover:text-accent transition-colors">
            {course.title}
          </h3>
          <p className="text-sm font-medium text-muted">
            Published by <span className="text-ink">{course.publisherName}</span>
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <span className="px-3.5 py-1.5 bg-ink/5 rounded-full text-xs font-semibold text-ink flex items-center gap-1.5">
              <Link size={12} /> Source
            </span>
            <span className="px-3.5 py-1.5 bg-ink/5 rounded-full text-xs font-semibold text-ink flex items-center gap-1.5">
              <Mail size={12} /> Contact
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-full">
            <Flame size={14} /> Hot
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 24 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="border-t border-line/40 pt-5 overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium text-ink bg-white/40 p-3 rounded-2xl">
                  <span>Lessons: <strong className="text-accent">{course.lessonCount ?? 0}</strong></span>
                  <span>Time: <strong className="text-accent">{course.hoursToComplete ?? 0}h</strong></span>
                </div>

                <div className="space-y-2.5 px-1">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider">Preview</p>
                  {previewUnits.length === 0 && (
                    <p className="text-sm text-muted">Content coming soon.</p>
                  )}
                  <ul className="text-sm text-ink space-y-2.5">
                    {previewUnits.map((unit) => (
                      <li key={unit.id} className="flex items-center gap-3">
                        <PlayCircle size={16} className="text-accent" />
                        {unit.title}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                  }}
                  className="w-full mt-2 bg-ink text-white rounded-pill py-3 text-sm font-medium hover:bg-ink/80 transition-colors"
                >
                  Enroll
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {isModalOpen && (
        <CourseModal course={course} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}