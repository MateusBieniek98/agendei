# Modo de manutenção

Use este modo somente em uma janela aprovada de migration ou publicação de alto
risco. Ele não substitui backup, staging, reconciliação nem rollback.

## Configuração

Defina no ambiente de deploy:

```text
MAINTENANCE_MODE=true
MAINTENANCE_BYPASS_TOKEN=<token aleatório com pelo menos 32 caracteres>
```

Com o modo ativo:

- páginas redirecionam para `/manutencao-sistema`;
- APIs retornam HTTP 503 com `code: maintenance_mode`;
- `/api/health`, `/api/auth/logout` e a própria página de manutenção continuam disponíveis;
- requisições com o header `x-maintenance-bypass` correto continuam para smoke tests autorizados.

O header de bypass é removido antes de encaminhar a requisição ao app. Nunca use
o token em URL, log, screenshot, Issue ou Pull Request.

## Sequência da janela

1. Validar release e bypass em preview.
2. Comunicar a janela, ativar `MAINTENANCE_MODE=true` e promover o deploy de manutenção.
3. Confirmar HTTP 503 nas APIs sem bypass.
4. Executar backup final, migrations e reconciliação.
5. Executar smoke tests com bypass.
6. Desativar o modo somente após aprovação técnica e operacional.
7. Remover/rotacionar o token usado na janela.

Se qualquer reconciliação ou teste crítico falhar, mantenha o modo ativo e siga
o procedimento de rollback. A janela prevista é de até 60 minutos.
