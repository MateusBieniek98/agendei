# Runbook de migração multiempresa

Este procedimento é obrigatório para preservar os dados da GN. As migrations
presentes no repositório não foram aplicadas à produção por esta entrega.

## Artefatos

1. `20260826234816_multi_tenant_expand_and_backfill.sql`: cria o modelo, a
   organização GN, associa usuários e preenche `organization_id`.
2. `20260826234818_multi_tenant_enforce_isolation.sql`: torna o tenant
   obrigatório, troca índices, RLS, Storage e validações.
3. `20260826234820_harden_multi_tenant_production_rpcs.sql`: endurece RPCs de
   produção/estoque, troca de organização, limites e autorização ativa.

## Ensaio em staging

1. Bloquear gravações no backup lógico usado para o ensaio.
2. Restaurar a cópia mais recente da produção em projeto de staging isolado.
3. Registrar SHA-256 do backup, horário, versão do app e responsável.
4. Capturar contagens e somas antes da migração com
   `supabase/tests/reconciliation.sql`.
5. Aplicar as três migrations em ordem e guardar todo o log.
6. Confirmar zero `organization_id IS NULL` nas tabelas inventariadas.
7. Executar `supabase/tests/tenant_isolation.sql` com dois clientes fictícios.
8. Executar o app com a nova versão e os fluxos Playwright.
9. Repetir a reconciliação e comparar linha a linha os resultados críticos.
10. Cronometrar o ensaio e validar a restauração do backup.

Depois de verificar pessoalmente o UUID do titular e exigir MFA, provisionar o
primeiro administrador da plataforma pelo SQL Editor:

```sql
insert into private.platform_admins (user_id)
values ('UUID_VERIFICADO_DO_TITULAR');
```

Nunca deduzir esse acesso a partir do papel `admin` de uma organização.

## Reconciliação obrigatória

- contagem de perfis, projetos, talhões, equipes, atividades e máquinas;
- contagem, soma de produção e faturamento por mês;
- estoque atual, entradas, saídas, estornos e descartes por insumo;
- manutenções, anexos e caminhos de Storage;
- planejamento, metas, auditoria e filas de sincronização;
- registros órfãos e chaves estrangeiras;
- apontamentos com zero a seis insumos;
- todos os registros atuais associados à organização GN.

Qualquer diferença não explicada bloqueia a liberação.

## Janela de produção

1. Comunicar indisponibilidade e suspender novas gravações.
2. Confirmar saúde do banco e último backup restaurável.
3. Fazer backup adicional e registrar hash.
4. Capturar a reconciliação anterior.
5. Aplicar migrations e publicar a versão tenant-aware.
6. Rodar smoke tests com admin, gestor, encarregado e manutenção.
7. Rodar reconciliação posterior.
8. Liberar gravações somente após assinatura do responsável técnico e de
   operação.

## Critério de rollback

Reverter se houver falha de migration, diferença de reconciliação, login
inoperante, vazamento entre organizações, baixa incorreta de estoque ou erro
crítico de produção. Como a fase de isolamento altera políticas e constraints,
o rollback aprovado é restaurar o backup para um projeto limpo e voltar o app à
versão anterior; não improvisar SQL destrutivo na base afetada.

## Pós-migração

- Monitorar erros, latência, filas e estoque continuamente nas primeiras horas.
- Conferir amostras de produção e faturamento no fim de cada dia por 14 dias.
- Manter canal de incidente e responsável de plantão.
- Não criar o primeiro cliente externo antes de 14 dias sem incidente crítico.
