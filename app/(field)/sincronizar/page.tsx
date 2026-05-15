import { requireRole } from "@/lib/auth";
import SyncHome from "./SyncHome";

export const dynamic = "force-dynamic";

export default async function SincronizarPage() {
  const profile = await requireRole(["encarregado", "admin"]);

  return (
    <SyncHome
      nome={profile.nome}
    />
  );
}
