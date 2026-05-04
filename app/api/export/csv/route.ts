// CSV simples — funciona como fonte para Power BI / Google Sheets via "From Web".
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const escopo = sp.get("escopo");
  const today = new Date();
  let de = sp.get("data_de");
  const ate = sp.get("data_ate") ?? today.toISOString().slice(0, 10);

  if (!de && (escopo === "mes" || escopo === null)) {
    de = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const supabase = await createSupabaseServer();
  let q = supabase
    .from("producao")
    .select(
      "data, quantidade, valor_unitario_snapshot, observacoes, equipes(nome), atividades(nome, unidade)"
    )
    .order("data", { ascending: true });
  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  type Row = {
    data: string;
    quantidade: number;
    valor_unitario_snapshot: number;
    observacoes: string | null;
    equipes: { nome: string } | null;
    atividades: { nome: string; unidade: string } | null;
  };

  const headers = [
    "data", "equipe", "atividade", "quantidade",
    "unidade", "valor_unitario", "total", "observacoes",
  ];
  const lines = [headers.join(",")];
  for (const r of (data ?? []) as unknown as Row[]) {
    const total = Number(r.quantidade) * Number(r.valor_unitario_snapshot);
    lines.push([
      r.data, r.equipes?.nome ?? "", r.atividades?.nome ?? "",
      r.quantidade, r.atividades?.unidade ?? "",
      r.valor_unitario_snapshot, total.toFixed(2),
      r.observacoes ?? "",
    ].map(csvEscape).join(","));
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="GN_producao_${de}_a_${ate}.csv"`,
    },
  });
}
