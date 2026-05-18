// Rota raiz: redireciona direto para a área principal do perfil logado.
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/navigation";

export default async function RootPage() {
  const { hasUser, profile } = await getCurrentAuthContext();
  if (!hasUser) redirect("/login");
  if (!profile) redirect("/login?erro=perfil");
  redirect(defaultRouteForRole(profile.role));
}
