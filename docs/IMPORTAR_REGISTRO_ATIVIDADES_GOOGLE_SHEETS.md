# Importar `Registro de atividades` para o app

Este fluxo importa apontamentos da planilha **Controle de Producao GN**,
aba **Registro de atividades**, para a tabela `public.producao` no Supabase.

## 1. Preparar o banco

No Supabase, rode uma vez:

```sql
-- arquivo: lib/db/sync_google_sheets_registro_atividades.sql
```

Esse SQL adiciona campos de origem na tabela `producao` e cria uma chave
unica para impedir duplicidade quando o script rodar mais de uma vez.

## 2. Conferir variaveis no Vercel

O app precisa destas variaveis em Production e Preview:

- `GOOGLE_SHEETS_SYNC_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use o mesmo valor de `GOOGLE_SHEETS_SYNC_TOKEN` no Apps Script.

## 3. Colar o Apps Script

Na planilha **Controle de Producao GN**:

1. Abra `Extensoes -> Apps Script`.
2. Cole o conteudo de `docs/google-sheets-registro-atividades-import.js`.
3. Troque `GN_SYNC_TOKEN` pelo token configurado no Vercel.
4. Salve.
5. Rode `validarRegistroAtividadesGN()` primeiro.
6. Se a validacao estiver OK, rode `importarRegistroAtividadesParaAppGN()`.
7. Para automatizar, rode `instalarImportacaoRegistroAtividadesGN()`.

## Como a importacao funciona

O script cria duas colunas no fim da aba, se elas ainda nao existirem:

- `GN App ID`: identificador estavel da linha.
- `GN Sync Status`: resultado da ultima sincronizacao.

Cada linha valida da aba vira um apontamento no app. O app usa:

- `Data` -> data do apontamento
- `Servico` / `Serviço` -> atividade
- `Projeto` -> projeto
- `Talhao` / `Talhão` -> talhao
- `Producao` / `Produção` -> quantidade
- `Equipe` -> equipe/frente
- `Encarregado` -> perfil do usuario, quando existir
- `Insumo 1..5` e `QTD` -> insumos do apontamento
- `Tarifa` -> valor unitario do apontamento

Se a atividade, projeto ou equipe ainda nao existir no app, a importacao cria
o cadastro automaticamente. Se a linha ja tiver sido importada antes, ela e
atualizada em vez de duplicada.

## Observacoes importantes

- Linhas sem data, servico, projeto, talhao ou producao valida sao ignoradas.
- Producoes iguais a zero nao entram como apontamento.
- O faturamento e recalculado pelo app: `producao * tarifa`.
- Se o nome do encarregado existir em `profiles`, o apontamento fica ligado a
  esse usuario. Caso contrario, entra pelo perfil admin e o nome original fica
  registrado nas observacoes/metadados.
