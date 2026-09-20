# Ensaio multiempresa em staging - 20/09/2026

## Escopo e proteções

- Projeto: `Talhivo Staging` (`reoizywikpanptbycvsy`), organização no plano
  Free e custo confirmado de US$ 0/mês.
- A produção (`bmnwvtkhuizcflkcnnlo`) não recebeu migrations nem alterações.
- O staging foi reconstruído duas vezes a partir de uma cópia anonimizada dos
  dados operacionais da GN.
- Usuários de Auth, sessões, tokens, objetos de Storage e anexos de manutenção
  não foram copiados. Foram criados somente usuários técnicos de teste.
- O dump original sensível foi removido após a sanitização.

## Integridade da cópia

| Evidência | Resultado |
| --- | ---: |
| Linhas operacionais preservadas | 9.074 |
| SHA-256 do dump sanitizado | `85fcbfda0540257f3702f5adb86e3fcc1f886bfbd5e196460f9494c59721c154` |
| Produção | 859 registros |
| Quantidade produzida | 14.776,482 |
| Faturamento | R$ 5.839.649,30913 |
| Planejamento | 28 registros |
| Insumos | 49 registros |
| Saldo total de estoque | 2.198.251,83 |
| Auditoria | 6.681 registros |
| Registros sem organização após migração | 0 |

As contagens, somas e checksums de produção, planejamento, estoque e auditoria
foram idênticos antes e depois do segundo ensaio. O primeiro ensaio revelou que
o backfill acionava triggers; a migration foi corrigida e o staging foi
reconstruído do zero antes da validação final.

## Histórico e migrations

O histórico remoto tinha cinco timestamps diferentes dos arquivos locais. As
13 versões já aplicadas foram reconciliadas sem reexecutar SQL histórico. As
seguintes migrations novas foram aplicadas em ordem:

1. `20260826234816_multi_tenant_expand_and_backfill.sql`
2. `20260826234818_multi_tenant_enforce_isolation.sql`
3. `20260826234820_harden_multi_tenant_production_rpcs.sql`
4. `20260920132409_grant_tenant_membership_mutations.sql`
5. `20260920134838_harden_function_privileges_and_indexes.sql`
6. `20260920135224_cover_membership_team_fk.sql`

Problemas encontrados e corrigidos durante o ensaio:

- ausência de `app_settings` no snapshot atual da produção;
- triggers duplicados de relacionamento para convites da plataforma;
- grants ausentes para a gestão de membros protegida por RLS;
- auditoria e recálculo de planejamento disparados pelo backfill estrutural;
- funções privilegiadas executáveis pelo papel anônimo;
- índices transitórios duplicados e chaves estrangeiras sem cobertura;
- cookie manual de login incompatível com sessões SSR fragmentadas.

## Isolamento e fluxos críticos

O teste SQL `supabase/tests/tenant_isolation.sql` passou no segundo ensaio,
cobrindo leitura e escrita entre organizações, troca de organização, último
administrador ativo e prefixos de Storage. A tentativa posterior de repeti-lo
pelo executor remoto do Supabase CLI parou antes do plano TAP porque esse papel
não pode inserir fixtures em `auth.users`; não houve falha de política RLS.

Depois das migrations finais, um teste pela API autenticou seis usuários
técnicos e validou:

- papéis `admin`, `gestor`, `encarregado` e `manutencao`;
- isolamento de leitura e escrita entre duas organizações;
- catálogo restrito a administrador;
- criação idempotente de produção;
- bloqueio por estoque insuficiente;
- baixa e estorno exatos de estoque;
- gestão de membros pela política tenant.

Os registros operacionais criados pelo teste foram removidos. A organização de
isolamento e seus usuários técnicos foram mantidos para testes manuais.

## Aplicação

O app foi executado localmente contra o staging. Cinco cenários autenticados
percorreram as rotas principais de admin, gestor, encarregado e manutenção. O
resultado foi zero respostas 5xx, zero erros de runtime e nenhum retorno
indevido ao login. As telas desktop e mobile foram inspecionadas após os estados
de skeleton e carregamento final, sem sobreposição ou falha de contraste.

O login passou a usar `createServerClient` de `@supabase/ssr`, preservando todos
os chunks de cookie e os cabeçalhos privados de cache. Há teste automatizado
para o redirect autenticado e para não persistir sessão de usuário sem vínculo.

## Advisors

- Segurança: nenhuma função `SECURITY DEFINER` continua executável por `anon`.
- Segurança: 12 RPCs autenticados permanecem sinalizados porque são a interface
  intencional do produto; todos validam identidade, papel e organização.
- Segurança: quatro tabelas server-only têm RLS sem políticas e não concedem
  DML a `anon` ou `authenticated`.
- Auth: proteção contra senhas vazadas permanece indisponível no staging Free;
  o recurso exige Supabase Pro.
- Performance: zero índices duplicados e zero chaves estrangeiras sem índice.
- Performance: avisos de índice não utilizado são esperados em um banco recém
  reconstruído e sem carga representativa após a criação dos índices.

## Esteira local

`npm run check` passou integralmente:

- ESLint, TypeScript, `arch-contract` e Knip sem erro;
- 48 testes Vitest aprovados em 15 arquivos;
- cobertura global de 23,85% em linhas e 20,36% em branches;
- `npm audit --omit=dev --audit-level=high` sem vulnerabilidades;
- build de produção do Next.js aprovado;
- bundle cliente total de 568.975 bytes gzip, maior JS com 106.318 bytes
  gzip e maior CSS com 12.933 bytes gzip, todos dentro do orçamento;
- quatro E2E públicos aprovados em Chromium desktop e mobile.

O `supabase db lint --linked --level warning` também passou sem erros de schema.

## Limitações e decisão

- Fotos do Storage não foram restauradas; o isolamento de metadados/prefixos foi
  testado, mas a restauração física de arquivos continua pendente.
- A restauração final a partir do mecanismo de backup gerenciado ainda depende
  da migração da produção para Supabase Pro.
- Proteção contra senhas vazadas deve ser ativada na produção após o upgrade.
- Este ensaio aprova a fundação para revisão em Pull Request. Ele não autoriza
  merge nem publicação em produção sem backup restaurável, janela planejada e
  aprovação humana.
