"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { LoginSettings } from "@/lib/app-settings-shared";
import Logo from "@/components/branding/Logo";

function loginErrorMessage(code: string | null) {
  if (code === "credenciais") return "E-mail ou senha incorretos.";
  if (code === "campos") return "Informe e-mail e senha.";
  if (code === "perfil") {
    return "Login válido, mas o perfil do usuário não existe no banco.";
  }
  if (code === "organizacao") {
    return "Sua conta ainda não está vinculada a uma empresa ativa. Fale com o administrador.";
  }
  return null;
}

const inputClassName =
  "h-13 min-h-13 w-full rounded-md border border-[#cfd8d2] bg-white px-4 text-base font-medium text-[#18211f] outline-none transition placeholder:text-[#859189] focus:border-[#2f7455] focus:ring-4 focus:ring-[#2f7455]/10";

export default function LoginClient({ settings }: { settings: LoginSettings }) {
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const error = loginErrorMessage(params.get("erro"));
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!event.currentTarget.checkValidity()) return;
    setSubmitting(true);
  }

  return (
    <main className="min-h-dvh bg-[#173f35] text-[#18211f]">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[minmax(320px,0.82fr)_minmax(520px,1.18fr)]">
        <section className="hidden flex-col border-r border-white/12 px-12 py-12 text-white lg:flex xl:px-16">
          <Logo size={56} variant="mono-light" withWordmark />
          <div className="mt-auto max-w-md border-l-2 border-[#d6a23a] pl-5">
            <p className="text-sm font-medium text-white/68">Gestão operacional florestal</p>
            <p className="mt-2 text-3xl font-semibold leading-tight">Do campo à gestão.</p>
          </div>
        </section>

        <section className="flex min-h-dvh items-center justify-center bg-[#f3f5f2] px-5 py-8 sm:px-8 lg:px-14">
          <div className="w-full max-w-[430px]">
            <header>
              <div className="mb-10 lg:hidden">
                <Logo size={52} withWordmark />
                <p className="mt-2 text-sm font-medium text-[#66736c]">Gestão operacional florestal</p>
              </div>
              <p className="text-xs font-semibold uppercase text-[#2f7455]">Acesso ao sistema</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#18211f]">
                Entre na sua conta
              </h1>
              <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-[#66736c]">
                {settings.instruction}
              </p>
            </header>

            {error && (
              <p
                role="alert"
                className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {error}
              </p>
            )}

            <form
              action="/api/auth/login"
              method="post"
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >
              {from && <input type="hidden" name="from" value={from} />}

              <label className="block" htmlFor="login-email">
                <span className="mb-1.5 block text-sm font-semibold text-[#34413b]">
                  E-mail
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  readOnly={submitting}
                  placeholder="seu.nome@empresa.com.br"
                  className={inputClassName}
                />
              </label>

              <label className="block" htmlFor="login-password">
                <span className="mb-1.5 block text-sm font-semibold text-[#34413b]">
                  Senha
                </span>
                <span className="relative block">
                  <input
                    id="login-password"
                    name="senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    readOnly={submitting}
                    placeholder="••••••••"
                    className={`${inputClassName} pr-24`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={submitting}
                    className="absolute inset-y-1.5 right-1.5 min-w-20 rounded px-3 text-xs font-semibold text-[#235f46] transition hover:bg-[#e8f2ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7455] disabled:opacity-50"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting || undefined}
                className="mt-2 flex h-13 min-h-13 w-full items-center justify-center gap-2 rounded-md border border-[#235f46] bg-[#235f46] px-5 text-base font-semibold text-white transition hover:bg-[#194936] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-70"
              >
                {submitting && (
                  <span
                    aria-hidden
                    className="ui-spinner h-4 w-4"
                  />
                )}
                {submitting ? "Entrando..." : settings.buttonLabel}
              </button>
            </form>
            <footer className="mt-10 border-t border-[#d8dfda] pt-5 text-xs font-medium text-[#7a867f]">
              {settings.footer}
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
