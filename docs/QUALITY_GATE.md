# Esteira de qualidade

Esta esteira é o bloqueio técnico mínimo antes de qualquer código entrar em
`main`. O check obrigatório no GitHub chama-se `quality`; merge direto, bypass
de check e deploy de branch de desenvolvimento não fazem parte do fluxo.

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

`npm run check` executa, nesta ordem:

1. ESLint e TypeScript.
2. ArchContract e Knip.
3. testes unitários e de integração com cobertura Vitest.
4. auditoria das dependências de produção.
5. build de produção e orçamento dos artefatos do cliente.
6. smoke E2E Playwright em Chromium desktop e mobile.

## Bloqueios automatizados

| Área | Controle |
| --- | --- |
| Commits | Commitlint no título do PR e nos commits da branch |
| Arquitetura | fluxo permitido `app -> components -> lib` e ciclos bloqueados |
| Código morto | Knip bloqueia novos arquivos e dependências sem uso; o legado conhecido está explicitamente listado |
| Testes | Vitest com piso global de 21% statements, 19% branches, 27% functions e 22% lines |
| Cobertura | thresholds Vitest bloqueiam regressão; LCOV é enviado ao Codecov quando disponível |
| Segurança | dependency review, `npm audit --omit=dev --audit-level=high` e CodeQL |
| Performance | total do cliente até 650 KB gzip, chunk JS até 120 KB e CSS até 30 KB |
| Navegador | health check e login sem dados de cliente em desktop e mobile |

Os pisos são baseline, não objetivo. Cada PR deve manter ou elevar cobertura e
reduzir allowlists quando tocar no código relacionado. Elevar limites exige um
PR próprio ou testes suficientes no PR funcional.

O repositório ainda precisa ser ativado no Codecov pela Issue #41. Até lá, falha
somente no upload remoto não bloqueia o job; geração do LCOV e thresholds Vitest
continuam obrigatórios. Depois do onboarding, o upload voltará a falhar fechado.

## Decisões de ferramenta

- OpenTelemetry é a base de traces. Sentry, Datadog ou New Relic só entram após
  decisão de fornecedor na Issue #8; instalar os quatro duplicaria SDKs, custo e
  instrumentação.
- ESLint continua como linter oficial por integrar as regras do Next.js. Biome
  não entra enquanto apenas duplicar lint e formatação.
- Playwright é o executor E2E do repositório. Endtest só será considerado se
  houver necessidade comprovada de testes hospedados externos.
- Stryker fica para a Issue #38, após a cobertura das regras críticas ficar
  estável; mutation testing agora aumentaria bastante o tempo da CI com baixo
  sinal nas áreas ainda sem testes.

## Segurança e operação

O rate limit atual é distribuído no PostgreSQL/Supabase e falha fechado quando o
cliente privilegiado ou a RPC não estão disponíveis. Ele protege integrações,
convites e operações administrativas sensíveis. Ampliar cobertura de rotas é
trabalho de segurança da Issue #6 e qualquer mudança da RPC deve passar primeiro
por staging, testes de isolamento entre duas organizações e rollback ensaiado.

Frontend reutilizável vive em `components`; regras e adaptadores vivem em `lib`;
rotas e composição vivem em `app`. Código client-side não pode receber chave de
serviço, segredo de integração nem responsabilidade de autorização final.

## Gates não automatizáveis

- Revisão independente de segurança: Issue #6.
- Backend de observabilidade, alertas e rotina de backup: Issue #8.
- Termos de uso, política de privacidade, DPA e aceite jurídico: Issue #11.
- Matriz E2E autenticada, multiempresa e offline em staging: Issue #32.
- Ativação e status remoto do Codecov: Issue #41.

Esses itens bloqueiam o go-live comercial correspondente. Nenhum documento pode
ser marcado como “aprovado pelo jurídico” sem registro do responsável e da data
de aceite. A CI valida código; ela não substitui revisão profissional, staging
com dados fictícios isolados ou decisão humana de lançamento.
