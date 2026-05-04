# Integrações

Estrutura preparada para conectar GN a sistemas externos.

## Google Sheets

Há duas estratégias suportadas:

1. **Pull (relatório auto-atualizado)** — no Google Sheets, use
   `IMPORTDATA("https://SEU_DOMINIO/api/export/csv?escopo=mes")` ou
   `IMPORTHTML/IMPORTRANGE` apontando para um endpoint público.
   Limitação: apenas dados de leitura, e o usuário precisa estar logado
   ou o endpoint precisa estar protegido por token (ver `lib/integrations/google-sheets.ts`).
2. **Push (Apps Script chamando API)** — no Apps Script, fetch para
   `/api/producao` com Authorization Bearer do Supabase.

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
