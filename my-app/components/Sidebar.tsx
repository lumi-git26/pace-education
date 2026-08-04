"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Library, Search, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const NAV = [
  { href: "/personal", label: "Personal", icon: User },
  { href: "/courses", label: "Courses", icon: Library },
  { href: "/explore", label: "Explore", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
    <aside className="flex w-[104px] shrink-0 flex-col items-center justify-between py-6">
      <div className="flex flex-col items-center gap-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex flex-col items-center justify-center gap-2 w-[84px] py-4 rounded-2xl transition-colors",
                active ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/5",
              ].join(" ")}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[11px] font-medium tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={handleSignOut}
        className="flex flex-col items-center justify-center gap-2 w-[84px] py-4 rounded-2xl text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <LogOut size={18} strokeWidth={1.75} />
        <span className="text-[11px] font-medium tracking-wide">
          Sign out
        </span>
      </button>
    </aside>
  );
}