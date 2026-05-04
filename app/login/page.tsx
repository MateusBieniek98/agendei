"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/branding/Logo";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { loginAction } from "./actions";

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
  const [state, formAction, pending] = useActionState(loginAction, {
    error: null as string | null,
  });

  return <LoginShell error={state.error} pending={pending} action={formAction} from={from} />;
}

function LoginShell({
  error,
  pending,
  action,
  from,
}: {
  error?: string | null;
  pending?: boolean;
  action?: (formData: FormData) => void;
  from?: string;
} = {}) {
  return (
    <main className="min-h-screen grid md:grid-cols-2">
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

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-6 flex justify-center">
            <Logo size={48} withWordmark />
          </div>
          <h2 className="text-2xl font-bold">Entrar</h2>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            Acesse com seu e-mail corporativo.
          </p>

          <form action={action} className="mt-6 flex flex-col gap-4">
            {from && <input type="hidden" name="from" value={from} />}
            <Input
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="seu.nome@gn.local"
              disabled={!action || pending}
            />
            <Input
              label="Senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={!action || pending}
            />
            {error && (
              <p className="text-sm text-[var(--color-danger-500)]">{error}</p>
            )}
            <Button type="submit" loading={pending} size="md" disabled={!action}>
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
