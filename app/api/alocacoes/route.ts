import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT = "*, projetos(nome), talhoes(id, codigo, area_ha, ativo), equipes(nome), maquinas(nome, identificador, status), autor:profiles!alocacoes_operacionais_alocado_por_fkey(nome)";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const supabase = await createSupabaseServer();
  let query = supabase
    .from("alocacoes_operacionais")
    .select(SELECT)
    .order("iniciado_em", { ascending: false });

  if (sp.get("ativas") !== "0") query = query.is("encerrado_em", null);
  if (sp.get("projeto_id")) query = query.eq("projeto_id", sp.get("projeto_id")!);
  if (sp.get("talhao_id")) query = query.eq("talhao_id", sp.get("talhao_id")!);
  if (sp.get("equipe_id")) query = query.eq("equipe_id", sp.get("equipe_id")!);
  if (sp.get("maquina_id")) query = query.eq("maquina_id", sp.get("maquina_id")!);

  const { data, error } = await query.limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (profile.role !== "admin" && profile.role !== "gestor") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? body.acao ?? "").trim();
  const resourceType = String(body.resource_type ?? body.recurso_tipo ?? "").trim();
  const resourceId = String(body.resource_id ?? body.recurso_id ?? "").trim();
  const talhaoId = String(body.talhao_id ?? "").trim() || null;

  if (!resourceId || !["alocar", "encerrar"].includes(action) || !["equipe", "maquina"].includes(resourceType)) {
    return NextResponse.json({ error: "ação ou recurso inválido" }, { status: 400 });
  }
  if (action === "alocar" && !talhaoId) {
    return NextResponse.json({ error: "talhão obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("manage_operational_allocation", {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_talhao_id: talhaoId,
    p_observacoes: String(body.observacoes ?? "").trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = data as { id?: string } | null;
  if (!result?.id) return NextResponse.json({ error: "Resposta inválida ao atualizar alocação." }, { status: 500 });
  const { data: item } = await supabase
    .from("alocacoes_operacionais")
    .select(SELECT)
    .eq("id", result.id)
    .maybeSingle();
  return NextResponse.json({ item: item ?? result });
}
