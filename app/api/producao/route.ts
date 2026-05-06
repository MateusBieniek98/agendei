// GET    /api/producao         → lista lançamentos (filtros: data_de, data_ate, equipe_id)
// POST   /api/producao         → cria lançamento (encarregado/admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { optionalNumber, sanitizeInsumos } from "@/lib/insumos";
import { syncPlanningProgressForProduction } from "@/lib/planning-progress";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const supabase = await createSupabaseServer();

  let q = supabase
    .from("producao")
    .select(
      "id, data, equipe_id, atividade_id, quantidade, observacoes, " +
        "projeto_id, talhao, insumos, descarte, valor_unitario_snapshot, registrado_por, created_at, " +
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

  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  if (equipe) q = q.eq("equipe_id", equipe);
  if (atividade) q = q.eq("atividade_id", atividade);
  if (projeto) q = q.eq("projeto_id", projeto);
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
    talhao,
    quantidade,
    insumos,
    descarte,
    observacoes,
  } = body;

  if (!equipe_id || !atividade_id || !projeto_id || !talhao || !quantidade) {
    return NextResponse.json({ error: "campos obrigatórios faltando" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // captura valor unitário atual da atividade
  const { data: ativ, error: errAt } = await supabase
    .from("atividades")
    .select("valor_unitario, ativo")
    .eq("id", atividade_id)
    .maybeSingle();
  if (errAt || !ativ || !ativ.ativo) {
    return NextResponse.json({ error: "atividade inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("producao")
    .insert({
      data: dataLanc ?? new Date().toISOString().slice(0, 10),
      equipe_id,
      atividade_id,
      projeto_id,
      talhao: String(talhao).trim(),
      quantidade,
      insumos: sanitizeInsumos(insumos),
      descarte: optionalNumber(descarte),
      observacoes: observacoes ?? null,
      valor_unitario_snapshot: ativ.valor_unitario,
      registrado_por: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const syncError = await syncPlanningProgressForProduction(supabase, data);
  return NextResponse.json(
    { item: data, planejamento_sync_error: syncError?.message ?? null },
    { status: 201 }
  );
}
