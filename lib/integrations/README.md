# Integrações

Estrutura preparada para conectar cada organização a sistemas externos.

## Google Sheets

Há duas estratégias suportadas:

1. **Pull simples (relatório auto-atualizado)** — no Google Sheets, use
   `IMPORTDATA("https://SEU_DOMINIO/api/export/csv?escopo=mes")` para
   consumir uma exportação CSV autenticada pela sessão do app.
2. **Sincronização multiempresa recomendada** — use
   `docs/google-sheets-multiempresa-completo.js`. Nas Propriedades do script,
   configure `APP_BASE_URL` e um `SYNC_TOKEN` exclusivo da organização. O token
   deve ser salvo no servidor apenas como hash em `organization_integrations`.
3. **Importação da aba Registro de atividades** — o script envia a aba para
   `/api/sync/google-sheets/registro-atividades`, criando ou atualizando
   apontamentos sem duplicidade e dentro da organização resolvida pelo token.
4. **Metadados de serviços** — rode
   `lib/db/2026-05-services-metadata-sync.sql`. O Apps Script também pode
   chamar `/api/sync/metadata` em edições da planilha para manter nomes,
   tarifas, unidades e aliases sincronizados com `services_metadata`.

Os demais scripts deste diretório são mantidos apenas para a transição da
primeira organização e não devem ser copiados para clientes novos.

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
