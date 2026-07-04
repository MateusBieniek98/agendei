import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function requireGestorShellProfile(): Promise<Profile> {
  const profile = await requireSession();

  if (profile.role === "encarregado") {
    redirect("/dashboard");
  }

  if (profile.role !== "gestor" && profile.role !== "admin") {
    redirect("/login");
  }

  return profile;
}
