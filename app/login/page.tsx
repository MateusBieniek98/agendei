"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/branding/Logo";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// Wrapper com Suspense — exigência do Next.js 16 para qualquer
// componente que use useSearchParams() (caso contrário falha no build).
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const erro = params.get("erro");
  const error =
    erro === "credenciais"
      ? "E-mail ou senha incorretos."
      : erro === "campos"
        ? "Informe e-mail e senha."
        : erro === "perfil"
          ? "Login válido, mas o perfil do usuário não existe no banco. Rode o script de correção de perfis."
        : null;

  return <LoginShell error={error} from={from} />;
}

function LoginShell({
  error,
  from,
}: {
  error?: string | null;
  from?: string;
} = {}) {
  return (
    <main className="min-h-screen grid bg-[var(--color-ink-50)] text-[var(--color-ink-900)] md:grid-cols-2">
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

      <section className="flex items-center justify-center px-6 py-10 md:p-10">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--color-ink-100)] md:bg-transparent md:p-0 md:shadow-none md:ring-0">
          <div className="md:hidden mb-6 flex justify-center">
            <Logo size={48} withWordmark />
          </div>
          <h2 className="text-2xl font-bold">Entrar</h2>
          <p className="text-sm font-semibold text-[var(--color-ink-700)] mt-1">
            Acesse com seu e-mail corporativo.
          </p>

          <form
            action="/api/auth/login"
            method="post"
            className="mt-6 flex flex-col gap-4"
          >
            {from && <input type="hidden" name="from" value={from} />}
            <Input
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="seu.nome@gn.local"
            />
            <Input
              label="Senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
            {error && (
              <p className="text-sm font-bold text-[var(--color-danger-500)]">{error}</p>
            )}
            <Button type="submit" size="md">
              Entrar
            </Button>
          </form>

          <details className="mt-6 text-xs font-semibold text-[var(--color-ink-700)]">
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
