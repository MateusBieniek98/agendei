# Observabilidade operacional

O Talhivo usa OpenTelemetry como base neutra de traces e Sentry como monitor de
erros. Datadog e New Relic não entram nesta fase para evitar custo e telemetria
duplicada.

## Responsabilidades

- OpenTelemetry continua dono do tracer provider por meio de `@vercel/otel`.
- Sentry captura erros de servidor, edge, React e navegação sem criar um segundo
  pipeline de traces.
- Quando há span ativo, o evento recebe a tag `otel.trace_id` para correlação.
- Replay, payloads de requests, cookies, query strings, tokens, e-mails e PII
  padrão ficam desativados ou são removidos antes do envio.

## Configuração

| Variável | Escopo |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN público; vazio desativa o SDK |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | nome do ambiente no navegador |
| `SENTRY_ENVIRONMENT` | nome do ambiente no servidor |
| `SENTRY_ORG` | organização usada no upload de source maps |
| `SENTRY_PROJECT` | projeto usado no upload de source maps |
| `SENTRY_AUTH_TOKEN` | segredo server-only do build |
| `OTEL_SERVICE_NAME` | nome do serviço OpenTelemetry |

O upload de source maps só é habilitado quando token, organização e projeto
estão presentes. O token deve existir apenas no ambiente de build; source maps
são apagados depois do upload. Nunca colocar o token em variável `NEXT_PUBLIC`.

## Ativação em staging

1. Criar projeto Sentry e configurar DSN e token no ambiente preview/staging.
2. Publicar o preview e gerar um erro controlado sem dado operacional.
3. Confirmar stack trace legível, ambiente correto e ausência de PII.
4. Confirmar `otel.trace_id` em erro de request com span ativo.
5. Criar alertas para erro novo, regressão, pico de 5xx e falha de login.
6. Direcionar alertas críticos ao responsável e exercitar o canal.
7. Só então configurar as variáveis de produção na janela planejada.

## Sinais obrigatórios

- falhas de login e autorização;
- erros 5xx e rotas mais afetadas;
- falhas e idade da fila offline;
- conflitos de estoque e sincronização;
- indisponibilidade de `/api/health`;
- atraso ou falha do backup diário.

Fila, estoque e backup ainda precisam de métricas de domínio próprias. Este PR
entrega captura segura de exceções; a Issue `#8` permanece aberta até alertas,
uptime e sinais de negócio serem ativados e testados no staging.
