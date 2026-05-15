import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  notifyApontamentosSheet,
  type SheetsSyncAction,
} from "@/lib/google-sheets-apontamentos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS = new Set<SheetsSyncAction>([
  "atualizar_apontamentos",
  "rodar_fluxo_completo",
]);

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "A sincronização com a planilha é restrita ao administrador." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const acao = String(body.acao ?? "atualizar_apontamentos") as SheetsSyncAction;

  if (!ACTIONS.has(acao)) {
    return NextResponse.json({ error: "acao invalida" }, { status: 400 });
  }

  const error = await notifyApontamentosSheet("manual", null, {
    acao,
    solicitadoPor: profile.email || profile.nome,
    timeoutMs: acao === "rodar_fluxo_completo" ? 25000 : 12000,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    acao,
    requested_by: profile.email || profile.nome,
    timestamp: new Date().toISOString(),
  });
}
