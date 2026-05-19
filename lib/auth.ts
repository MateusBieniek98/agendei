// Helpers de autenticação/autorização para Server Components e Route Handlers.
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";
import type { Profile, UserRole } from "./types";
import { ROLE_HOME } from "./types";

function onlyActiveProfile(profile: Profile | null): Profile | null {
  if (!profile || profile.ativo === false) return null;
  return profile;
}

/** Carrega o profile do usuário autenticado, ou null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  return onlyActiveProfile((data as Profile | null) ?? null);
}

/** Carrega sessão e profile separadamente para diagnosticar redirects. */
export async function getCurrentAuthContext(): Promise<{
  hasUser: boolean;
  profile: Profile | null;
}> {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { hasUser: false, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  return {
    hasUser: true,
    profile: onlyActiveProfile((data as Profile | null) ?? null),
  };
}

/** Garante que existe sessão. Se não, redireciona para /login. */
export async function requireSession(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Garante que o usuário tem um dos papéis aceitos. */
export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await requireSession();
  if (!allowed.includes(profile.role)) {
    // manda pra home do papel atual
    redirect(ROLE_HOME[profile.role]);
  }
  return profile;
}
