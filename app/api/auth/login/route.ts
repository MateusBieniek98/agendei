// Route handler de login — alternativa ao Server Action.
// Em route handlers, o suporte a Set-Cookie em redirect é nativo
// e completamente confiável em qualquer plataforma de deploy.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const from = String(form.get("from") ?? "");

  if (!email || !senha) {
    return NextResponse.redirect(
      new URL(`/login?erro=campos`, req.url),
      { status: 303 }
    );
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/login?erro=credenciais`, req.url),
      { status: 303 }
    );
  }

  // Nao buscamos o profile aqui. Neste mesmo POST o cookie acabou de ser
  // criado; deixar a pagina raiz decidir o papel na proxima requisicao evita
  // corrida entre auth, cookie e RLS.
  const target = from && from !== "/login" ? from : "/";

  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
