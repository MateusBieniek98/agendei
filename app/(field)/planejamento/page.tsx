import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlanejamentoField from "./PlanejamentoField";

export const dynamic = "force-dynamic";

export default async function PlanejamentoFieldPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return (
    <PlanejamentoField equipeId={profile.equipe_id} />
  );
}
