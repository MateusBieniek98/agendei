// Tipos compartilhados entre client e server.
// Espelham as tabelas de lib/db/schema.sql.

export type UserRole = "encarregado" | "admin" | "gestor";
export type MachineStatus = "operando" | "parada" | "manutencao_urgente";
export type MaintenanceStatus = "aberto" | "em_andamento" | "resolvido";
export type PlanningStatus = "planejado" | "em_execucao" | "concluido" | "cancelado";

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

export type Projeto = {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
};

export type Talhao = {
  id: string;
  projeto_id: string;
  codigo: string;
  area_ha: number | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjetoComTalhoes = Projeto & {
  talhoes: Talhao[];
};

export type Producao = {
  id: string;
  data: string; // yyyy-mm-dd
  equipe_id: string;
  atividade_id: string;
  projeto_id: string | null;
  talhao: string | null;
  quantidade: number;
  insumos: { nome: string; quantidade: number }[];
  descarte: number | null;
  observacoes: string | null;
  valor_unitario_snapshot: number;
  registrado_por: string;
  editado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type Planejamento = {
  id: string;
  ano: number;
  mes: number;
  projeto_id: string;
  talhao: string;
  atividade_id: string;
  equipe_id: string | null;
  quantidade_prevista: number | null;
  data_inicio: string | null;
  data_limite: string;
  status: PlanningStatus;
  observacoes: string | null;
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
  equipe_id: string | null;
  projeto_id: string | null;
  talhao: string | null;
  descricao: string;
  status: MaintenanceStatus;
  reportado_por: string;
  resolvido_em: string | null;
  created_at: string;
};

export type MentionableProfile = {
  id: string;
  nome: string;
  role: UserRole;
  equipe_id: string | null;
  equipes?: { nome: string } | null;
};

export type ManutencaoAnexo = {
  id: string;
  manutencao_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  url?: string | null;
};

export type ManutencaoMencao = {
  id: string;
  manutencao_id: string;
  comentario_id: string | null;
  mentioned_profile_id: string;
  mentioned_by: string;
  read_at: string | null;
  created_at: string;
  mentioned?: MentionableProfile | null;
};

export type ManutencaoComentario = {
  id: string;
  manutencao_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  autor?: MentionableProfile | null;
  mencoes?: ManutencaoMencao[];
};

export type ManutencaoThread = Manutencao & {
  maquinas: {
    nome: string;
    tipo: string;
    identificador: string | null;
    status: MachineStatus;
  } | null;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
  autor: MentionableProfile | null;
  anexos: ManutencaoAnexo[];
  comentarios: ManutencaoComentario[];
  comentarios_count: number;
  unread_mentions_count: number;
  mentioned_profile_ids: string[];
  can_comment: boolean;
  can_resolve: boolean;
  can_manage_status: boolean;
};

export type Meta = {
  id: string;
  ano: number;
  mes: number;
  valor_meta: number;
  observacoes: string | null;
  created_at: string;
};

export type MetaEquipe = {
  id: string;
  ano: number;
  mes: number;
  equipe_id: string;
  valor_meta: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaAtividade = {
  id: string;
  ano: number;
  mes: number;
  atividade_id: string;
  equipe_id: string | null;
  profile_id: string | null;
  quantidade_meta: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

// rota inicial por papel (login → redirect)
export const ROLE_HOME: Record<UserRole, string> = {
  encarregado: "/sincronizar",
  admin: "/admin",
  gestor: "/gestor",
};
