<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Contexto do projeto e fluxo de entrega

Estas regras são obrigatórias para qualquer agente, modelo ou pessoa que altere
este repositório.

## Issues, branches e Pull Requests

- Consulte Issues e Pull Requests abertos antes de implementar uma mudança.
- Toda tarefa deve possuir uma Issue classificada como `tipo: correção`,
  `tipo: melhoria` ou `tipo: nova função`.
- Não implemente nem publique diretamente da `main`. Use uma branch curta,
  preferencialmente `codex/<numero>-<resumo>` para trabalho de agentes.
- Cada Pull Request deve citar a Issue com `Closes #<numero>` ou
  `Refs #<numero>`, explicar o que mudou, validação, riscos, limitações,
  rollback e próximos passos.
- Preserve mudanças locais e não reverta trabalho alheio sem autorização.

## Qualidade, segurança e arquitetura

- Execute `npm run check` e `git diff --check` antes de concluir um PR.
- O status `quality` deve passar antes do merge. Não desative verificadores para
  concluir uma entrega; corrija a causa ou registre uma exceção temporária.
- Todo comportamento alterado deve ter teste no menor nível confiável.
- Pesquise componentes e helpers existentes antes de criar novos. Respeite o
  fluxo `app -> components -> lib` e evite abstrações prematuras.
- Mudanças de banco, RLS, Auth, Storage, integrações ou isolamento multiempresa
  exigem staging isolado, backup restaurável e rollback ensaiado.
- Nunca versione senhas, tokens, chaves, dados pessoais ou dados operacionais
  reais em código, fixtures, Issues, PRs, logs ou screenshots.
- Termos, privacidade e DPA só podem ser marcados como aprovados após aceite
  formal do jurídico.

Consulte `docs/QUALITY_GATE.md` para ferramentas, limites e pendências.
