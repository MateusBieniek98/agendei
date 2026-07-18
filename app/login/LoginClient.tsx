"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { LoginSettings } from "@/lib/app-settings-shared";

function loginErrorMessage(code: string | null) {
  if (code === "credenciais") return "E-mail ou senha incorretos.";
  if (code === "campos") return "Informe e-mail e senha.";
  if (code === "perfil") {
    return "Login válido, mas o perfil do usuário não existe no banco.";
  }
  return null;
}

const inputClassName =
  "h-13 min-h-13 w-full rounded-xl border border-[#d9ddeb] bg-[#f7f8fc] px-4 text-base font-semibold text-[#15182e] outline-none transition placeholder:text-[#9298ad] focus:border-[#343b8f] focus:bg-white focus:ring-4 focus:ring-[#343b8f]/10";

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
    <main className="relative min-h-dvh overflow-hidden bg-[#343b8f] text-[#15182e]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.12), transparent 30%), radial-gradient(circle at 82% 88%, rgba(18,24,76,0.2), transparent 34%)",
        }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <section className="flex flex-1 items-center justify-center px-4 py-7 sm:px-6 sm:py-10">
          <div className="w-full max-w-[420px] rounded-[28px] border border-white/35 bg-white px-5 py-6 shadow-[0_28px_80px_rgba(12,17,65,0.28)] sm:px-8 sm:py-8">
            <header className="text-center">
              <Image
                src="/gn-login-logo.jpeg"
                alt="Logo GN"
                width={200}
                height={200}
                priority
                className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-sm ring-1 ring-[#343b8f]/10 sm:h-24 sm:w-24"
              />
              <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[#343b8f]">
                {settings.brandName}
              </p>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#15182e] sm:text-[1.75rem]">
                Acesse sua conta
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-[#687086]">
                {settings.instruction}
              </p>
            </header>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
              >
                {error}
              </p>
            )}

            <form
              action="/api/auth/login"
              method="post"
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              {from && <input type="hidden" name="from" value={from} />}

              <label className="block" htmlFor="login-email">
                <span className="mb-1.5 block text-sm font-bold text-[#34384b]">
                  E-mail
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={submitting}
                  placeholder="seu.nome@gn.local"
                  className={inputClassName}
                />
              </label>

              <label className="block" htmlFor="login-password">
                <span className="mb-1.5 block text-sm font-bold text-[#34384b]">
                  Senha
                </span>
                <span className="relative block">
                  <input
                    id="login-password"
                    name="senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={submitting}
                    placeholder="••••••••"
                    className={`${inputClassName} pr-24`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={submitting}
                    className="absolute inset-y-1.5 right-1.5 min-w-20 rounded-lg px-3 text-xs font-extrabold text-[#343b8f] transition hover:bg-[#e9eafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#343b8f] disabled:opacity-50"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex h-13 min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-[#343b8f] bg-[#343b8f] px-5 text-base font-bold text-white transition hover:bg-[#293074] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-70"
              >
                {submitting && (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                )}
                {submitting ? "Entrando..." : settings.buttonLabel}
              </button>
            </form>
          </div>
        </section>

        <footer className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs font-semibold text-white/70">
          {settings.footer}
        </footer>
      </div>
    </main>
  );
}
