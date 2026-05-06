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

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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

  return NextResponse.json({
    items: dedupeProjetos(
      (data ?? []) as ProjetoApi[],
      (planejamentoData ?? []) as unknown as PlanejamentoProjeto[]
    ),
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
  const { data, error } = await supabase
    .from("projetos")
    .insert({ nome, ativo: body.ativo ?? true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: 201 });
}
