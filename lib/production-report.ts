export type ProductionReportInsumo = {
  nome: string;
  quantidade: number;
  unidade?: string | null;
};

export type ProductionReportInput = {
  eps?: string;
  data: string;
  operacao: string;
  encarregado: string;
  equipe: string;
  fazenda: string;
  talhao: string;
  unidade: string;
  quantidadeRealizada: number;
  quantidadeAcumulada?: number | null;
  areaTotalHa?: number | null;
  quantidadeRestante?: number | null;
  descarte?: number | null;
  status: string;
  insumos: ProductionReportInsumo[];
  observacoes?: string | null;
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
});

function formatNumber(value: number) {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function isAreaProductionUnit(unit: string) {
  const normalized = unit
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return ["ha", "hectare", "hectares"].includes(normalized);
}

function formatMeasure(value: number, unit: string) {
  const normalizedUnit = unit.trim();
  return `${formatNumber(value)}${normalizedUnit ? ` ${normalizedUnit}` : ""}`;
}

export function buildProductionReport(input: ProductionReportInput) {
  const areaUnit = isAreaProductionUnit(input.unidade);
  const lines = [
    "📊 *APONTAMENTO*",
    ...(input.eps?.trim() ? [`◉ *EPS:* ${input.eps.trim()}`] : []),
    `📅 *Data:* ${formatDate(input.data)}`,
    `⚙️ *Operação:* ${input.operacao.trim()}`,
    `👷 *Encarregado:* ${input.encarregado.trim()}`,
    `👥 *Equipe / frente:* ${input.equipe.trim()}`,
    `🏞️ *Fazenda:* ${input.fazenda.trim()}`,
    `📍 *Talhão:* ${input.talhao.trim()}`,
  ];

  if (input.areaTotalHa != null && Number.isFinite(input.areaTotalHa)) {
    lines.push(
      areaUnit
        ? `▶️ *Área Total:* ${formatMeasure(input.areaTotalHa, "ha")}`
        : `▶️ *Área do Talhão:* ${formatMeasure(input.areaTotalHa, "ha")}`
    );
  }

  lines.push(
    `${areaUnit ? "✅ *Área Realizada:*" : "✅ *Produção Realizada:*"} ${formatMeasure(
      input.quantidadeRealizada,
      input.unidade
    )}`
  );

  if (input.quantidadeAcumulada != null && Number.isFinite(input.quantidadeAcumulada)) {
    lines.push(
      `${areaUnit ? "✳️ *Área Acumulada:*" : "✳️ *Produção Acumulada:*"} ${formatMeasure(
        input.quantidadeAcumulada,
        input.unidade
      )}`
    );
  }

  if (
    areaUnit &&
    input.quantidadeRestante != null &&
    Number.isFinite(input.quantidadeRestante)
  ) {
    lines.push(`⛔ *Área Restante:* ${formatMeasure(input.quantidadeRestante, input.unidade)}`);
  }

  if (input.descarte != null && Number.isFinite(input.descarte) && input.descarte > 0) {
    lines.push(`🗑️ *Descarte:* ${formatMeasure(input.descarte, input.unidade)}`);
  }

  lines.push(`↔️ *Status:* ${input.status.trim()}`, "", "*INSUMOS*");

  if (input.insumos.length === 0) {
    lines.push("Nenhum insumo informado.");
  } else {
    for (const insumo of input.insumos) {
      lines.push(
        `• ${insumo.nome.trim()}: ${formatMeasure(insumo.quantidade, insumo.unidade ?? "")}`
      );
    }
  }

  lines.push("", `*OBS:* ${input.observacoes?.trim() || "Sem observações."}`);
  return lines.join("\n");
}

export function buildWhatsAppShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
