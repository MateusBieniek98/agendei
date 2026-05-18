"use client";

import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { LoginSettings } from "@/lib/app-settings-shared";

function loginErrorMessage(code: string | null) {
  if (code === "credenciais") return "E-mail ou senha incorretos.";
  if (code === "campos") return "Informe e-mail e senha.";
  if (code === "perfil") {
    return "Login válido, mas o perfil do usuário não existe no banco.";
  }
  return null;
}

export default function LoginClient({ settings }: { settings: LoginSettings }) {
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const error = loginErrorMessage(params.get("erro"));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101f] text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/gn-login-bg.jpg')" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(3,10,24,0.94), rgba(6,16,31,0.86) 42%, rgba(6,16,31,0.72))",
        }}
      />

      <section className="relative z-10 grid min-h-screen px-5 py-8 md:grid-cols-[1.05fr_0.95fr] md:px-10 lg:px-16">
        <div className="flex min-h-[38vh] flex-col justify-between pb-8 md:min-h-0 md:py-10">
          <div className="inline-flex items-center gap-3">
            <img
              src="/gn-logo-card.jpeg"
              alt="GN"
              className="h-16 w-16 rounded-2xl object-cover shadow-2xl ring-1 ring-white/20"
            />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">
                {settings.eyebrow}
              </p>
              <p className="mt-1 text-lg font-black text-white">GN</p>
            </div>
          </div>

          <div className="max-w-2xl">
            <p className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-blue-100 backdrop-blur">
              Operação de campo
            </p>
            <h1 className="text-4xl font-black leading-[1.02] tracking-normal text-white sm:text-5xl lg:text-6xl">
              {settings.title}
            </h1>
            <p className="mt-5 max-w-xl text-base font-bold leading-7 text-blue-50/90 sm:text-lg">
              {settings.subtitle}
            </p>
          </div>

          <p className="hidden text-xs font-bold text-white/55 md:block">
            {settings.footer}
          </p>
        </div>

        <div className="flex items-center justify-center md:justify-end">
          <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-[#071426]/88 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
            <div className="mb-7 md:hidden">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-200">
                {settings.eyebrow}
              </p>
            </div>

            <h2 className="text-3xl font-black">Entrar</h2>
            <p className="mt-2 text-sm font-bold text-blue-100/80">
              Acesse com seu e-mail corporativo.
            </p>

            <form action="/api/auth/login" method="post" className="mt-7 space-y-5">
              {from && <input type="hidden" name="from" value={from} />}
              <Input
                label="E-mail"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="seu.nome@gn.local"
                labelClassName="text-blue-50"
                className="bg-white text-slate-950"
              />
              <Input
                label="Senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                labelClassName="text-blue-50"
                className="bg-white text-slate-950"
              />
              {error && (
                <p className="rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100">
                  {error}
                </p>
              )}
              <Button type="submit" size="field" className="w-full">
                {settings.buttonLabel}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
