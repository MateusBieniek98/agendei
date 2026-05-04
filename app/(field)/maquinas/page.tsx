import { createSupabaseServer } from "@/lib/supabase/server";
import MaquinaForm from "./MaquinaForm";
import type { Maquina } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MaquinasFieldPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("maquinas")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Reportar problema</h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          Avise a manutenção sobre uma máquina parada ou com defeito.
        </p>
      </div>
      <MaquinaForm maquinas={(data ?? []) as Maquina[]} />
    </div>
  );
}
