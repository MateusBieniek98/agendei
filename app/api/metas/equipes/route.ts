import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MetaEquipeInput = {
  equipe_id: string;
  valor_meta: number;
  observacoes: string | null;
};

type MetaEquipeRow = {
  id: string;
  ano: number;
  mes: number;
  equipe_id: string;
  valor_meta: number;
  observacoes: string | null;
  equipes: { nome: string } | null;
};

function cents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parsePeriodo(req: NextRequest) {
  const now = new Date();
  const ano = Number(req.nextUrl.searchParams.get("ano") ?? now.getFullYear());
  const mes = Number(req.nextUrl.searchParams.get("mes") ?? now.getMonth() + 1);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false as const, error: "Ano inválido." };
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { ok: false as const, error: "Mês inválido." };
  }
  return { ok: true as const, ano, mes };
}

async function buscarResumo(ano: number, mes: number) {
  const supabase = await createSupabaseServer();

  const [{ data: metaMensal }, { data: equipes }] = await Promise.all([
    supabase
      .from("metas")
      .select("id, ano, mes, valor_meta, observacoes")
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle(),
    supabase
      .from("equipes")
      .select("id, nome, descricao, encarregado_id, ativo, created_at")
      .eq("ativo", true)
      .order("nome"),
  ]);

  const { data: metasEquipe, error: metasEquipeError } = await supabase
    .from("metas_equipes")
    .select("id, ano, mes, equipe_id, valor_meta, observacoes, equipes(nome)")
    .eq("ano", ano)
    .eq("mes", mes)
    .order("created_at");

  const items = metasEquipeError ? [] : ((metasEquipe ?? []) as unknown as MetaEquipeRow[]);
  const totalEquipes = items.reduce((sum, item) => sum + Number(item.valor_meta ?? 0), 0);
  const metaMensalValor = Number(metaMensal?.valor_meta ?? 0);

  return {
    metaMensal,
    equipes: equipes ?? [],
    items,
    totalEquipes,
    diferenca: metaMensalValor - totalEquipes,
    setupPendente: Boolean(metasEquipeError),
    setupError: metasEquipeError?.message ?? null,
  };
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = parsePeriodo(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const resumo = await buscarResumo(parsed.ano, parsed.mes);
  return NextResponse.json(resumo);
}

export async function PUT(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || Array.isArray(body)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const ano = Number(body.ano);
  const mes = Number(body.mes);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "Informe as metas por equipe." }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: metaMensal, error: metaError } = await supabase
    .from("metas")
    .select("valor_meta")
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

  if (metaError) return NextResponse.json({ error: metaError.message }, { status: 400 });
  if (!metaMensal) {
    return NextResponse.json(
      { error: "Cadastre a meta mensal antes de distribuir por equipe." },
      { status: 400 }
    );
  }

  const { data: equipes } = await supabase.from("equipes").select("id").eq("ativo", true);
  const equipesValidas = new Set((equipes ?? []).map((e) => String(e.id)));
  const byEquipe = new Map<string, MetaEquipeInput>();

  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
    const item = rawItem as Record<string, unknown>;
    const equipeId = String(item.equipe_id ?? "").trim();
    const valorMeta = Number(item.valor_meta ?? 0);
    const observacoes =
      typeof item.observacoes === "string" && item.observacoes.trim()
        ? item.observacoes.trim()
        : null;

    if (!equipeId || !equipesValidas.has(equipeId)) {
      return NextResponse.json({ error: "Equipe inválida na distribuição." }, { status: 400 });
    }
    if (!Number.isFinite(valorMeta) || valorMeta < 0) {
      return NextResponse.json({ error: "Valor de meta por equipe inválido." }, { status: 400 });
    }
    byEquipe.set(equipeId, { equipe_id: equipeId, valor_meta: valorMeta, observacoes });
  }

  const payload = [...byEquipe.values()].filter((item) => cents(item.valor_meta) > 0);
  const totalCents = payload.reduce((sum, item) => sum + cents(item.valor_meta), 0);
  const metaCents = cents(Number(metaMensal.valor_meta ?? 0));

  if (totalCents !== metaCents) {
    const diferenca = (metaCents - totalCents) / 100;
    return NextResponse.json(
      {
        error: `A soma das metas por equipe precisa ser igual à meta mensal. Diferença: ${brl(diferenca)}.`,
      },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("metas_equipes")
    .delete()
    .eq("ano", ano)
    .eq("mes", mes);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  if (payload.length > 0) {
    const { error: insertError } = await supabase.from("metas_equipes").insert(
      payload.map((item) => ({
        ano,
        mes,
        equipe_id: item.equipe_id,
        valor_meta: item.valor_meta,
        observacoes: item.observacoes,
      }))
    );

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const resumo = await buscarResumo(ano, mes);
  return NextResponse.json(resumo);
}

export async function DELETE(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = parsePeriodo(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("metas_equipes")
    .delete()
    .eq("ano", parsed.ano)
    .eq("mes", parsed.mes);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
