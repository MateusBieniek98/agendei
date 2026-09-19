# Observabilidade e operação

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
