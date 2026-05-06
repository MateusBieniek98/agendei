import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insumosToColumns } from "@/lib/insumos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProducaoSyncRow = {
  id: string;
  data: string;
  quantidade: number | string;
  talhao: string | null;
  descarte: number | string | null;
  insumos: unknown;
  valor_unitario_snapshot: number | string;
  observacoes: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
  equipes: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
  projetos: { nome: string } | null;
};

type ProfileRow = {
  id: string;
  nome: string;
  email: string;
};

const HEADERS = [
  "ID",
  "Data",
  "Projeto",
  "Talhão",
  "Atividade",
  "Equipe",
  "Quantidade",
  "Unidade",
  "Descarte",
  "Insumo 1",
  "QTD 1",
  "Insumo 2",
  "QTD 2",
  "Insumo 3",
  "QTD 3",
  "Insumo 4",
  "QTD 4",
  "Insumo 5",
  "QTD 5",
  "Tarifa",
  "Faturamento",
  "Observações",
  "Lançado por",
  "Criado em",
  "Atualizado em",
];

function bearer(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function requestedToken(req: NextRequest) {
  return bearer(req) || req.nextUrl.searchParams.get("token") || "";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const expectedToken = process.env.GOOGLE_SHEETS_SYNC_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "GOOGLE_SHEETS_SYNC_TOKEN não configurado no servidor." },
      { status: 500 }
    );
  }

  if (requestedToken(req) !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const escopo = sp.get("escopo") ?? "tudo";
  const hoje = todayISO();
  let de = sp.get("data_de");
  const ate = sp.get("data_ate") ?? hoje;

  if (!de && escopo === "hoje") de = hoje;
  if (!de && escopo === "semana") de = addDaysISO(-6);
  if (!de && escopo === "mes") de = `${hoje.slice(0, 8)}01`;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const pageSize = 1000;
  let from = 0;
  const producao: ProducaoSyncRow[] = [];

  while (true) {
    let q = supabase
      .from("producao")
      .select(
        "id, data, quantidade, talhao, descarte, insumos, " +
          "valor_unitario_snapshot, observacoes, " +
          "registrado_por, created_at, updated_at, " +
          "equipes(nome), atividades(nome, unidade), projetos(nome)"
      )
      .order("data", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (de) q = q.gte("data", de);
    if (ate) q = q.lte("data", ate);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []) as unknown as ProducaoSyncRow[];
    producao.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const profileIds = Array.from(
    new Set(producao.map((p) => p.registrado_por).filter(Boolean))
  ) as string[];
  const profiles = new Map<string, ProfileRow>();

  if (profileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", profileIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    for (const p of (data ?? []) as ProfileRow[]) profiles.set(p.id, p);
  }

  const rows = producao.map((p) => {
    const quantidade = Number(p.quantidade ?? 0);
    const tarifa = Number(p.valor_unitario_snapshot ?? 0);
    const profile = p.registrado_por ? profiles.get(p.registrado_por) : null;
    const insumos = insumosToColumns(p.insumos);

    return [
      p.id,
      p.data,
      p.projetos?.nome ?? "",
      p.talhao ?? "",
      p.atividades?.nome ?? "",
      p.equipes?.nome ?? "",
      quantidade,
      p.atividades?.unidade ?? "",
      p.descarte === null ? "" : Number(p.descarte),
      ...insumos.flatMap((insumo) =>
        insumo ? [insumo.nome, insumo.quantidade] : ["", ""]
      ),
      tarifa,
      quantidade * tarifa,
      p.observacoes ?? "",
      profile?.nome ?? profile?.email ?? "",
      p.created_at,
      p.updated_at,
    ];
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      escopo,
      data_de: de,
      data_ate: ate,
      count: rows.length,
      headers: HEADERS,
      rows,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
