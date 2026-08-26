// GET    /api/producao         → lista lançamentos (filtros: data_de, data_ate, equipe_id)
// POST   /api/producao         → cria lançamento (encarregado/admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyApontamentosSheet } from "@/lib/google-sheets-apontamentos";
import {
  hasOnlyControlledInsumos,
  optionalNumber,
  sanitizeControlledInsumos,
} from "@/lib/insumos";
import { syncPlanningProgressForProduction } from "@/lib/planning-progress";
import {
  resolveProductionPlot,
  type ResolvedProductionPlot,
} from "@/lib/project-context";
import { cicloProducao } from "@/lib/period";

type ProductionReportProgress = {
  area_total_ha: number | null;
  quantidade_acumulada: number;
  quantidade_restante: number | null;
  status: "Fechado" | "Em aberto" | "Registrado";
};

async function getProductionReportProgress(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  input: {
    plot: ResolvedProductionPlot;
    atividadeId: string;
    reportDate: string;
  }
): Promise<ProductionReportProgress> {
  const pageSize = 1000;
  let from = 0;
  let quantidadeAcumulada = 0;
  const [year, month, day] = input.reportDate.split("-").map(Number);
  const hasValidReportDate = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(
    input.reportDate
  );
  const reportReferenceDate = hasValidReportDate
    ? new Date(Date.UTC(year, month - 1, day, 16))
    : new Date();
  const reportDate = hasValidReportDate
    ? input.reportDate
    : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Campo_Grande" }).format(
        reportReferenceDate
      );
  const reportCycle = cicloProducao(reportReferenceDate);

  while (true) {
    const { data, error } = await supabase
      .from("producao")
      .select("quantidade")
      .eq("projeto_id", input.plot.projeto_id)
      .eq("atividade_id", input.atividadeId)
      .eq("talhao", input.plot.codigo)
      .gte("data", reportCycle.de)
      .lte("data", reportDate)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    for (const row of data ?? []) quantidadeAcumulada += Number(row.quantidade ?? 0);
    if ((data?.length ?? 0) < pageSize) break;
    from += pageSize;
  }

  let areaTotalHa: number | null = null;
  if (input.plot.id) {
    const { data, error } = await supabase
      .from("talhoes")
      .select("area_ha")
      .eq("id", input.plot.id)
      .maybeSingle();

    const parsedArea = Number(data?.area_ha ?? 0);
    if (!error && parsedArea > 0) areaTotalHa = parsedArea;
  }

  const quantidadeRestante =
    areaTotalHa != null ? Math.max(areaTotalHa - quantidadeAcumulada, 0) : null;
  const status =
    areaTotalHa == null
      ? "Registrado"
      : quantidadeAcumulada >= areaTotalHa
        ? "Fechado"
        : "Em aberto";

  return {
    area_total_ha: areaTotalHa,
    quantidade_acumulada: quantidadeAcumulada,
    quantidade_restante: quantidadeRestante,
    status,
  };
}

async function safeProductionReportProgress(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  input: { plot: ResolvedProductionPlot; atividadeId: string; reportDate: string }
) {
  try {
    return await getProductionReportProgress(supabase, input);
  } catch {
    return null;
  }
}

