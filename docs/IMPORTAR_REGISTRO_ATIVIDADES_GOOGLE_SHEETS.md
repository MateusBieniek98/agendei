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

Para sincronizar nomenclaturas de servicos como fonte unica de verdade, rode
tambem:

```sql
-- arquivo: lib/db/2026-05-services-metadata-sync.sql
```

## 2. Conferir variaveis no Vercel

O app precisa destas variaveis em Production e Preview:

- `SHARED_SYNC_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use o mesmo valor de `SHARED_SYNC_TOKEN` no Apps Script.

## 3. Colar o Apps Script

Na planilha **Controle de Producao GN**:

1. Abra `Extensoes -> Apps Script`.
2. Cole o conteudo de `docs/google-sheets-registro-atividades-import.js`.
3. Troque `GN_SHARED_SYNC_TOKEN` pelo token configurado no Vercel.
4. Salve.
5. Rode `testarConexaoImportacaoRegistroAtividadesGN()` primeiro. Status `200`
   confirma que a rota e o token estao corretos.
6. Rode `validarRegistroAtividadesGN()` para validar as linhas sem gravar.
7. Se a validacao estiver OK, rode `importarRegistroAtividadesParaAppGN()`.
8. Para automatizar importacao + nomenclaturas em tempo quase real, rode
   `instalarAutomacaoCompletaGN()`.

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

## Sincronizacao de nomenclatura

A rota `/api/sync/metadata` atualiza a tabela `services_metadata` e mantem
`atividades` sincronizada. O script instala um acionador editavel com
`sincronizarMetadataServicosEditadosGN(e)`: quando uma linha de servico muda na
planilha, o novo nome e enviado ao app sem precisar novo deploy.

O identificador estavel fica em `service_key`. Assim, se o nome de exibicao
mudar de uma forma para outra, o historico de producao continua apontando para
o mesmo servico.

## Observacoes importantes

- Linhas sem data, servico, projeto, talhao ou producao valida sao ignoradas.
- Producoes iguais a zero nao entram como apontamento.
- O faturamento e recalculado pelo app: `producao * tarifa`.
- Se o nome do encarregado existir em `profiles`, o apontamento fica ligado a
  esse usuario. Caso contrario, entra pelo perfil admin e o nome original fica
  registrado nas observacoes/metadados.
