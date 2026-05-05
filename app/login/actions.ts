"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ROLE_HOME, type UserRole } from "@/lib/types";

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
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.role) {
    return {
      error:
        "Login válido, mas o perfil do usuário não existe no banco. Rode o script de correção de perfis.",
    };
  }

  const role = profile.role as UserRole;
  const target = from && from !== "/login" ? from : ROLE_HOME[role];

  // redirect() em Server Action emite a resposta com Set-Cookie + Location.
  redirect(target);
}
