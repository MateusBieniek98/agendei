import { requireRole } from "@/lib/auth";
import TopBar from "@/components/nav/TopBar";
import BottomNav from "@/components/nav/BottomNav";
import LogoutButton from "@/components/nav/LogoutButton";
import { ToastProvider } from "@/components/ui/Toast";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Encarregado e admin podem usar a interface de campo (admin pra testar/ajudar).
  const profile = await requireRole(["encarregado", "admin"]);

  return (
    <ToastProvider>
      <div className="min-h-screen pb-24">
        <TopBar
          title="GN — Campo"
          subtitle={profile.nome}
          right={<LogoutButton />}
        />
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>

        <BottomNav
          items={[
            {
              href: "/resumo",
              label: "Resumo",
              icon: <IconChart />,
            },
            {
              href: "/lancamento",
              label: "Lançar",
              icon: <IconPlus />,
            },
            {
              href: "/maquinas",
              label: "Máquinas",
              icon: <IconWrench />,
            },
            {
              href: "/historico",
              label: "Hoje",
              icon: <IconList />,
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
      <circle cx="12" cy="12" r="9" /> <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16V9" />
      <path d="M13 16V7" />
      <path d="M18 16v-4" />
    </svg>
  );
}
function IconWrench() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6l-6 6 2 2 6-6a4 4 0 0 0 5.6-5.6l-2.6 2.6-2-2 2.6-2.6Z" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