function normalizeClientId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$/.test(trimmed)) {
    throw new Error("client_id inválido");
  }
  return trimmed;
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const supabase = await createSupabaseServer();

  let q = supabase
    .from("producao")
    .select(
      "id, data, equipe_id, atividade_id, quantidade, observacoes, " +
        "projeto_id, talhao_id, talhao, insumos, descarte, estoque_controlado, valor_unitario_snapshot, registrado_por, created_at, " +
        "equipes(nome), atividades(nome, unidade), projetos(nome)"
    )
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  const de = sp.get("data_de");
  const ate = sp.get("data_ate");
  const equipe = sp.get("equipe_id");
  const atividade = sp.get("atividade_id");
  const projeto = sp.get("projeto_id");
  const talhao = sp.get("talhao");
  const talhaoId = sp.get("talhao_id");

  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  if (equipe) q = q.eq("equipe_id", equipe);
  if (atividade) q = q.eq("atividade_id", atividade);
  if (projeto) q = q.eq("projeto_id", projeto);
  if (talhaoId) q = q.eq("talhao_id", talhaoId);
  if (talhao) q = q.ilike("talhao", `%${talhao}%`);

  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json();
  const {
    data: dataLanc,
    equipe_id,
    atividade_id,
    projeto_id,
    talhao_id,
    talhao,
    quantidade,
    insumos,
    descarte,
    observacoes,
    client_id,
  } = body;

  if (!equipe_id || !atividade_id || !projeto_id || (!talhao_id && !talhao) || !quantidade) {
    return NextResponse.json({ error: "campos obrigatórios faltando" }, { status: 400 });
  }

  let clientId: string | null = null;
  try {
    clientId = normalizeClientId(client_id);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  let plot;
  try {
    plot = await resolveProductionPlot(supabase, { projeto_id, talhao_id, talhao });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const origemChave = clientId ? `gn-app:${profile.id}:${clientId}` : null;

  if (origemChave) {
    const { data: existing, error: existingError } = await supabase
      .from("producao")
      .select("*")
      .eq("origem_chave", origemChave)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }
    if (existing) {
      const reportProgress = await safeProductionReportProgress(supabase, {
        plot,
        atividadeId: atividade_id,
        reportDate: existing.data,
      });
      return NextResponse.json({
        item: existing,
        deduplicated: true,
        report_progress: reportProgress,
      });
    }
  }

  if (!hasOnlyControlledInsumos(insumos)) {
    return NextResponse.json(
      { error: "Selecione apenas insumos cadastrados no estoque." },
      { status: 400 }
    );
  }

  const { data: rpcData, error } = await supabase.rpc("create_producao_with_stock", {
    p_data: dataLanc ?? null,
    p_equipe_id: equipe_id,
    p_atividade_id: atividade_id,
    p_projeto_id: plot.projeto_id,
    p_talhao: plot.codigo,
    p_quantidade: Number(quantidade),
    p_descarte: optionalNumber(descarte),
    p_observacoes: observacoes ?? null,
    p_insumos: sanitizeControlledInsumos(insumos),
    p_client_id: clientId,
    p_origem_chave: origemChave,
  });

  if (error) {
    if (origemChave && error.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("producao")
        .select("*")
        .eq("origem_chave", origemChave)
        .maybeSingle();

      if (!existingError && existing) {
        const reportProgress = await safeProductionReportProgress(supabase, {
          plot,
          atividadeId: atividade_id,
          reportDate: existing.data,
        });
        return NextResponse.json({
          item: existing,
          deduplicated: true,
          report_progress: reportProgress,
        });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rpcResult = rpcData as {
    item?: { id: string; data?: string; projeto_id?: string | null; talhao?: string | null; atividade_id?: string | null };
    deduplicated?: boolean;
  } | null;
  const data = rpcResult?.item;
  if (!data?.id) {
    return NextResponse.json({ error: "Resposta inválida ao salvar apontamento." }, { status: 500 });
  }
  if (rpcResult?.deduplicated) {
    const reportProgress = await safeProductionReportProgress(supabase, {
      plot,
      atividadeId: atividade_id,
      reportDate: data.data ?? String(dataLanc ?? ""),
    });
    return NextResponse.json({
      item: data,
      deduplicated: true,
      report_progress: reportProgress,
    });
  }

  const [syncError, sheetsSyncError, reportProgress] = await Promise.all([
    syncPlanningProgressForProduction(supabase, data),
    notifyApontamentosSheet("criado", String(data.id)),
    safeProductionReportProgress(supabase, {
      plot,
      atividadeId: atividade_id,
      reportDate: data.data ?? String(dataLanc ?? ""),
    }),
  ]);
  return NextResponse.json(
    {
      item: data,
      planejamento_sync_error: syncError?.message ?? null,
      sheets_sync_error: sheetsSyncError,
      report_progress: reportProgress,
    },
    { status: 201 }
  );
}
