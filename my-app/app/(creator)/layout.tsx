"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Library, Users, LogOut } from "lucide-react";

const NAV = [
  { href: "/creator/courses", label: "Courses", icon: Library },
  { href: "/creator/classrooms", label: "Classroom", icon: Users },
];

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (profile?.role !== "creator") {
        router.push("/explore");
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkRole();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="relative min-h-screen bg-[#F9F9F8]">
      <div
        className="fixed left-0 top-0 z-40 h-full w-4"
        onMouseEnter={() => {}}
      />
      <aside className="fixed left-0 top-0 z-50 m-6 flex h-[calc(100vh-48px)] w-[240px] flex-col justify-between rounded-[32px] bg-white/90 backdrop-blur-xl px-6 py-10 shadow-sm">
        <div>
          <p className="px-2 mb-6 text-xs font-bold text-muted uppercase tracking-wider">
            Creator Studio
          </p>
          <div className="flex flex-col gap-4">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "flex flex-row items-center gap-4 w-full px-5 py-4 rounded-[20px] transition-all",
                    active
                      ? "bg-ink text-paper shadow-md"
                      : "text-ink/60 hover:bg-ink/5 hover:text-ink",
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[15px] font-semibold tracking-wide">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex flex-row items-center gap-4 w-full px-5 py-4 rounded-[20px] text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
        >
          <LogOut size={22} strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-wide">
            Sign out
          </span>
        </button>
      </aside>

      <main className="pl-[calc(240px+72px)] pr-8 py-10">{children}</main>
    </div>
  );
}