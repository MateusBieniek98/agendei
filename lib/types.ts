// Tipos compartilhados entre client e server.
// Espelham as tabelas de lib/db/schema.sql.

export type UserRole = "encarregado" | "admin" | "gestor" | "manutencao";
export type MachineStatus = "operando" | "parada" | "manutencao_urgente";
export type MaintenanceStatus = "aberto" | "em_andamento" | "resolvido";
export type MaintenancePriority = "normal" | "alta" | "urgente";
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
  talhao_id: string | null;
  talhao: string | null;
  quantidade: number;
  insumos: InsumoLancamento[];
  descarte: number | null;
  estoque_controlado?: boolean;
  observacoes: string | null;
  valor_unitario_snapshot: number;
  registrado_por: string;
  editado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type Insumo = {
  id: string;
  codigo: string | null;
  nome: string;
  grupo: string;
  unidade: string;
  saldo_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type InsumoMovimentacaoTipo =
  | "entrada"
  | "ajuste"
  | "saida_apontamento"
  | "estorno_apontamento";

export type InsumoMovimentacao = {
  id: string;
  insumo_id: string;
  tipo: InsumoMovimentacaoTipo;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  producao_id: string | null;
  usuario_id: string | null;
  observacoes: string | null;
  created_at: string;
};

export type InsumoLancamento = {
  insumo_id?: string;
  id?: string;
  codigo?: string | null;
  nome: string;
  unidade?: string | null;
  quantidade: number;
};

export type InsumoLancamentoControlado = {
  insumo_id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
};

export type Planejamento = {
  id: string;
  ano: number;
  mes: number;
  projeto_id: string;
  talhao_id: string | null;
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
  talhao_id: string | null;
  talhao: string | null;
  descricao: string;
  status: MaintenanceStatus;
  prioridade: MaintenancePriority;
  reportado_por: string;
  responsavel_id: string | null;
  iniciado_em: string | null;
  concluido_por: string | null;
  relato_conclusao: string | null;
  resolvido_em: string | null;
  situacao_atual: string;
  situacao_atualizada_em: string;
  parada_desde: string;
  parada_ate: string | null;
  created_at: string;
};

export type OperationalAllocationResource = "equipe" | "maquina";

export type OperationalAllocation = {
  id: string;
  projeto_id: string;
  talhao_id: string;
  equipe_id: string | null;
  maquina_id: string | null;
  iniciado_em: string;
  encerrado_em: string | null;
  observacoes: string | null;
  alocado_por: string;
  created_at: string;
  projetos?: { nome: string } | null;
  talhoes?: Pick<Talhao, "id" | "codigo" | "area_ha" | "ativo"> | null;
  equipes?: { nome: string } | null;
  maquinas?: { nome: string; identificador: string | null; status: MachineStatus } | null;
  autor?: { nome: string } | null;
};

export type ProjectSummary = {
  projeto: Projeto;
  periodo: { de: string; ate: string; label: string };
  talhoes: Array<Talhao & {
    producao_valor: number;
    lancamentos: number;
    planejamentos: number;
    manutencoes_abertas: number;
  }>;
  kpis: {
    area_total_ha: number;
    talhoes_ativos: number;
    producao_valor: number;
    lancamentos: number;
    planejamentos: number;
    planejamentos_concluidos: number;
    planejamentos_atrasados: number;
    equipes_alocadas: number;
    maquinas_alocadas: number;
    manutencoes_abertas: number;
  };
  serie: Array<{ data: string; valor: number }>;
  por_atividade: Array<{
    atividade_id: string;
    nome: string;
    unidade: string;
    previsto: number;
    realizado: number;
  }>;
  alocacoes: OperationalAllocation[];
};

export type ManutencaoEvento = {
  id: string;
  manutencao_id: string | null;
  maquina_id: string;
  tipo:
    | "criado"
    | "atribuido"
    | "iniciado"
    | "prioridade_alterada"
    | "concluido"
    | "status_maquina_alterado"
    | "situacao_atualizada";
  ator_id: string | null;
  dados: Record<string, unknown>;
  created_at: string;
  ator?: Pick<MentionableProfile, "id" | "nome" | "role"> | null;
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
  responsavel: MentionableProfile | null;
  concluido_por_profile: MentionableProfile | null;
  anexos: ManutencaoAnexo[];
  comentarios: ManutencaoComentario[];
  eventos: ManutencaoEvento[];
  comentarios_count: number;
  unread_mentions_count: number;
  mentioned_profile_ids: string[];
  can_comment: boolean;
  can_resolve: boolean;
  can_manage_status: boolean;
  can_assign: boolean;
  can_prioritize: boolean;
  can_claim: boolean;
  can_start: boolean;
  can_update_situation: boolean;
};

export type ManutencaoIndicadorItem = {
  id: string;
  maquina_id: string;
  maquina_nome: string;
  maquina_identificador: string | null;
  descricao: string;
  status: MaintenanceStatus;
  prioridade: MaintenancePriority;
  situacao_atual: string;
  situacao_atualizada_em: string;
  parada_desde: string;
  dias_parada: number;
  responsavel_nome: string | null;
};

export type ManutencaoIndicadores = {
  maquinas_paradas: number;
  aguardando: number;
  em_atendimento: number;
  resolvidos_30d: number;
  tempo_medio_parado_dias: number;
  maior_tempo_aberto_dias: number;
  faixas: {
    ate_2_dias: number;
    de_3_a_7_dias: number;
    acima_7_dias: number;
  };
  paradas: ManutencaoIndicadorItem[];
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
  manutencao: "/manutencao",
};
