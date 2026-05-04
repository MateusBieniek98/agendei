// Webhooks de saída — útil para integrar com Zapier/Make/n8n quando algo
// importante acontece (ex.: nova manutenção urgente, meta atingida).
//
// Esta é uma estrutura inicial. Ative configurando WEBHOOK_URLS no servidor.

const URLS = (process.env.WEBHOOK_URLS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export type WebhookEvent =
  | { type: "manutencao.aberta"; payload: { maquina: string; descricao: string } }
  | { type: "manutencao.urgente"; payload: { maquina: string } }
  | { type: "meta.atingida"; payload: { ano: number; mes: number; valor: number } };

export async function emit(event: WebhookEvent) {
  if (URLS.length === 0) return;
  await Promise.allSettled(
    URLS.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...event, timestamp: new Date().toISOString() }),
      })
    )
  );
}
