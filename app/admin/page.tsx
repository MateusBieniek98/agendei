// Dashboard administrativo. Reaproveita as views agregadas + manutenções abertas.
import { Card, StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { brl, ddmmyyyy } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import GestorCharts from "@/app/gestor/GestorCharts";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Manut = {
  id: string;
  descricao: string;
  status: string;
  created_at: string;
  maquinas: { nome: string; identificador: string | null } | null;
};

export default async function AdminDashboard() {
  const supabase = await createSupabaseServer();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth() + 1;
  const inicioMes = `${yyyy}-${String(mm).padStart(2, "0")}-01`;
  const hoje = today.toISOString().slice(0, 10);

  const [
    { data: serie },
    { data: meta },
    { data: porAtividade },
    { data: ranking },
    { data: manut },
  ] = await Promise.all([
    supabase.from("v_faturamento_dia").select("*").gte("data", inicioMes),
    supabase.from("metas").select("valor_meta").eq("ano", yyyy).eq("mes", mm).maybeSingle(),
    supabase.from("v_producao_atividade_mes").select("*"),
    supabase.from("v_ranking_equipes_mes").select("*"),
    supabase
      .from("manutencoes")
      .select("id, descricao, status, created_at, maquinas(nome, identificador)")
      .neq("status", "resolvido")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const rows = (serie ?? []) as { data: string; faturamento: number }[];
  const totalMes = rows.reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const totalHoje = rows
    .filter((r) => r.data === hoje)
    .reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const valorMeta = Number(meta?.valor_meta ?? 0);
  const pct = valorMeta > 0 ? (totalMes / valorMeta) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--color-ink-500)]">
            Visão consolidada da operação. Hoje · {ddmmyyyy(hoje)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/api/export/xlsx?escopo=mes"
            className="px-4 py-2 rounded-lg bg-white border border-[var(--color-ink-300)] text-sm font-medium hover:bg-[var(--color-ink-50)]"
          >
            Exportar XLSX
          </Link>
          <Link
            href="/api/export/csv?escopo=mes"
            className="px-4 py-2 rounded-lg bg-white border border-[var(--color-ink-300)] text-sm font-medium hover:bg-[var(--color-ink-50)]"
          >
            Exportar CSV
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Faturamento hoje" value={brl(totalHoje)} tone="positive" />
        <StatCard label="Mês corrente" value={brl(totalMes)} />
        <StatCard label="Meta do mês" value={brl(valorMeta)} hint="Editável em Metas" />
        <StatCard
          label="% atingida"
          value={`${pct.toFixed(1)}%`}
          tone={pct >= 100 ? "positive" : pct >= 70 ? "neutral" : "warning"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <h3 className="font-semibold">Produção diária — mês corrente</h3>
          <GestorCharts.Linha serie={rows} />
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Produção por atividade</h3>
          <ul className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
            {(porAtividade ?? []).map(
              (a: { id: string; nome: string; total: number; faturamento: number; unidade: string }) => (
                <li key={a.id} className="text-sm flex justify-between gap-3">
                  <span className="truncate">{a.nome}</span>
                  <span className="text-[var(--color-ink-500)] tabular shrink-0">
                    {Number(a.total).toFixed(2)} {a.unidade} · {brl(a.faturamento)}
                  </span>
                </li>
              )
            )}
            {(!porAtividade || porAtividade.length === 0) && (
              <li className="text-sm text-[var(--color-ink-500)]">Sem dados.</li>
            )}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold">Ranking de equipes (mês)</h3>
          <ol className="mt-3 space-y-2">
            {((ranking ?? []) as { id: string; nome: string; faturamento: number }[]).map(
              (e, i) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-[var(--color-gn-100)] text-[var(--color-gn-700)] text-xs font-bold inline-flex items-center justify-center">
                      {i + 1}
                    </span>
                    {e.nome}
                  </span>
                  <span className="font-semibold tabular">{brl(e.faturamento)}</span>
                </li>
              )
            )}
          </ol>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Manutenções abertas</h3>
            <Link
              href="/admin/maquinas"
              className="text-xs text-[var(--color-gn-700)] hover:underline"
            >
              ver todas →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {((manut ?? []) as unknown as Manut[]).map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-2 text-sm border-b border-[var(--color-ink-100)] pb-2"
              >
                <div>
                  <p className="font-medium">
                    {m.maquinas?.nome}
                    {m.maquinas?.identificador && (
                      <span className="text-[var(--color-ink-500)]"> · {m.maquinas.identificador}</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-ink-500)]">{m.descricao}</p>
                </div>
                <Badge tone={m.status === "aberto" ? "danger" : "warning"}>
                  {m.status.replace("_", " ")}
                </Badge>
              </li>
            ))}
            {(!manut || manut.length === 0) && (
              <li className="text-sm text-[var(--color-ink-500)]">Tudo em ordem.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
