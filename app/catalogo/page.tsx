import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const { hasUser, profile } = await getCurrentAuthContext();
  if (!hasUser) redirect("/login");
  if (!profile) redirect("/login?erro=perfil");

  redirect(defaultRouteForRole(profile.role));
}
