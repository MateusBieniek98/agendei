# Observabilidade e operação

## Base implementada

O servidor registra traces com OpenTelemetry por meio de `@vercel/otel`, usando
`talhivo-web` como nome padrão do serviço e `OTEL_SERVICE_NAME` para separar
ambientes. Erros não tratados do Next.js geram evento estruturado sem conteúdo
de requisição, query string, credencial ou dado operacional.

OpenTelemetry é a camada neutra. Sentry, Datadog e New Relic não devem ser
instalados simultaneamente. A escolha do backend de erros, métricas e alertas
permanece na Issue #8 e deve considerar custo, retenção, residência dos dados e
integração com os traces existentes.

## Monitorar

- taxa de erro e latência por rota, sem registrar segredos ou dados excessivos;
- disponibilidade de `/api/health` e autenticação;
- falhas de produção/estoque, importação, exportação e Google Sheets;
- tamanho, idade e tentativas das filas;
- uso de banco, Storage, conexões e limite de usuários;
- ações em `/platform` e alterações administrativas.

## Alertas mínimos

- vazamento suspeito ou violação de RLS: crítico e imediato;
- saúde externa falhando por dois ciclos: alto;
- erro de RPC de estoque/produção acima do limiar: alto;
- fila sem sucesso por mais de uma hora: alto;
- backup ou teste de restauração atrasado: alto;
- erro de e-mail/convite acima do limiar: médio.

## Logs

Produção deve usar logs JSON com timestamp, nível, evento, request ID,
organização, usuário e resultado. Nunca registrar token, senha, service-role,
conteúdo integral de observação ou dados pessoais desnecessários.

A escolha e configuração dos provedores de erro, uptime e logs são dependências
de infraestrutura. DSNs e chaves ficam somente no servidor e separados por
ambiente.
