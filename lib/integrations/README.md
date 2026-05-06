# Integrações

Estrutura preparada para conectar GN a sistemas externos.

## Google Sheets

Há duas estratégias suportadas:

1. **Pull simples (relatório auto-atualizado)** — no Google Sheets, use
   `IMPORTDATA("https://SEU_DOMINIO/api/export/csv?escopo=mes")` para
   consumir uma exportação CSV autenticada pela sessão do app.
2. **Sincronização automática recomendada** — cole o script
   `docs/google-sheets-apontamentos-sync.js` no Apps Script da planilha
   **Controle de Produção GN**. Ele chama
   `/api/sync/google-sheets/apontamentos`, valida `GOOGLE_SHEETS_SYNC_TOKEN`
   e atualiza a aba `Apontamentos App` com apontamentos, insumos e descarte.

## Power BI

- Fonte de dados → Web → URL do endpoint `/api/export/csv?escopo=mes`
- Para autenticação: gere um token de service-role com escopo limitado
  (ver `lib/integrations/powerbi.ts`).
- Atualização incremental por data é suportada (campo `data`).

## Estrutura

```
lib/integrations/
  google-sheets.ts   # adapter: GET endpoint + token
  powerbi.ts         # adapter: dataset format
  webhooks.ts        # eventos para Zapier/Make
```

Cada adapter exporta uma função `serialize(data)` que normaliza os tipos
e nomes de colunas para o formato esperado pela ferramenta.
