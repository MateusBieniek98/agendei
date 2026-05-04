import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { brl, ddmmyyyy, num, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  data: string;
  quantidade: number;
  observacoes: string | null;
  valor_unitario_snapshot: number;
  equipes: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
};

export default async function HistoricoPage() {
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServer();
  const hoje = todayISO();

  const { data } = await supabase
    .from("producao")
    .select(
      "id, data, quantidade, observacoes, valor_unitario_snapshot, " +
        "equipes(nome), atividades(nome, unidade)"
    )
    .eq("registrado_por", profile!.id)
    .eq("data", hoje)
    .order("created_at", { ascending: false });

  const linhas = (data ?? []) as unknown as Linha[];
  const total = linhas.reduce(
    (s, l) => s + Number(l.quantidade) * Number(l.valor_unitario_snapshot),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Hoje · {ddmmyyyy(hoje)}</h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          Lançamentos que você registrou hoje.
        </p>
      </div>

      <Card className="p-4 bg-[var(--color-gn-700)] text-white border-[var(--color-gn-700)]">
        <p className="text-xs uppercase tracking-wider text-white/80">Faturamento do dia</p>
        <p className="mt-1 text-3xl font-bold tabular">{brl(total)}</p>
        <p className="mt-1 text-xs text-white/70">
          {linhas.length} lançamento{linhas.length === 1 ? "" : "s"}
        </p>
      </Card>

      {linhas.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-[var(--color-ink-500)]">
            Nenhum lançamento hoje. Vá em <strong>Lançar</strong> para começar.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {linhas.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{l.atividades?.nome}</p>
                  <p className="text-xs text-[var(--color-ink-500)]">
                    {l.equipes?.nome}
                  </p>
                </div>
                <p className="text-base font-bold tabular">
                  {brl(Number(l.quantidade) * Number(l.valor_unitario_snapshot))}
                </p>
              </div>
              <div className="mt-2 text-sm text-[var(--color-ink-700)]">
                {num(l.quantidade)} {l.atividades?.unidade}
                {" · "}
                {brl(l.valor_unitario_snapshot)}/{l.atividades?.unidade}
              </div>
              {l.observacoes && (
                <p className="mt-2 text-xs italic text-[var(--color-ink-500)]">
                  “{l.observacoes}”
                </p>
              )}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
