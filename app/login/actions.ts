"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { defaultRouteForRole, safeReturnPath } from "@/lib/navigation";
import { resolveLoginAccess } from "@/lib/tenant-transition";

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

  const access = await resolveLoginAccess(supabase, data.user.id);
  if (!access.ok && access.reason === "perfil") {
    return {
      error:
        "Login válido, mas o perfil não está ativo ou configurado para este ambiente.",
    };
  }
  if (!access.ok) {
    return { error: "Sua conta não está vinculada a uma empresa ativa." };
  }

  const target = safeReturnPath(from) ?? defaultRouteForRole(access.role);

  // redirect() em Server Action emite a resposta com Set-Cookie + Location.
  redirect(target);
}
