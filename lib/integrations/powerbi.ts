// Adapter de saída para Power BI.
// Power BI consome bem o endpoint /api/export/csv como fonte web.
// Esta função serve para normalizar nomes de colunas no padrão snake_case
// e tipar os campos numéricos para que o Power Query infira corretamente.

export function toPowerBIRow(input: {
  data: string;
  quantidade: number;
  valor_unitario_snapshot: number;
  observacoes: string | null;
  equipes: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
}) {
  return {
    Data: input.data,
    Equipe: input.equipes?.nome ?? null,
    Atividade: input.atividades?.nome ?? null,
    Unidade: input.atividades?.unidade ?? null,
    Quantidade: Number(input.quantidade),
    ValorUnitario: Number(input.valor_unitario_snapshot),
    ValorTotal: Number(input.quantidade) * Number(input.valor_unitario_snapshot),
    Observacoes: input.observacoes ?? "",
  };
}

/**
 * Como conectar no Power BI Desktop:
 *  1. Obter Dados → Web
 *  2. URL: https://SEU_DOMINIO/api/export/csv?escopo=mes
 *  3. Avançado → adicionar header "Authorization: Bearer <TOKEN>"
 *  4. No editor de consultas, definir tipos: Data → Data; Quantidade → Decimal;
 *     ValorUnitario / ValorTotal → Moeda
 *  5. Atualização agendada: Power BI Service permite refresh por gateway.
 */
