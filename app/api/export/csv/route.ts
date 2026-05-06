// CSV simples — funciona como fonte para Power BI / Google Sheets via "From Web".
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { insumosToColumns } from "@/lib/insumos";

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
      "data, quantidade, projeto_id, talhao, descarte, insumos, " +
        "valor_unitario_snapshot, observacoes, " +
        "equipes(nome), atividades(nome, unidade), projetos(nome)"
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
    talhao: string | null;
    descarte: number | null;
    insumos: unknown;
    observacoes: string | null;
    equipes: { nome: string } | null;
    atividades: { nome: string; unidade: string } | null;
    projetos: { nome: string } | null;
  };

  const headers = [
    "data",
    "equipe",
    "atividade",
    "projeto",
    "talhao",
    "quantidade",
    "unidade",
    "descarte",
    "insumo_1",
    "qtd_insumo_1",
    "insumo_2",
    "qtd_insumo_2",
    "insumo_3",
    "qtd_insumo_3",
    "insumo_4",
    "qtd_insumo_4",
    "insumo_5",
    "qtd_insumo_5",
    "valor_unitario",
    "total",
    "observacoes",
  ];
  const lines = [headers.join(",")];
  for (const r of (data ?? []) as unknown as Row[]) {
    const total = Number(r.quantidade) * Number(r.valor_unitario_snapshot);
    const insumos = insumosToColumns(r.insumos);
    lines.push(
      [
        r.data,
        r.equipes?.nome ?? "",
        r.atividades?.nome ?? "",
        r.projetos?.nome ?? "",
        r.talhao ?? "",
        r.quantidade,
        r.atividades?.unidade ?? "",
        r.descarte ?? "",
        ...insumos.flatMap((insumo) =>
          insumo ? [insumo.nome, insumo.quantidade] : ["", ""]
        ),
        r.valor_unitario_snapshot,
        total.toFixed(2),
        r.observacoes ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="GN_producao_${de}_a_${ate}.csv"`,
    },
  });
}
