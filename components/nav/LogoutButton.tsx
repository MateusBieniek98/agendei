"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className={
        className ??
        "text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
      }
    >
      {children ?? "Sair"}
    </button>
  );
}
