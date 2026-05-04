"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/branding/Logo";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ROLE_HOME, type UserRole } from "@/lib/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error || !data.user) {
      setErro("E-mail ou senha incorretos.");
      return;
    }
    // descobre o role e redireciona
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = (profile?.role as UserRole) ?? "encarregado";
    const target = from && from !== "/login" ? from : ROLE_HOME[role];
    startTransition(() => {
      router.replace(target);
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      {/* lado esquerdo — branding */}
      <section className="hidden md:flex bg-[var(--color-gn-700)] text-white p-10 flex-col justify-between">
        <Logo size={56} variant="mono-light" withWordmark />
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Gestão de produção <br />
            no campo, sem fricção.
          </h1>
          <p className="mt-3 text-white/80 max-w-md">
            Lançamentos diários, controle de máquinas e dashboards em tempo real
            para a operação de silvicultura da GN.
          </p>
        </div>
        <p className="text-xs text-white/60">© GN — todos os direitos reservados.</p>
      </section>

      {/* lado direito — formulário */}
      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-6 flex justify-center">
            <Logo size={48} withWordmark />
          </div>
          <h2 className="text-2xl font-bold">Entrar</h2>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            Acesse com seu e-mail corporativo.
          </p>

          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.nome@gn.local"
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
            {erro && (
              <p className="text-sm text-[var(--color-danger-500)]">{erro}</p>
            )}
            <Button type="submit" loading={pending} size="md">
              Entrar
            </Button>
          </form>

          <details className="mt-6 text-xs text-[var(--color-ink-500)]">
            <summary className="cursor-pointer">Credenciais de teste</summary>
            <ul className="mt-2 space-y-1">
              <li>encarregado@gn.local · gn123456</li>
              <li>admin@gn.local · gn123456</li>
              <li>gestor@gn.local · gn123456</li>
            </ul>
          </details>
        </div>
      </section>
    </main>
  );
}
