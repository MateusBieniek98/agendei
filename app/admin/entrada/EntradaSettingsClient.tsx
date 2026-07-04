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
      settings.title.trim() &&
      settings.subtitle.trim() &&
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
      setMessage("Titulo, subtitulo e texto do botao sao obrigatorios.");
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
          Edite o texto exibido no login sem precisar fazer novo deploy.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
        <section className="gn-card space-y-4 p-4 shadow-sm md:p-5">
          <Input
            label="Texto pequeno acima do titulo"
            value={settings.eyebrow}
            onChange={(event) => update("eyebrow", event.target.value)}
            placeholder="GN Silvicultura"
          />

          <Input
            label="Titulo principal"
            value={settings.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Gestao de producao no campo"
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              Subtitulo
            </span>
            <textarea
              value={settings.subtitle}
              onChange={(event) => update("subtitle", event.target.value)}
              rows={4}
              className="min-h-28 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-3 text-base font-bold text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--border-focus)]"
              placeholder="Explique o valor do app em uma frase clara."
            />
          </label>

          <Input
            label="Rodape"
            value={settings.footer}
            onChange={(event) => update("footer", event.target.value)}
            placeholder="GN - todos os direitos reservados."
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

        <aside className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-[#08111d] p-5 text-white shadow-2xl">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-45"
            style={{ backgroundImage: "url('/gn-login-bg.jpg')" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[#08111d]/80"
          />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/gn-logo-card.jpeg"
                alt="GN"
                width={56}
                height={56}
                className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/20"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-normal text-blue-100">
                  {settings.eyebrow}
                </p>
                <p className="text-lg font-bold">GN</p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold leading-tight tracking-normal">
                {settings.title}
              </h2>
              <p className="mt-4 text-base font-semibold leading-7 text-blue-50/85">
                {settings.subtitle}
              </p>
              <div className="mt-7 rounded-lg bg-[var(--accent)] px-5 py-3 text-center text-base font-bold shadow-xl">
                {settings.buttonLabel}
              </div>
            </div>

            <p className="text-xs font-bold text-white/55">{settings.footer}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
