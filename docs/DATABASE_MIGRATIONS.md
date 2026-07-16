# Migrations do banco

O banco de produção passou a ter histórico versionado em
`supabase/migrations/` em 16/07/2026. Os SQLs antigos em `lib/db/` foram
preservados como documentação/bootstrap legado e não devem ser tratados como a
fonte completa do estado atual.

## Fluxo para mudanças novas

1. Confira a versão atual da CLI com `npx supabase --help`.
2. Crie o arquivo com `npx supabase migration new nome_da_mudanca`.
3. Escreva SQL reversível/idempotente quando isso for viável.
4. Valide em ambiente separado e revise RLS, grants e `search_path`.
5. Aplique a migration no projeto correto.
6. Rode os advisors de segurança e performance depois da aplicação.
7. Versione o arquivo junto com o código que depende dele.

Não edite uma migration que já foi aplicada. Crie outra migration corretiva.

## Baseline de segurança de 16/07/2026

As migrations iniciais:

- tornaram o acesso futuro a funções/tabelas opt-in por padrão;
- removeram execução direta de helpers e triggers pela Data API;
- mantiveram expostos apenas os RPCs de negócio autenticados;
- ativaram `security_invoker` nas views públicas;
- corrigiram policies RLS redundantes e avaliações por linha;
- criaram índices para todas as foreign keys apontadas pelo advisor.

Avisos restantes do advisor precisam de decisão operacional específica. Não
remova índices recém-criados apenas porque ainda aparecem como `unused_index`:
eles precisam de tráfego real antes de acumular estatísticas de uso.

Os avisos de funções `SECURITY DEFINER` autenticadas são esperados para os RPCs
transacionais que validam `auth.uid()` e o papel antes de escrever. A proteção
contra senhas vazadas é uma configuração do Supabase Auth e deve ser habilitada
no painel quando o plano do projeto oferecer o recurso.
