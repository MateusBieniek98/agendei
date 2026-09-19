<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contexto do projeto e fluxo de entrega

Estas regras são obrigatórias para qualquer agente, modelo ou pessoa que altere
este repositório.

## Fonte de trabalho

- O GitHub Issues é a fonte de verdade do backlog. Consulte Issues abertas e
  Pull Requests relacionados antes de planejar ou implementar uma mudança.
- Toda tarefa deve possuir uma Issue antes do início da implementação e receber
  exatamente uma classificação: `tipo: correção`, `tipo: melhoria` ou
  `tipo: nova função`.
- Quando a solicitação ainda não tiver Issue, crie-a primeiro com objetivo,
  escopo, critérios de aceite, riscos e dependências. Não duplique uma Issue
  existente.
- Defeitos descobertos durante outra entrega devem virar uma Issue própria se
  não forem estritamente necessários para concluir a Issue atual.

## Branches, commits e Pull Requests

- Não implemente nem faça deploy diretamente a partir de `main`. Use uma branch
  curta e rastreável, preferencialmente `codex/<número>-<resumo>` para trabalho
  de agentes.
- Mantenha cada branch e Pull Request focado nas Issues relacionadas. Preserve
  mudanças locais e não reverta trabalho alheio sem autorização explícita.
- Toda entrega e todo deploy devem ser gerenciados por Pull Request. Commit ou
  push isolado não significa que a mudança foi publicada.
- Use `Closes #<numero>` quando o PR concluir integralmente a Issue e
  `Refs #<numero>` quando entregar apenas parte dela.
- Aguarde os checks obrigatórios e registre a decisão de merge/deploy no PR.
  Mudanças emergenciais também exigem Issue e PR; documente a exceção e a
  validação posterior.

## Conteúdo obrigatório do Pull Request

Todo Pull Request deve informar de forma objetiva:

1. Issue ou Issues relacionadas.
2. O que mudou e o que ficou fora do escopo.
3. Como a mudança foi validada, com comandos e testes manuais relevantes.
4. Riscos, limitações, impacto em dados e estratégia de rollback.
5. Próximos passos ou dependências que permanecem abertas.

Use o template em `.github/pull_request_template.md` e não remova seções sem
justificativa.

## Qualidade e segurança de rollout

- A validação padrão de código é `npm run check` e `git diff --check`. O comando
  executa lint, tipos, contrato arquitetural, Knip, cobertura, auditoria de
  dependências de produção, build, orçamento de performance e Playwright.
- O status obrigatório `quality` da CI deve passar antes do merge. Não desative,
  ignore ou contorne um verificador para concluir uma entrega; corrija a causa ou
  documente uma exceção temporária em Issue específica, com prazo e responsável.
- Todo comportamento novo ou corrigido deve receber teste no menor nível
  confiável: unitário para regras puras, integração para contratos entre módulos
  e E2E para fluxos críticos. A cobertura atual é piso, não meta final.
- Antes de criar um componente, helper ou serviço, pesquise implementações já
  existentes. Respeite o fluxo `app -> components -> lib`, mantenha lógica de
  servidor fora de componentes client-side e execute `npm run arch:check`.
- Prefira componentes coesos e dependências explícitas. Aplique DRY quando a
  duplicação já for concreta; não crie abstrações antecipadas nem concentre
  fluxos distintos em um único gargalo.
- Mudanças de banco, RLS, Auth, Storage, integrações ou isolamento multiempresa
  exigem validação em staging isolado antes de produção.
- As migrations multiempresa nunca devem ser aplicadas diretamente na produção
  da GN. Siga `docs/commercial/MULTI_TENANT_ROLLOUT.md`, com backup restaurável,
  reconciliação, teste com duas organizações e rollback ensaiado.
- Nunca registre ou versione senhas, tokens, chaves, dados pessoais ou dados
  operacionais reais em Issues, Pull Requests, logs, fixtures ou screenshots.
- Termos de uso, política de privacidade e DPA só podem ser marcados como
  aprovados após aceite formal do jurídico. Código e documentação técnica não
  substituem essa aprovação.

Consulte `docs/QUALITY_GATE.md` para ferramentas, limites e pendências.
