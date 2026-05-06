import { getCurrentProfile } from "@/lib/auth";
import { Card, StatCard } from "@/components/ui/Card";
import { createSupabaseServer } from "@/lib/supabase/server";
import { brl, ddmmyyyy, num } from "@/lib/format";
import { normalizePlanningText } from "@/lib/planning-progress";
import ResumoCompilado from "./ResumoCompilado";

export const dynamic = "force-dynamic";

type ProducaoResumoLinha = {
  id: string;
  data: string;
  quantidade: number | string;
  talhao: string | null;
  observacoes: string | null;
  valor_unitario_snapshot: number | string;
  created_at: string;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
};

type PlanejamentoResumoLinha = {
  id: string;
  quantidade_prevista: number | string | null;
  status: string;
  talhao: string;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
  atividades: { nome: string; unidade: string; valor_unitario: number | string } | null;
};

type AtividadeResumo = {
  nome: string;
  unidade: string;
  quantidade: number;
  faturamento: number;
  meta: number;
  faturamentoPlanejado: number;
  dias: Set<string>;
};

function isoDate(d: Date) {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

function pctWidth(pct: number) {
  return `${Math.min(Math.max(pct, 0), 100)}%`;
}

function atividadeKey(nome: string | null | undefined) {
  return normalizePlanningText(nome);
}

function ensureAtividade(
  mapa: Map<string, AtividadeResumo>,
  nome: string,
  unidade: string
) {
  const key = atividadeKey(nome);
  const existing = mapa.get(key);
  if (existing) return existing;

  const novo: AtividadeResumo = {
    nome,
    unidade,
    quantidade: 0,
    faturamento: 0,
    meta: 0,
    faturamentoPlanejado: 0,
    dias: new Set<string>(),
  };
  mapa.set(key, novo);
  return novo;
}

export default async function ResumoFieldPage() {
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServer();

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const inicioMes = isoDate(new Date(ano, mes - 1, 1));
  const fimMes = isoDate(new Date(ano, mes, 0));
  const escopoEquipe = profile?.role !== "admin" && profile?.equipe_id;

  let producaoQuery = supabase
    .from("producao")
    .select(
      "id, data, quantidade, talhao, observacoes, valor_unitario_snapshot, created_at, " +
        "equipes(nome), projetos(nome), atividades(nome, unidade)"
    )
    .gte("data", inicioMes)
    .lte("data", fimMes)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (escopoEquipe) {
    producaoQuery = producaoQuery.eq("equipe_id", profile.equipe_id!);
  } else if (profile?.role !== "admin") {
    producaoQuery = producaoQuery.eq("registrado_por", profile!.id);
  }

  let planejamentoQuery = supabase
    .from("planejamento")
    .select(
      "id, quantidade_prevista, status, talhao, equipes(nome), projetos(nome), " +
        "atividades(nome, unidade, valor_unitario)"
    )
    .eq("ano", ano)
    .eq("mes", mes)
    .neq("status", "cancelado");

  if (escopoEquipe) {
    planejamentoQuery = planejamentoQuery.eq("equipe_id", profile.equipe_id!);
  }

  const [{ data: producaoData }, { data: planejamentoData }] = await Promise.all([
    producaoQuery,
    planejamentoQuery,
  ]);

  const linhas = (producaoData ?? []) as unknown as ProducaoResumoLinha[];
  const planejamentos = (planejamentoData ?? []) as unknown as PlanejamentoResumoLinha[];
  const porAtividade = new Map<string, AtividadeResumo>();

  for (const item of planejamentos) {
    const nome = item.atividades?.nome ?? "Atividade sem nome";
    const unidade = item.atividades?.unidade ?? "ha";
    const resumo = ensureAtividade(porAtividade, nome, unidade);
    const prevista = Number(item.quantidade_prevista ?? 0);
    const tarifa = Number(item.atividades?.valor_unitario ?? 0);
    resumo.meta += prevista;
    resumo.faturamentoPlanejado += prevista * tarifa;
  }

  for (const linha of linhas) {
    const nome = linha.atividades?.nome ?? "Atividade sem nome";
    const unidade = linha.atividades?.unidade ?? "ha";
    const resumo = ensureAtividade(porAtividade, nome, unidade);
    const quantidade = Number(linha.quantidade ?? 0);
    const faturamento = quantidade * Number(linha.valor_unitario_snapshot ?? 0);
    resumo.quantidade += quantidade;
    resumo.faturamento += faturamento;
    resumo.dias.add(linha.data);
  }

  const atividades = Array.from(porAtividade.values()).sort(
    (a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome)
  );
  const totalFaturamento = linhas.reduce(
    (s, l) => s + Number(l.quantidade ?? 0) * Number(l.valor_unitario_snapshot ?? 0),
    0
  );
  const totalQuantidade = atividades.reduce((s, a) => s + a.quantidade, 0);
  const totalMeta = atividades.reduce((s, a) => s + a.meta, 0);
  const diasComApontamento = new Set(linhas.map((l) => l.data)).size;
  const mediaDiaria = diasComApontamento > 0 ? totalQuantidade / diasComApontamento : 0;
  const pctGeral = totalMeta > 0 ? (totalQuantidade / totalMeta) * 100 : 0;
  const equipeNome = escopoEquipe
    ? linhas[0]?.equipes?.nome ?? planejamentos[0]?.equipes?.nome ?? "sua frente"
    : "todas as frentes";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-ink-900)]">
          Resumo da produção
        </h2>
        <p className="mt-1 text-sm font-semibold text-[var(--color-ink-600)]">
          {equipeNome} · {ddmmyyyy(inicioMes)} até {ddmmyyyy(fimMes)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento apontado"
          value={brl(totalFaturamento)}
          hint={`${linhas.length} lançamento${linhas.length === 1 ? "" : "s"} no mês`}
          tone="positive"
        />
        <StatCard
          label="Produção apontada"
          value={`${num(totalQuantidade)} ha`}
          hint="Soma dos apontamentos do mês"
        />
        <StatCard
          label="Meta da atividade"
          value={`${num(totalMeta)} ha`}
          hint={`${num(pctGeral, 1)}% realizado`}
          tone={pctGeral >= 100 ? "positive" : "warning"}
        />
        <StatCard
          label="Média de produtividade"
          value={`${num(mediaDiaria)} ha/dia`}
          hint={`${diasComApontamento} dia${diasComApontamento === 1 ? "" : "s"} com produção`}
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-ink-900)]">
              Meta geral do mês
            </h3>
            <p className="text-sm font-semibold text-[var(--color-ink-600)]">
              Realizado {num(totalQuantidade)} de {num(totalMeta)} ha
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--color-gn-700)] tabular">
            {num(pctGeral, 1)}%
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--color-ink-100)]">
          <div
            className="h-full rounded-full bg-[var(--color-gn-600)]"
            style={{ width: pctWidth(pctGeral) }}
          />
        </div>
      </Card>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-ink-900)]">
            Meta por atividade
          </h3>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Produção, faturamento e média por serviço apontado.
          </p>
        </div>

        {atividades.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-semibold text-[var(--color-ink-600)]">
              Ainda não há planejamento ou apontamentos para este mês.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {atividades.map((atividade) => {
              const pct = atividade.meta > 0
                ? (atividade.quantidade / atividade.meta) * 100
                : 0;
              const media = atividade.dias.size > 0
                ? atividade.quantidade / atividade.dias.size
                : 0;

              return (
                <Card key={atividadeKey(atividade.nome)} className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-bold text-[var(--color-ink-900)]">
                        {atividade.nome}
                      </h4>
                      <p className="mt-1 text-sm font-semibold text-[var(--color-ink-600)]">
                        {num(atividade.quantidade)} de {num(atividade.meta)}{" "}
                        {atividade.unidade}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-[var(--color-gn-700)]">
                        {brl(atividade.faturamento)}
                      </p>
                      <p className="text-xs font-bold text-[var(--color-ink-500)]">
                        média {num(media)} {atividade.unidade}/dia
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--color-ink-100)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-forest-600)]"
                      style={{ width: pctWidth(pct) }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-[var(--color-ink-600)]">
                    <span>{num(pct, 1)}% realizado</span>
                    <span>planejado {brl(atividade.faturamentoPlanejado)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ResumoCompilado linhas={linhas} totalFaturamento={totalFaturamento} />
    </div>
  );
}
