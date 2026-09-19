# Talhivo

**Gestão operacional florestal.** SaaS web/PWA multiempresa para operações de silvicultura. O produto conecta
apontamentos de produção, equipes, planejamento, máquinas, manutenção, estoque,
metas, relatórios e integrações sem misturar dados entre clientes.

**Talhivo** foi adotado como marca de trabalho após triagem pública preliminar.
O uso comercial externo ainda depende de reserva dos domínios, busca profissional
e protocolo da marca. A organização GN é tratada como o primeiro cliente, não
como a marca do software.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Aplicação | Next.js 16.3, React 19 e TypeScript |
| Interface | Tailwind CSS 4, web responsiva e PWA |
| Banco/Auth | PostgreSQL e Supabase Auth com RLS |
| Exportação | ExcelJS, CSV e Google Sheets |
| Qualidade | ESLint, TypeScript, ArchContract, Knip, Vitest, Playwright e Codecov |
| Observabilidade | OpenTelemetry com `@vercel/otel` e logs estruturados |
| Runtime | Node.js 24 |

## Multiempresa

- `organizations` representa cada cliente.
- `organization_members` guarda o papel do usuário dentro de cada cliente.
- `organization_invitations` controla convites com expiração.
- `organization_settings` guarda configurações operacionais do cliente.
- `organization_integrations` guarda apenas referências ou hashes de segredos.
- Todas as tabelas operacionais recebem `organization_id`.
- A autorização combina associação ativa, papel e organização ativa.
- `/platform` é uma área separada para administração comercial da plataforma e
  exige MFA.

As migrations foram separadas em expansão/backfill, isolamento e endurecimento
das RPCs. Elas devem ser validadas em staging antes de qualquer aplicação na
produção. Consulte [o runbook de migração](docs/commercial/MULTI_TENANT_ROLLOUT.md).

## Desenvolvimento local

Pré-requisitos: Node.js 24 e um projeto Supabase isolado para desenvolvimento.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

O arquivo `lib/db/schema.sql` é apenas um bootstrap legado para banco vazio. A
evolução de ambientes existentes ocorre exclusivamente pelas migrations em
`supabase/migrations/`.

## Qualidade

```bash
npm run check
git diff --check
```

O gate executa lint, TypeScript, arquitetura, código morto, cobertura, auditoria,
build, orçamento de performance e E2E. A CI acrescenta Commitlint, revisão de
dependências, CodeQL e publicação no Codecov. Antes da migração de um cliente,
também é obrigatório executar a matriz SQL de isolamento e o fluxo Playwright
completo em staging. Consulte [a esteira de qualidade](docs/QUALITY_GATE.md).

## Produção, estoque e importações

- RPCs transacionais validam organização, usuário, papel e entidades
  relacionadas antes de movimentar estoque ou produção.
- A importação em massa aceita de zero a seis insumos por apontamento. Cada
  posição é opcional; nome e quantidade devem ser informados juntos.
- Filas offline, caches, integrações, chaves de idempotência e arquivos de
  manutenção são separados por organização.
- O resumo para WhatsApp usa os dados completos do apontamento e o nome da
  organização cliente.

## Deploy

Mantenha desenvolvimento, staging e produção em projetos separados. Configure
as variáveis descritas em `.env.local.example`, domínio, SMTP, SPF, DKIM, DMARC,
monitoramento, alertas e backups antes do go-live.

Não execute as migrations multiempresa diretamente em produção. O processo
exige backup, ensaio em staging, reconciliação de dados e plano de reversão.

## Fluxo de trabalho

Toda mudança começa em uma GitHub Issue classificada como **Correção**,
**Melhoria** ou **Nova função**. Implementações, entregas e deploys são
gerenciados por Pull Request, com descrição das mudanças, validação, riscos,
limitações e próximos passos. As regras completas para pessoas e agentes estão
em [AGENTS.md](AGENTS.md).

## Documentação comercial e operacional

- [Status da transformação](docs/commercial/README.md)
- [Naming e pesquisa preliminar](docs/commercial/NAMING_BRIEF.md)
- [Cronograma de 90 dias](docs/commercial/90_DAY_EXECUTION.md)
- [Migração multiempresa](docs/commercial/MULTI_TENANT_ROLLOUT.md)
- [Onboarding de cliente](docs/commercial/ONBOARDING_RUNBOOK.md)
- [Formato completo da importação](docs/commercial/IMPORTACAO_APONTAMENTO_COMPLETO.md)
- [Gate Playwright de staging](docs/commercial/PLAYWRIGHT_STAGING.md)
- [Segredos de integração por cliente](docs/commercial/INTEGRATION_SECRETS.md)
- [Jurídico, LGPD e propriedade intelectual](docs/commercial/LEGAL_AND_IP_CHECKLIST.md)
- [Estrutura das minutas jurídicas](docs/commercial/LEGAL_DOCUMENTS_DRAFT.md)
- [SMTP e domínios](docs/commercial/SMTP_AND_DOMAINS.md)

## Titularidade

Código privado. A titularidade comercial deverá ser formalizada por cessão para
a nova empresa antes da venda do SaaS. Este repositório não substitui contrato
de cessão, registro de software ou registro de marca.
