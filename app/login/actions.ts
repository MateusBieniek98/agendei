"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { defaultRouteForRole, safeReturnPath } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

/**
 * Server Action de login.
 *
 * Usar Server Action garante que os cookies de sessão são setados como
 * Set-Cookie no response do redirect — sem depender de sincronização
 * client→server.
 */
export async function loginAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const from = String(formData.get("from") ?? "");

  if (!email || !senha) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    return { error: "E-mail ou senha incorretos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_organization_id, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.ativo || !profile.active_organization_id) {
    return {
      error:
        "Login válido, mas o perfil do usuário não existe no banco. Rode o script de correção de perfis.",
    };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, active")
    .eq("organization_id", profile.active_organization_id)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!membership?.active) {
    return { error: "Sua conta não está vinculada a uma empresa ativa." };
  }

  const role = membership.role as UserRole;
  const target = safeReturnPath(from) ?? defaultRouteForRole(role);

  // redirect() em Server Action emite a resposta com Set-Cookie + Location.
  redirect(target);
}
