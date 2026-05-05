// Criação de usuário com service_role.
// Só admin autenticado pode chamar — validamos via cookie/profile antes
// de usar a chave service. A service_role NUNCA é exposta ao cliente.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLES: UserRole[] = ["encarregado", "admin", "gestor"];

export async function POST(req: NextRequest) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Adicione " +
          "essa variável de ambiente no Vercel (Settings → Environment Variables).",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "");
  const nome = String(body.nome ?? "").trim();
  const role = String(body.role ?? "") as UserRole;
  const equipe_id: string | null = body.equipe_id ?? null;

  if (!email || !senha || !nome || !role) {
    return NextResponse.json(
      { error: "campos obrigatórios: email, senha, nome, role" },
      { status: 400 }
    );
  }
  if (senha.length < 6) {
    return NextResponse.json(
      { error: "senha precisa ter pelo menos 6 caracteres" },
      { status: 400 }
    );
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "role inválido" }, { status: 400 });
  }

  // Cliente admin (service_role) — só usado nesta rota, server-side.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  // 1) Cria usuário no Auth (já confirmado, sem precisar de e-mail).
  const { data: created, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, role },
  });

  if (errAuth || !created.user) {
    return NextResponse.json(
      { error: errAuth?.message ?? "falha ao criar usuário" },
      { status: 400 }
    );
  }

  // 2) Cria/atualiza profile.
  const { error: errProfile } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email,
      nome,
      role,
      equipe_id,
      ativo: true,
    },
    { onConflict: "id" }
  );

  if (errProfile) {
    // limpa o auth.user pra não deixar lixo
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ error: errProfile.message }, { status: 400 });
  }

  return NextResponse.json(
    { item: { id: created.user.id, email, nome, role, equipe_id, ativo: true } },
    { status: 201 }
  );
}
