// Exporta lançamentos de produção em XLSX usando exceljs.
// Filtros (?escopo=mes|semana|hoje|tudo) ou ?data_de=&data_ate=

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { insumosToColumns } from "@/lib/insumos";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const escopo = sp.get("escopo");
  const today = new Date();
  let de = sp.get("data_de");
  const ate = sp.get("data_ate") ?? today.toISOString().slice(0, 10);

  if (!de && escopo === "hoje") de = today.toISOString().slice(0, 10);
  if (!de && escopo === "semana") {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    de = d.toISOString().slice(0, 10);
  }
  if (!de && (escopo === "mes" || escopo === null)) {
    de = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const supabase = await createSupabaseServer();
  let q = supabase
    .from("producao")
    .select(
      "data, quantidade, talhao, descarte, insumos, valor_unitario_snapshot, observacoes, " +
        "equipes(nome), atividades(nome, unidade), projetos(nome)"
    )
    .order("data", { ascending: true });
  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "GN Silvicultura";
  const ws = wb.addWorksheet("Lançamentos");
  ws.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Equipe", key: "equipe", width: 22 },
    { header: "Atividade", key: "atividade", width: 28 },
    { header: "Projeto", key: "projeto", width: 24 },
    { header: "Talhão", key: "talhao", width: 12 },
    { header: "Quantidade", key: "qtd", width: 14 },
    { header: "Unidade", key: "unidade", width: 12 },
    { header: "Descarte", key: "descarte", width: 12 },
    { header: "Insumo 1", key: "insumo1", width: 28 },
    { header: "QTD 1", key: "qtdInsumo1", width: 12 },
    { header: "Insumo 2", key: "insumo2", width: 28 },
    { header: "QTD 2", key: "qtdInsumo2", width: 12 },
    { header: "Insumo 3", key: "insumo3", width: 28 },
    { header: "QTD 3", key: "qtdInsumo3", width: 12 },
    { header: "Insumo 4", key: "insumo4", width: 28 },
    { header: "QTD 4", key: "qtdInsumo4", width: 12 },
    { header: "Insumo 5", key: "insumo5", width: 28 },
    { header: "QTD 5", key: "qtdInsumo5", width: 12 },
    { header: "Valor unitário", key: "valor", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Observações", key: "obs", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1856B3" },
  };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

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

  for (const row of (data ?? []) as unknown as Row[]) {
    const total = Number(row.quantidade) * Number(row.valor_unitario_snapshot);
    const insumos = insumosToColumns(row.insumos);
    ws.addRow({
      data: row.data,
      equipe: row.equipes?.nome,
      atividade: row.atividades?.nome,
      projeto: row.projetos?.nome,
      talhao: row.talhao,
      qtd: Number(row.quantidade),
      unidade: row.atividades?.unidade,
      descarte: row.descarte === null ? null : Number(row.descarte),
      insumo1: insumos[0]?.nome,
      qtdInsumo1: insumos[0]?.quantidade,
      insumo2: insumos[1]?.nome,
      qtdInsumo2: insumos[1]?.quantidade,
      insumo3: insumos[2]?.nome,
      qtdInsumo3: insumos[2]?.quantidade,
      insumo4: insumos[3]?.nome,
      qtdInsumo4: insumos[3]?.quantidade,
      insumo5: insumos[4]?.nome,
      qtdInsumo5: insumos[4]?.quantidade,
      valor: Number(row.valor_unitario_snapshot),
      total,
      obs: row.observacoes,
    });
  }
  ws.getColumn("valor").numFmt = "R$ #,##0.00";
  ws.getColumn("total").numFmt = "R$ #,##0.00";
  ws.getColumn("qtd").numFmt = "0.00";
  ws.getColumn("descarte").numFmt = "0.00";
  for (const key of [
    "qtdInsumo1",
    "qtdInsumo2",
    "qtdInsumo3",
    "qtdInsumo4",
    "qtdInsumo5",
  ]) {
    ws.getColumn(key).numFmt = "0.00";
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="GN_lancamentos_${de}_a_${ate}.xlsx"`,
    },
  });
}
