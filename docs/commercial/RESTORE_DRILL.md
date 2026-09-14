# Ensaio de backup e restauração

## Evidência mínima

- data/hora, ambiente, responsável e versão;
- origem, tamanho e SHA-256 do backup;
- início/fim da restauração e RTO observado;
- ponto restaurado e RPO observado;
- logs, contagens reconciliadas e decisão final.

## Procedimento

1. Criar projeto Supabase descartável e sem integrações externas ativas.
2. Restaurar o backup usando o método oficial do plano contratado.
3. Aplicar somente migrations posteriores ao ponto do backup.
4. Usar segredos exclusivos de staging e impedir disparos de e-mail/webhook.
5. Executar reconciliação, matriz RLS, login e fluxos críticos.
6. Validar anexos de Storage ou registrar explicitamente se o backup é separado.
7. Destruir o ambiente descartável apenas depois de guardar o relatório.

O teste falha se faltar dado, houver diferença financeira/estoque, o RLS não
isolar clientes ou o tempo exceder o objetivo contratual.
