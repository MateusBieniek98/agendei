import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { normalizeProjectName } from "@/lib/planning-progress";

type ProjetoApi = {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
};

type TalhaoApi = {
  id: string;
  projeto_id: string;
  codigo: string;
  area_ha: number | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type PlanejamentoProjeto = {
  projeto_id: string;
  projetos: { nome: string } | null;
};

function dedupeProjetos(projetos: ProjetoApi[], planejamento: PlanejamentoProjeto[]) {
  const preferidos = new Map<string, string>();

  for (const item of planejamento) {
    const nome = item.projetos?.nome;
    if (!nome) continue;
    const key = normalizeProjectName(nome);
    if (!preferidos.has(key)) preferidos.set(key, item.projeto_id);
  }

  const mapa = new Map<string, ProjetoApi>();
  for (const projeto of projetos) {
    const key = normalizeProjectName(projeto.nome);
    const atual = mapa.get(key);
    if (!atual) {
      mapa.set(key, projeto);
      continue;
    }

    const preferido = preferidos.get(key);
    if (preferido === projeto.id || (preferido && atual.id !== preferido)) {
      mapa.set(key, projeto);
    }
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const includeTalhoes = req.nextUrl.searchParams.get("include_talhoes") === "1";
  const supabase = await createSupabaseServer();
  const [{ data, error }, { data: planejamentoData, error: planejamentoError }] =
    await Promise.all([
      supabase.from("projetos").select("*").eq("ativo", true).order("nome"),
      supabase
        .from("planejamento")
        .select("projeto_id, projetos(nome)")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (planejamentoError) {
    return NextResponse.json({ error: planejamentoError.message }, { status: 400 });
  }

  const projetos = dedupeProjetos(
    (data ?? []) as ProjetoApi[],
    (planejamentoData ?? []) as unknown as PlanejamentoProjeto[]
  );

  if (!includeTalhoes) {
    return NextResponse.json({ items: projetos });
  }

  if (projetos.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: talhoesData, error: talhoesError } = await supabase
    .from("talhoes")
    .select("*")
    .in("projeto_id", projetos.map((p) => p.id))
    .order("codigo");

  const talhoesPorProjeto = new Map<string, TalhaoApi[]>();
  if (!talhoesError) {
    for (const talhao of (talhoesData ?? []) as TalhaoApi[]) {
      const current = talhoesPorProjeto.get(talhao.projeto_id) ?? [];
      current.push(talhao);
      talhoesPorProjeto.set(talhao.projeto_id, current);
    }
  }

  return NextResponse.json({
    items: projetos.map((projeto) => ({
      ...projeto,
      talhoes: talhoesPorProjeto.get(projeto.id) ?? [],
    })),
    talhoes_error: talhoesError?.message ?? null,
  });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const nome = String(body.nome ?? "").trim();
  if (!nome) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: existentes, error: findError } = await supabase
    .from("projetos")
    .select("*")
    .eq("nome", nome)
    .order("created_at", { ascending: false })
    .limit(1);

  if (findError) return NextResponse.json({ error: findError.message }, { status: 400 });

  const existente = existentes?.[0];
  if (existente) {
    const { data, error } = await supabase
      .from("projetos")
      .update({ nome, ativo: body.ativo ?? true })
      .eq("id", existente.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data }, { status: 200 });
  }

  const { data, error } = await supabase
    .from("projetos")
    .insert({ nome, ativo: body.ativo ?? true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: 201 });
}
