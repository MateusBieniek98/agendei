# Endurecimento de autenticação e funções privilegiadas

Este documento registra a revisão operacional vinculada à Issue `#45`. Ele não
autoriza aplicação direta em produção. Toda mudança deve passar primeiro pelo
staging isolado e pelo processo de `docs/commercial/MULTI_TENANT_ROLLOUT.md`
quando esse runbook estiver na base da branch.

## Inventário revisado

Em 19/09/2026, a produção possuía 19 funções `SECURITY DEFINER` no schema
`public`:

- 9 helpers internos, gatilhos ou funções restritas a `service_role`;
- 9 RPCs autenticadas que validavam `auth.uid()` antes de escrever;
- 1 RPC autenticada, `sync_planejamento_progress`, sem validação do ator.

Todas possuíam `search_path` fixo. A migration
`20260919223458_harden_privileged_functions.sql` corrige a exceção encontrada:

- move o cálculo privilegiado para `private.sync_planejamento_progress`;
- revoga sua execução de todas as funções da Data API;
- mantém a RPC pública compatível, exigindo `service_role` ou perfil ativo;
- faz o gatilho de produção chamar somente a implementação privada.

O advisor continuará podendo sinalizar RPCs `SECURITY DEFINER` deliberadamente
expostas a `authenticated`. Esses avisos só podem ser aceitos quando a função
valida identidade, papel e escopo antes de executar a operação privilegiada.

## Validação obrigatória em staging

1. Reconciliar migrations locais e remotas por versão e checksum.
2. Aplicar a migration somente após restaurar a cópia anonimizada.
3. Confirmar que `anon` não executa nenhuma RPC privilegiada.
4. Confirmar que usuário sem sessão e perfil inativo não executam a RPC de
   planejamento.
5. Confirmar lançamento, edição e exclusão de produção para cada papel.
6. Confirmar importação Google Sheets com `service_role`.
7. Confirmar atualização automática do planejamento pelo gatilho.
8. Rodar os advisors de segurança e performance e anexar o resultado ao PR.

## Configuração fora do código

A proteção contra senhas vazadas depende da configuração do Supabase Auth. Ela
deve ser ativada primeiro em staging, validada com login e recuperação de senha
e depois habilitada em produção na janela planejada. Nunca registrar senhas,
tokens ou chaves nos artefatos de validação.

## Rollback

O rollback preferencial é restaurar o projeto descartável usado no ensaio. Em
produção, não editar a migration aplicada: publicar migration corretiva que
restaure a definição anterior validada e seus grants explícitos. Se houver
divergência de dados ou falha de login, manter o modo de manutenção e executar o
rollback completo definido no runbook de publicação.
