import { requireRole } from "@/lib/auth";
import Link from "next/link";
import TopBar from "@/components/nav/TopBar";
import BottomNav from "@/components/nav/BottomNav";
import LogoutButton from "@/components/nav/LogoutButton";
import FAB from "@/components/nav/FAB";
import { ToastProvider } from "@/components/ui/Toast";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["encarregado", "admin"]);

  return (
    <ToastProvider>
      <div className="app-scroll-area with-bottom-nav" style={{ background: "var(--bg-page)" }}>
        <TopBar
          title="GN — Campo"
          subtitle={profile.nome}
          right={
            <div className="flex items-center gap-2">
              <Link
                href="/catalogo"
                className="hidden min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm sm:inline-flex"
              >
                Início
              </Link>
              <LogoutButton />
            </div>
          }
        />
        <main className="mx-auto max-w-5xl px-4 py-4 sm:py-6">{children}</main>

        <BottomNav
          items={[
            { href: "/catalogo",       label: "Início",       icon: <IconHome /> },
            { href: "/sincronizar",    label: "Sync",         icon: <IconSync /> },
            { href: "/resumo",         label: "Resultados",   icon: <IconChart /> },
            { href: "/lancamento",     label: "Lançar",       icon: <IconPlus /> },
            { href: "/maquinas",       label: "Manut.",       icon: <IconWrench /> },
            { href: "/planejamento",   label: "Plano",        icon: <IconCalendar /> },
          ]}
        />

        <FAB
          items={[
            {
              label: "Lançar Produção",
              href: "/lancamento",
              color: "#16a34a",
              icon: <IconFABPlus />,
            },
            {
              label: "Reportar Máquina",
              href: "/maquinas",
              color: "#d97706",
              icon: <IconFABWrench />,
            },
          ]}
        />
      </div>
    </ToastProvider>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function IconSync() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2" />
      <path d="M18 3v4h-4" />
      <path d="M6 21v-4h4" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M4 19V5M4 19h16M8 16V9M13 16V7M18 16v-4" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function IconWrench() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M14.7 6.3a4 4 0 0 0 4.9 4.9l-8.4 8.4a2.1 2.1 0 0 1-3-3l8.4-8.4Z" />
      <path d="m5 19 2-2" />
    </svg>
  );
}
function IconFABPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconFABWrench() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
