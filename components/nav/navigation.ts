export type NavigationIconName =
  | "dashboard"
  | "chart"
  | "sync"
  | "plus"
  | "list"
  | "calendar"
  | "target"
  | "package"
  | "machine"
  | "service"
  | "users"
  | "map"
  | "user"
  | "settings"
  | "automation"
  | "wrench";

export type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIconName;
  exact?: boolean;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const ADMIN_NAVIGATION: NavigationGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard", exact: true }],
  },
  {
    label: "Operação",
    items: [
      { href: "/admin/lancamentos", label: "Lançamentos", icon: "list" },
      { href: "/admin/planejamento", label: "Planejamento", icon: "calendar" },
      { href: "/admin/metas", label: "Metas", icon: "target" },
      { href: "/admin/insumos", label: "Insumos", icon: "package" },
      { href: "/admin/maquinas", label: "Frota", icon: "machine" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/admin/atividades", label: "Serviços", icon: "service" },
      { href: "/admin/equipes", label: "Equipes", icon: "users" },
      { href: "/admin/projetos", label: "Projetos", icon: "map" },
      { href: "/admin/usuarios", label: "Usuários", icon: "user" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/entrada", label: "Tela de entrada", icon: "settings" },
      { href: "/admin/automacoes", label: "Automações", icon: "automation" },
    ],
  },
];

export const GESTOR_NAVIGATION: NavigationGroup[] = [
  {
    label: "Gestão",
    items: [{ href: "/gestor", label: "Painel executivo", icon: "chart", exact: true }],
  },
];

export const MAINTENANCE_NAVIGATION: NavigationGroup[] = [
  {
    label: "Manutenção",
    items: [
      { href: "/manutencao", label: "Solicitações", icon: "wrench", exact: true },
      { href: "/manutencao/maquinas", label: "Máquinas", icon: "machine" },
    ],
  },
];

export const FIELD_NAVIGATION: NavigationGroup[] = [
  {
    label: "Operação de campo",
    items: [
      { href: "/sincronizar", label: "Sincronização", icon: "sync" },
      { href: "/resumo", label: "Resultados", icon: "chart" },
      { href: "/lancamento", label: "Novo lançamento", icon: "plus" },
      { href: "/maquinas", label: "Manutenção", icon: "wrench" },
      { href: "/planejamento", label: "Planejamento", icon: "calendar" },
    ],
  },
];
