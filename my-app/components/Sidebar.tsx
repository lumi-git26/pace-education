"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { 
  User, 
  Library, 
  Search, 
  LogOut, 
  Globe, 
  Moon, 
  Sparkles,
  ChevronUp,
  Crown,
  Presentation,
  Users,
  ArrowLeftRight,
  Sparkle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/lib/supabase/useProfile";

// Menu cho Learner
const LEARNER_NAV = [
  { href: "/personal", label: "Personal", icon: User },
  { href: "/courses", label: "Courses", icon: Library },
  { href: "/explore", label: "Explore", icon: Search },
];

// Menu cho Creator (Giảng viên)
const CREATOR_NAV = [
  { href: "/creator/courses", label: "Courses", icon: Presentation },
  { href: "/creator/classrooms", label: "Classrooms", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  
  const [open, setOpen] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);

  // Nhận diện xem có đang ở trong chế độ Creator không
  const isCreatorMode = pathname?.startsWith("/creator");
  
  // Fake state: Kiểm tra xem user này đã được duyệt làm Creator chưa (Sau này fetch từ DB)
  const isApprovedCreator = true; 

  const activeNav = isCreatorMode ? CREATOR_NAV : LEARNER_NAV;

  function handleSignOut() {
    router.push("/sign-in");
  }

  // Tự động đóng popup profile khi sidebar thụt vào
  function handleMouseLeave() {
    setOpen(false);
    setShowProfileCard(false);
  }

  // Dữ liệu giả lập cho thẻ mở rộng
  const mockStats = { enrolled: 3, passed: 12, streak: 7 };
  const currentTier = "Gold Learner";

  return (
    <>
      {/* Vùng kích hoạt sidebar ẩn bên mép trái */}
      <div
        className="fixed left-0 top-0 z-[90] h-full w-4"
        onMouseEnter={() => setOpen(true)}
      />

      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={handleMouseLeave}
        className={[
          "fixed left-0 top-0 z-[100] flex h-[calc(100vh-48px)] w-[250px] flex-col",
          "m-6 rounded-[32px] bg-white/90 backdrop-blur-xl px-5 py-8 shadow-xl",
          "transition-transform duration-300 ease-out border border-white/60",
          open ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
        ].join(" ")}
      >
        
        {/* TOP: Brand Logo */}
        <div className="flex items-center gap-3 px-3 mb-10">
          <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-sm ${isCreatorMode ? 'bg-[#F2994A]' : 'bg-accent'}`}>
            <Sparkles size={18} />
          </div>
          <span className="font-serif text-[22px] font-bold text-ink tracking-tight flex items-baseline">
            pace.
            {isCreatorMode && (
              <span className="ml-1.5 font-sans rounded-full bg-[#F2994A]/10 px-2 py-0.5 text-[8px] font-bold text-[#F2994A] uppercase tracking-wider relative -top-1.5">
                Creator
              </span>
            )}
          </span>
        </div>

        {/* MIDDLE: Navigation */}
        <div className="flex flex-col gap-2 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={isCreatorMode ? "creator" : "learner"}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2"
            >
              {activeNav.map(({ href, label, icon: Icon }) => {
                const active = pathname?.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      "flex flex-row items-center gap-4 w-full px-4 py-3.5 rounded-[20px] transition-all",
                      active
                        ? "bg-ink text-paper shadow-md"
                        : "text-ink/60 hover:bg-ink/5 hover:text-ink",
                    ].join(" ")}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[14px] font-semibold tracking-wide">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* BOTTOM: Action & Profile Area */}
        <div className="relative mt-auto flex flex-col gap-4">

          {/* ================= SWITCH MODE BUTTON ================= */}
          <div className="px-2">
            {!isCreatorMode ? (
              // NẾU ĐANG LÀ LEARNER
              isApprovedCreator ? (
                // Nếu đã là Creator -> Hiện nút Switch sang Studio
                <Link
                  href="/creator/courses"
                  className="flex items-center justify-between w-full p-3 rounded-[16px] bg-slate-50 border border-line/60 hover:border-[#F2994A]/50 hover:bg-white transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-muted group-hover:text-[#F2994A] transition-colors border border-line/40">
                      <Presentation size={13} />
                    </div>
                    <span className="text-[13px] font-semibold text-ink group-hover:text-[#F2994A] transition-colors">
                      Creator Studio
                    </span>
                  </div>
                </Link>
              ) : (
                // Nếu chưa là Creator -> Hiện nút Apply (Gợi ý)
                <button
                  onClick={() => alert("Redirecting to Creator Application Form...")}
                  className="flex flex-col items-start w-full p-4 rounded-[20px] bg-gradient-to-br from-amber-50 to-orange-50/50 border border-orange-100 hover:border-orange-200 transition-colors text-left group"
                >
                  <div className="flex items-center gap-1.5 mb-1 text-orange-600">
                    <Sparkle size={14} className="fill-orange-400/30" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Become a Creator</span>
                  </div>
                  <p className="text-[12px] font-medium text-ink/70 leading-relaxed">
                    Want to share your knowledge? Apply now.
                  </p>
                </button>
              )
            ) : (
              // NẾU ĐANG Ở CREATOR MODE -> Hiện nút Switch về Learner
              <Link
                href="/personal"
                className="flex items-center justify-between w-full p-3 rounded-[16px] bg-slate-50 border border-line/60 hover:border-accent/50 hover:bg-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-muted group-hover:text-accent transition-colors border border-line/40">
                    <ArrowLeftRight size={13} />
                  </div>
                  <span className="text-[13px] font-semibold text-ink group-hover:text-accent transition-colors">
                    Back to Learning
                  </span>
                </div>
              </Link>
            )}
          </div>

          <div className="h-px w-full bg-line/60" />
          
          {/* ================= FULL PROFILE CARD (POPOVER) ================= */}
          <AnimatePresence>
            {showProfileCard && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute bottom-[calc(100%+16px)] left-0 w-[260px] bg-white/95 backdrop-blur-2xl border border-white shadow-[0_20px_40px_rgb(0,0,0,0.12)] rounded-[28px] overflow-hidden z-50 flex flex-col"
              >
                {/* Khu vực Customized Tier Background (Có thể đổi gradient theo hạng) */}
                <div className="bg-gradient-to-br from-ink to-ink/90 p-5 text-white relative">
                  {/* Hiệu ứng kính bóng */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-serif font-bold text-lg border border-white/20 shadow-inner">
                      {(profile?.full_name ?? "K").charAt(0)}
                    </div>
                    {/* Tier Badge */}
                    <div className="flex items-center gap-1 bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shadow-sm">
                      <Crown size={10} /> {currentTier}
                    </div>
                  </div>

                  <div>
                    <p className="text-[15px] font-semibold truncate">
                      {profile?.full_name ?? "Sáng (Kira)"}
                    </p>
                    <p className="text-[11px] text-white/60 font-medium mt-0.5 tracking-wide">
                      K63.FTU Learner
                    </p>
                  </div>

                  {/* Chỉ số cá nhân */}
                  <div className="grid grid-cols-3 gap-2 text-center border-t border-white/15 pt-4 mt-4">
                    <div>
                      <p className="font-serif text-lg font-bold">{mockStats.enrolled}</p>
                      <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1">Enrolled</p>
                    </div>
                    <div>
                      <p className="font-serif text-lg font-bold">{mockStats.passed}</p>
                      <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1">Passed</p>
                    </div>
                    <div>
                      <p className="font-serif text-lg font-bold text-amber-400">{mockStats.streak}</p>
                      <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1">Streak</p>
                    </div>
                  </div>
                </div>

                {/* Khu vực Settings */}
                <div className="p-2.5 bg-white/50 flex flex-col gap-0.5">
                  <button className="flex items-center gap-3 px-4 py-3 rounded-[16px] hover:bg-ink/5 text-[13px] font-semibold text-ink transition-colors">
                    <Globe size={16} className="text-muted" /> Language
                  </button>
                  <button className="flex items-center gap-3 px-4 py-3 rounded-[16px] hover:bg-ink/5 text-[13px] font-semibold text-ink transition-colors">
                    <Moon size={16} className="text-muted" /> Theme
                  </button>
                  <div className="h-px w-full bg-line/60 my-1" />
                  <button 
                    onClick={handleSignOut} 
                    className="flex items-center gap-3 px-4 py-3 rounded-[16px] hover:bg-red-50 text-[13px] font-semibold text-red-500 transition-colors group"
                  >
                    <LogOut size={16} className="group-hover:text-red-500 text-red-400" /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ================= MINI CARD (TRONG SIDEBAR) ================= */}
          <button 
            onClick={() => setShowProfileCard(!showProfileCard)}
            className={[
              "w-full flex items-center justify-between p-2 rounded-[20px] transition-colors border",
              showProfileCard 
                ? "bg-ink text-white border-ink shadow-md" 
                : "bg-white border-line/60 hover:bg-line/20 text-ink"
            ].join(" ")}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={[
                "w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-sm shrink-0 transition-colors",
                showProfileCard ? "bg-white/20" : "bg-ink/5 text-ink"
              ].join(" ")}>
                {(profile?.full_name ?? "K").charAt(0)}
              </div>
              <div className="flex flex-col text-left min-w-0 pr-2">
                <span className="text-[12px] font-semibold truncate leading-tight">
                  {profile?.full_name ?? "Kira"}
                </span>
                <span className={[
                  "text-[9px] font-bold uppercase tracking-widest mt-0.5",
                  showProfileCard ? "text-white/60" : "text-accent"
                ].join(" ")}>
                  {currentTier}
                </span>
              </div>
            </div>
            
            <motion.div 
              animate={{ rotate: showProfileCard ? 180 : 0 }} 
              className={`shrink-0 pr-1 ${showProfileCard ? "text-white/60" : "text-muted"}`}
            >
              <ChevronUp size={16} />
            </motion.div>
          </button>

        </div>
      </aside>
    </>
  );
}