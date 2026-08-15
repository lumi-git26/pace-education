"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Compass, 
  BookUser, 
  Settings, 
  Presentation, 
  Users, 
  ArrowLeftRight,
  LogOut,
  Sparkles
} from "lucide-react";

const LEARNER_LINKS = [
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Personal", href: "/personal", icon: BookUser },
  // Cậu có thể thêm trang Settings cho Learner sau này
  // { label: "Settings", href: "/settings", icon: Settings }, 
];

const CREATOR_LINKS = [
  // Nếu có trang dashboard tổng quan thì bật dòng này lên:
  // { label: "Dashboard", href: "/creator/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/creator/courses", icon: Presentation },
  { label: "Classrooms", href: "/creator/classrooms", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  
  // Kiểm tra xem có đang ở trong khu vực của Creator không
  const isCreatorMode = pathname.startsWith("/creator");

  const links = isCreatorMode ? CREATOR_LINKS : LEARNER_LINKS;

  return (
    <div className="flex h-screen w-64 flex-col border-r border-line/50 bg-[#F9F9F8]/80 backdrop-blur-xl shrink-0 sticky top-0">
      
      {/* ================== LOGO ================== */}
      <div className="flex items-center gap-3 px-8 h-24 shrink-0">
        <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-white">
          <Sparkles size={16} />
        </div>
        <span className="font-serif text-2xl font-bold text-ink tracking-wide">
          Pace.
        </span>
        {isCreatorMode && (
          <span className="ml-1 rounded-full bg-[#F2994A]/10 px-2 py-0.5 text-[9px] font-bold text-[#F2994A] uppercase tracking-wider">
            Creator
          </span>
        )}
      </div>

      {/* ================== NAVIGATION LINKS ================== */}
      <div className="flex-1 px-5 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={isCreatorMode ? "creator" : "learner"}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-1.5"
          >
            {links.map((link) => {
              // Active khi pathname khớp chính xác hoặc nằm trong route con
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative",
                    isActive
                      ? "bg-ink text-white shadow-sm"
                      : "text-muted hover:bg-line/40 hover:text-ink",
                  ].join(" ")}
                >
                  <Icon 
                    size={18} 
                    className={isActive ? "text-white" : "text-muted group-hover:text-ink transition-colors"} 
                  />
                  {link.label}
                </Link>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ================== BOTTOM ACTIONS ================== */}
      <div className="p-5 border-t border-line/50 flex flex-col gap-2">
        
        {/* Nút Switch Mode */}
        <Link
          href={isCreatorMode ? "/personal" : "/creator/courses"}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-bold text-ink bg-white border border-line/60 shadow-sm hover:shadow-md hover:border-[#F2994A]/40 transition-all group"
        >
          <div className="w-6 h-6 rounded-md bg-[#F9F9F8] border border-line/50 flex items-center justify-center text-muted group-hover:text-[#F2994A] transition-colors">
            <ArrowLeftRight size={12} />
          </div>
          {isCreatorMode ? "Back to Learning" : "Creator Studio"}
        </Link>

        {/* Nút Đăng xuất (Tùy chọn) */}
        <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold text-muted hover:bg-red-50 hover:text-red-500 transition-colors w-full text-left">
          <LogOut size={16} />
          Sign out
        </button>

      </div>
    </div>
  );
}