// Rota raiz: redireciona para a home do papel atual.
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/types";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  redirect(ROLE_HOME[profile.role]);
}
