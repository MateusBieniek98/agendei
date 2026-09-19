# Segredos de integrações por organização

Cada cliente recebe um token aleatório exclusivo. O banco guarda:

- SHA-256 em `token_hash` para autenticar chamadas que entram no app;
- AES-256-GCM em `config.encrypted_sync_token` para o webhook do app para o
  Google Sheets;
- URL `/exec` do Apps Script na configuração da própria organização.

O texto puro é retornado uma vez na geração/rotação em `/platform` e não é
persistido. A chave mestra fica apenas no servidor:

```bash
openssl rand -base64 32
```

Grave o resultado como `INTEGRATIONS_ENCRYPTION_KEY` separadamente em staging e
produção. Não versionar, copiar para o cliente ou registrar em log. A rotação da
chave mestra exige decifrar e recifrar todos os segredos antes de remover a
chave anterior; até existir uma ferramenta de rotação, faça isso em janela
controlada ou rotacione individualmente os tokens das organizações.

Revogar uma integração significa definir `enabled = false`. Rotacionar gera
novo token, invalida o hash anterior e registra auditoria sem o segredo.
