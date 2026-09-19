# Transformação comercial — status de execução

Atualizado em 14/09/2026. Este diretório converte o plano de 90 dias em artefatos
executáveis. Código pronto não significa migração aplicada: o banco de produção
continua dependendo de staging, backup, reconciliação e janela aprovada.

## Implementado no repositório

- Modelo multiempresa com organizações, associações, convites, configurações,
  integrações, limites e status comercial.
- GN preparada como primeira organização por backfill preservando os dados.
- Papel movido para a associação usuário-organização.
- Contexto de organização ativa, seletor para usuários multiempresa e bloqueio
  de organizações suspensas/canceladas.
- RLS multiempresa, validação de relacionamentos e RPCs transacionais
  endurecidas para produção e estoque.
- Área `/platform` separada, com MFA obrigatório, criação de cliente, convite
  do primeiro administrador, limite de usuários, status de contrato, rotação de
  token de integração com exibição única e auditoria.
- MFA disponível em “Segurança da conta” para administradores dos clientes.
- Convites expiráveis para usuários e URLs de confirmação compatíveis com SSR.
- Cache, fila offline, Storage, idempotência e integrações separados por cliente.
- Importação em massa com até seis insumos opcionais.
- Identidade Talhivo centralizada e organização cliente visível como contexto
  operacional, sem misturar as marcas dos clientes.
- Runtime e CI em Node.js 24; gate de lint, tipos, unidade e build.
- Dependências atualizadas e `npm audit` sem vulnerabilidades conhecidas na
  árvore instalada.

## Validação local em 14/09/2026

- `npm run check`: lint, TypeScript, 36 testes e build Next.js aprovados.
- `npm audit`: zero vulnerabilidades conhecidas na árvore instalada.
- Login Talhivo verificado em 1440 x 960 e 390 x 844, sem erro de console.
- Manifesto PWA, ícones e nomes exibidos no Android/iOS atualizados.
- Migrations SQL e testes RLS permanecem sem execução em banco real. A ausência
  de staging isolado bloqueia esse gate, não autoriza teste na produção da GN.

## Pronto para staging, ainda não executado

- Aplicar as três migrations multiempresa em cópia restaurada da produção.
- Executar matriz RLS, reconciliação e testes de fluxo completo.
- Validar URLs, e-mails, PWA, sync, offline e Storage com dois clientes fictícios.
- Medir duração e ensaiar rollback.

## Dependências externas

- Abrir a nova empresa, validar tributação e emitir contratos/notas fiscais.
- Formalizar cessão de código e ativos digitais.
- Fazer busca profissional no INPI, reservar domínios e protocolar marca.
- Configurar projetos separados de Supabase/Vercel, SMTP, DNS, monitoramento,
  uptime, alertas e política de backup.
- Revisar contrato SaaS, termos, privacidade, DPA e resposta a incidentes.
- Gravar treinamento, contratar o piloto e acompanhar indicadores por 90 dias.

## Gates de liberação

1. Nenhuma migration multiempresa é executada diretamente em produção.
2. Nenhum nome candidato vira marca pública antes de domínio reservado e busca.
3. Nenhum cliente externo entra antes de teste de isolamento entre organizações.
4. Nenhuma migração da GN é aprovada sem reconciliação de 100% dos registros.
5. A operação nativa Android/iOS continua fora do lançamento de 90 dias; o
   canal comercial inicial é web/PWA.

O roteiro do gate visual está em [PLAYWRIGHT_STAGING.md](PLAYWRIGHT_STAGING.md).
A identidade de trabalho está em [BRAND_IDENTITY.md](BRAND_IDENTITY.md).
