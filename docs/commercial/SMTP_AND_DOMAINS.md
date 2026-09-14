# Domínios, e-mail transacional e autenticação

Substitua `dominio.com.br` somente depois da liberação jurídica e reserva.

## Estrutura

- `dominio.com.br`: site institucional.
- `app.dominio.com.br`: SaaS web/PWA.
- `suporte@dominio.com.br`: suporte.
- `privacidade@dominio.com.br`: titulares e incidentes.
- `naoresponda@dominio.com.br`: e-mails transacionais.

## DNS e SMTP

- Configurar SPF com apenas os emissores autorizados.
- Publicar DKIM fornecido pelo SMTP.
- Iniciar DMARC em monitoramento, analisar relatórios e evoluir para política de
  quarentena/rejeição quando todos os emissores estiverem alinhados.
- Configurar SMTP próprio no Supabase Auth por ambiente.
- Não usar remetente de produção em dev/staging.

## Templates Supabase Auth

Convite e magic link devem apontar para:

```text
https://app.dominio.com.br/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/complete
```

Validar no staging a sintaxe exata disponibilizada pelo template do projeto,
expiração do convite, e-mail diferente, convite revogado e redirecionamento. A
rota `/auth/complete` verifica novamente convite, organização, e-mail e prazo no
banco antes de criar a associação.

## Checklist de entrega

- [ ] TLS, redirect HTTPS e domínio verificado.
- [ ] SPF, DKIM e DMARC válidos.
- [ ] Testes de entrega em provedores diferentes.
- [ ] Reply-to de suporte e rodapé jurídico.
- [ ] Alertas de bounce/complaint e supressão documentada.
