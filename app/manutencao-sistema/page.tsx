import Link from "next/link";

export const dynamic = "force-static";

export default function SystemMaintenancePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-page)] px-5 py-12 text-[var(--text-primary)]">
      <section className="w-full max-w-xl border-l-4 border-[var(--warn)] pl-5 sm:pl-7">
        <p className="text-xs font-bold uppercase text-[var(--warn)]">Manutenção programada</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight">Operação temporariamente pausada</h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-[var(--text-secondary)]">
          Estamos concluindo uma atualização controlada. Nenhum novo apontamento será recebido
          durante esta janela. Os dados já registrados permanecem preservados.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:brightness-95 active:scale-[0.99]"
        >
          Verificar disponibilidade
        </Link>
      </section>
    </main>
  );
}
