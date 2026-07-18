"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  DEFAULT_LOGIN_SETTINGS,
  type LoginSettings,
} from "@/lib/app-settings-shared";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export default function EntradaSettingsClient() {
  const [settings, setSettings] = useState<LoginSettings>(
    DEFAULT_LOGIN_SETTINGS
  );
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/app-settings/login", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return;
        setSettings(json.settings ?? DEFAULT_LOGIN_SETTINGS);
        setState("idle");
      })
      .catch(() => {
        if (!alive) return;
        setMessage("Nao foi possivel carregar. Usando texto padrao.");
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const canSave = useMemo(
    () =>
      settings.brandName.trim() &&
      settings.instruction.trim() &&
      settings.buttonLabel.trim(),
    [settings]
  );

  function update<K extends keyof LoginSettings>(
    key: K,
    value: LoginSettings[K]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (state === "saved" || state === "error") {
      setState("idle");
      setMessage("");
    }
  }

  async function save() {
    if (!canSave) {
      setState("error");
      setMessage("Nome, instrução e texto do botão são obrigatórios.");
      return;
    }

    setState("saving");
    setMessage("");

    const res = await fetch("/api/app-settings/login", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setState("error");
      setMessage(json.error ?? "Falha ao salvar texto da entrada.");
      return;
    }

    setSettings(json.settings ?? settings);
    setState("saved");
    setMessage("Texto da tela de entrada atualizado.");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-normal text-[var(--accent)]">
          Branding
        </p>
        <h1 className="text-3xl font-black tracking-normal md:text-4xl">
          Tela de entrada
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-secondary)] md:text-base">
          Edite os textos essenciais exibidos no login, sem poluir a entrada.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
        <section className="gn-card space-y-4 p-4 shadow-sm md:p-5">
          <Input
            label="Nome da marca"
            value={settings.brandName}
            onChange={(event) => update("brandName", event.target.value)}
            placeholder="GN Operações"
          />

          <Input
            label="Instrução de acesso"
            value={settings.instruction}
            onChange={(event) => update("instruction", event.target.value)}
            placeholder="Use seu e-mail corporativo para acessar."
          />

          <Input
            label="Rodape"
            value={settings.footer}
            onChange={(event) => update("footer", event.target.value)}
            placeholder="GN · Uso interno"
          />

          <Input
            label="Texto do botao"
            value={settings.buttonLabel}
            onChange={(event) => update("buttonLabel", event.target.value)}
            placeholder="Entrar"
          />

          {message && (
            <p
              className={
                "rounded-lg border px-4 py-3 text-sm font-bold " +
                (state === "saved"
                  ? "border-green-300 bg-green-50 text-green-800"
                  : "border-red-300 bg-red-50 text-red-800")
              }
            >
              {message}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSettings(DEFAULT_LOGIN_SETTINGS);
                setState("idle");
                setMessage("");
              }}
            >
              Restaurar padrao
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={state === "saving" || !canSave}
            >
              {state === "saving" ? "Salvando..." : "Salvar entrada"}
            </Button>
          </div>
        </section>

        <aside className="relative min-h-[520px] overflow-hidden rounded-[24px] border border-white/20 bg-[#343b8f] p-5 text-[#15182e] shadow-2xl">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.12), transparent 30%), radial-gradient(circle at 82% 88%, rgba(18,24,76,0.2), transparent 34%)",
            }}
          />
          <div className="relative flex h-full items-center justify-center py-5">
            <div className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(12,17,65,0.28)]">
              <Image
                src="/gn-login-logo.jpeg"
                alt="Logo GN"
                width={200}
                height={200}
                className="mx-auto h-20 w-20 rounded-2xl object-cover ring-1 ring-[#343b8f]/10"
              />
              <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[#343b8f]">
                {settings.brandName}
              </p>
              <h2 className="mt-5 text-2xl font-black tracking-tight">
                Acesse sua conta
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-[#687086]">
                {settings.instruction}
              </p>
              <div className="mt-6 rounded-xl bg-[#343b8f] px-5 py-3 text-center text-base font-bold text-white">
                {settings.buttonLabel}
              </div>
            </div>
          </div>
          <p className="absolute inset-x-4 bottom-4 text-center text-xs font-bold text-white/70">
            {settings.footer}
          </p>
        </aside>
      </div>
    </div>
  );
}
