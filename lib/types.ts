// Tipos compartilhados entre client e server.
// Espelham as tabelas de lib/db/schema.sql.

export type UserRole = "encarregado" | "admin" | "gestor";
export type MachineStatus = "operando" | "parada" | "manutencao_urgente";
export type MaintenanceStatus = "aberto" | "em_andamento" | "resolvido";

export type Profile = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  equipe_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Equipe = {
  id: string;
  nome: string;
  descricao: string | null;
  encarregado_id: string | null;
  ativo: boolean;
  created_at: string;
};

export type Atividade = {
  id: string;
  nome: string;
  unidade: string;
  valor_unitario: number;
  ativo: boolean;
  created_at: string;
};

export type Producao = {
  id: string;
  data: string; // yyyy-mm-dd
  equipe_id: string;
  atividade_id: string;
  quantidade: number;
  observacoes: string | null;
  valor_unitario_snapshot: number;
  registrado_por: string;
  editado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type Maquina = {
  id: string;
  nome: string;
  tipo: string;
  identificador: string | null;
  status: MachineStatus;
  ativo: boolean;
  created_at: string;
};

export type Manutencao = {
  id: string;
  maquina_id: string;
  descricao: string;
  status: MaintenanceStatus;
  reportado_por: string;
  resolvido_em: string | null;
  created_at: string;
};

export type Meta = {
  id: string;
  ano: number;
  mes: number;
  valor_meta: number;
  observacoes: string | null;
  created_at: string;
};

// rota inicial por papel (login → redirect)
export const ROLE_HOME: Record<UserRole, string> = {
  encarregado: "/lancamento",
  admin: "/admin",
  gestor: "/gestor",
};
