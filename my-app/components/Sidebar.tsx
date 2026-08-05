"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { User, Library, Search, LogOut } from "lucide-react";

const NAV = [
  { href: "/personal", label: "Personal", icon: User },
  { href: "/courses", label: "Courses", icon: Library },
  { href: "/explore", label: "Explore", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSignOut() {
    router.push("/sign-in");
  }

  return (
    <>
      {/* Invisible hover trigger strip along the far left edge */}
      <div
        className="fixed left-0 top-0 z-[90] h-full w-4"
        onMouseEnter={() => setOpen(true)}
      />

      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={[
          "fixed left-0 top-0 z-[100] flex h-[calc(100vh-48px)] w-[240px] flex-col justify-between",
          "m-6 rounded-[32px] bg-white/90 backdrop-blur-xl px-6 py-10 shadow-xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
        ].join(" ")}
      >
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
    </>
  );
}