import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE() {
  const supabase = await createSupabaseServer();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Serviço administrativo indisponível." },
      { status: 503 }
    );
  }

  const { data, error } = await admin.auth.admin.mfa.listFactors({
    userId: auth.user.id,
  });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível preparar o autenticador." },
      { status: 502 }
    );
  }

  const incomplete = data.factors.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified"
  );
  const results = await Promise.all(
    incomplete.map((factor) =>
      admin.auth.admin.mfa.deleteFactor({
        userId: auth.user.id,
        id: factor.id,
      })
    )
  );
  if (results.some((result) => result.error)) {
    return NextResponse.json(
      { error: "Não foi possível reiniciar a configuração do autenticador." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, removed: incomplete.length });
}
