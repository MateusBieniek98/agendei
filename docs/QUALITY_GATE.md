# Esteira de qualidade

O job `quality` é o bloqueio técnico mínimo antes de código entrar em `main`.
Deploy direto de branch de desenvolvimento e bypass de check não fazem parte do
fluxo normal.

## Execução local

Na primeira execução, instale o navegador do Playwright:

```bash
npx playwright install chromium
```

Antes de abrir ou atualizar um Pull Request:

```bash
npm ci
npm run check
git diff --check
```

`npm run check` executa lint, TypeScript, contrato arquitetural, Knip, cobertura
Vitest, auditoria de dependências de produção, build, orçamento de performance e
smoke E2E em Chromium desktop e mobile.

## Bloqueios automatizados

| Área | Controle |
| --- | --- |
| Commits | Commitlint no título e nos commits do PR |
| Arquitetura | Fluxo `app -> components -> lib` e ciclos bloqueados |
| Código morto | Knip com legado conhecido explicitamente listado |
| Cobertura | Piso global honesto, bloqueando regressão |
| Segurança | Dependency review, npm audit e CodeQL |
| Performance | 650 KB gzip total, 120 KB por chunk JS e 30 KB por CSS |
| Navegador | Health check e login sem dados de cliente |

Os pisos de cobertura são 35% statements, 25% branches, 40% functions e 38%
lines. São baseline, não objetivo. Cada PR deve manter ou elevar a cobertura e
reduzir allowlists quando tocar no código relacionado.

## Decisões de ferramenta

- OpenTelemetry é a base neutra de traces. Um único monitor de erros será
  escolhido na Issue #8; não instalar Sentry, Datadog e New Relic juntos.
- ESLint continua como linter oficial por integrar as regras do Next.js. Biome
  não entra enquanto apenas duplicar esse papel.
- Playwright é o executor E2E. Endtest só será avaliado se houver necessidade de
  testes hospedados externos.
- Stryker fica para a Issue #38, depois de estabilizar a cobertura crítica.

## Gates externos

- Revisão independente de segurança: Issue #6.
- Backup, observabilidade e alertas: Issues #7, #8 e #44.
- Termos, privacidade, DPA e aceite jurídico: Issue #11.
- E2E autenticado, offline e multiempresa em staging: Issue #32.
- Ativação e status remoto do Codecov: Issue #41.

A CI valida o código, mas não substitui revisão profissional, staging isolado,
restauração comprovada ou decisão humana de lançamento.
