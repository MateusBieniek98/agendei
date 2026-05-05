// Rota raiz: redireciona para a home do papel atual.
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/types";

export default async function RootPage() {
  const { hasUser, profile } = await getCurrentAuthContext();
  if (!hasUser) redirect("/login");
  if (!profile) redirect("/login?erro=perfil");
  redirect(ROLE_HOME[profile.role]);
}
