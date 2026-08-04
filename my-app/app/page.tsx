"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      // Give Supabase's client a moment to process any #access_token
      // fragment from an OAuth redirect before we navigate away.
      await supabase.auth.getSession();
      router.replace("/explore");
    }
    redirect();
  }, [router]);

  return null;
}