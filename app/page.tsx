// Rota raiz: redireciona para o catalogo pos-login.
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";

export default async function RootPage() {
  const { hasUser, profile } = await getCurrentAuthContext();
  if (!hasUser) redirect("/login");
  if (!profile) redirect("/login?erro=perfil");
  redirect("/catalogo");
}
