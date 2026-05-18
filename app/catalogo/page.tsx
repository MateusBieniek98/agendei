import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/branding/Logo";
import LogoutButton from "@/components/nav/LogoutButton";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { getCurrentAuthContext } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

type CatalogItem = {
  title: string;
  subtitle: string;
  href: string;
  accent: string;
  meta: string;
  cta: string;
};

const catalogByRole: Record<UserRole, CatalogItem[]> = {
  admin: [
    {
      title: "Administracao",
      subtitle: "Dashboard, cadastros, usuarios, metas e planejamento.",
      href: "/admin",
      accent: "from-blue-500 to-cyan-400",
      meta: "Controle geral",
      cta: "Abrir painel",
    },
    {
      title: "Campo",
      subtitle: "Lancamentos, sincronizacao, historico e resultados.",
      href: "/sincronizar",
      accent: "from-emerald-500 to-lime-300",
      meta: "Operacao diaria",
      cta: "Abrir campo",
    },
    {
      title: "Gestor",
      subtitle: "Faturamento, alertas, maquinas e visao executiva.",
      href: "/gestor?tab=faturamento",
      accent: "from-amber-400 to-orange-500",
      meta: "Decisao rapida",
      cta: "Ver executivo",
    },
    {
      title: "Texto da entrada",
      subtitle: "Atualize o titulo e as mensagens exibidas no login.",
      href: "/admin/entrada",
      accent: "from-violet-500 to-fuchsia-500",
      meta: "Branding",
      cta: "Editar entrada",
    },
  ],
  encarregado: [
    {
      title: "Sincronizar",
      subtitle: "Envie apontamentos offline e acompanhe o status da fila.",
      href: "/sincronizar",
      accent: "from-blue-500 to-cyan-400",
      meta: "Primeiro passo",
      cta: "Sincronizar",
    },
    {
      title: "Lancar producao",
      subtitle: "Registre projeto, talhao, atividade, hectares e insumos.",
      href: "/lancamento",
      accent: "from-emerald-500 to-lime-300",
      meta: "Campo",
      cta: "Lançar agora",
    },
    {
      title: "Manutencao",
      subtitle: "Reporte problema de maquina e acompanhe OS pendentes.",
      href: "/maquinas",
      accent: "from-red-500 to-amber-400",
      meta: "Pedido rapido",
      cta: "Abrir manut.",
    },
    {
      title: "Resultados",
      subtitle: "Veja seu faturamento, produtividade e apontamentos.",
      href: "/resumo",
      accent: "from-amber-400 to-orange-500",
      meta: "Seu acesso",
      cta: "Ver resultados",
    },
    {
      title: "Plano",
      subtitle: "Acompanhe o planejamento liberado para execucao.",
      href: "/planejamento",
      accent: "from-violet-500 to-fuchsia-500",
      meta: "Proximas frentes",
      cta: "Ver plano",
    },
  ],
  gestor: [
    {
      title: "Visao executiva",
      subtitle: "Abre direto nos KPIs de faturamento, meta e tendencia.",
      href: "/gestor?tab=faturamento",
      accent: "from-blue-500 to-cyan-400",
      meta: "Resumo",
      cta: "Ver faturamento",
    },
    {
      title: "Alertas",
      subtitle: "Abre direto nas maquinas com problema e pendencias.",
      href: "/gestor?tab=manutencao",
      accent: "from-red-500 to-amber-400",
      meta: "Acao necessaria",
      cta: "Ver alertas",
    },
    {
      title: "Planejamento",
      subtitle: "Abre direto no plano previsto, atrasado ou em execucao.",
      href: "/gestor?tab=planejamento",
      accent: "from-emerald-500 to-lime-300",
      meta: "Estrategia",
      cta: "Ver planejamento",
    },
  ],
};

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const { hasUser, profile } = await getCurrentAuthContext();
  if (!hasUser) redirect("/login?from=/catalogo");
  if (!profile) redirect("/login?erro=perfil");

  const items = catalogByRole[profile.role];

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
            "linear-gradient(180deg, rgba(3,10,24,0.92), rgba(3,10,24,0.98) 64%, #030814)",
        }}
      />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-6 lg:px-8">
        <header className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-3 py-3 shadow-2xl backdrop-blur md:px-4">
          <Logo size={34} variant="mono-light" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black leading-tight">
              Ola, {profile.nome.split(" ")[0]}
            </p>
            <p className="truncate text-xs font-bold uppercase tracking-normal text-blue-100/75">
              Escolha onde quer trabalhar agora
            </p>
          </div>
          <ThemeToggle className="text-white/70 hover:bg-white/10" />
          <LogoutButton className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98]" />
        </header>

        <div className="flex flex-1 flex-col justify-center py-8 md:py-12">
          <div className="mb-7 max-w-3xl">
            <p className="mb-3 inline-flex rounded-full border border-blue-300/30 bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-normal text-blue-100">
              GN Silvicultura
            </p>
            <h1 className="text-3xl font-black leading-tight tracking-normal sm:text-5xl">
              Selecione sua area de trabalho
            </h1>
            <p className="mt-3 text-base font-bold leading-7 text-blue-50/80">
              Escolha uma acao para abrir exatamente a tela de trabalho certa,
              sem passar por caminhos intermediarios.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <Link
                key={`${item.title}-${item.href}`}
                href={item.href}
                className="group relative min-h-[180px] overflow-hidden rounded-[1.35rem] border border-white/12 bg-white/9 p-5 shadow-2xl backdrop-blur transition active:scale-[0.99] md:min-h-[220px] md:hover:-translate-y-1"
              >
                <div
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.accent}`}
                />
                <div
                  aria-hidden
                  className={`absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${item.accent} opacity-20 blur-2xl transition group-hover:opacity-35`}
                />
                <div className="relative flex h-full flex-col justify-between gap-8">
                  <div>
                    <p className="text-xs font-black uppercase tracking-normal text-blue-100/70">
                      {item.meta}
                    </p>
                    <h2 className="mt-3 text-2xl font-black tracking-normal text-white">
                      {item.title}
                    </h2>
                    <p className="mt-3 text-sm font-bold leading-6 text-blue-50/75">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white">
                    {item.cta}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-2 h-4 w-4"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
