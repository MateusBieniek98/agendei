# Gate Playwright em staging

O smoke local de 26/08/2026 confirmou renderização da nova tela de login, nome
global neutro, campos acessíveis e redirecionamento de rotas protegidas. O teste
completo abaixo depende de staging migrado e de usuários de teste; não pode ser
substituído pelo smoke local.

## Preparação

- Staging restaurado e migrations aplicadas.
- Organizações fictícias A e B ativas.
- Um administrador, gestor, encarregado e manutenção em A; um usuário em B.
- MFA configurado para administrador da plataforma.
- Dados e tokens exclusivos de staging; nenhuma integração de produção ativa.

Use o wrapper da skill Playwright ou `npx --package @playwright/cli
playwright-cli`. Sempre abra a página, capture `snapshot`, interaja pelos refs e
capture novo snapshot após cada navegação.

## Fluxos obrigatórios

1. Login de cada papel e validação da home correta.
2. Plataforma sem AAL2 redireciona para MFA; com AAL2 lista clientes.
3. Criar organização, convidar admin e aceitar convite.
4. Admin do cliente cria equipe e configura catálogos.
5. Importar apontamento sem insumo, com um e com seis insumos.
6. Rejeitar sétimo insumo, par incompleto e item de outro cliente.
7. Criar produção e validar o texto completo para WhatsApp.
8. Ficar offline, enfileirar apontamento, trocar/restaurar conexão e sincronizar
   somente na organização original.
9. Exportar CSV/XLSX e sincronizar Google Sheets com token do cliente A.
10. Confirmar que usuário A não vê IDs/dados de B em URL, busca ou UI.
11. Suspender A e confirmar tela comercial; B continua funcionando.
12. Expirar/revogar convite e confirmar que `/auth/complete` bloqueia associação.

## Evidência

Guardar em armazenamento interno, fora do Git: data, commit, URL de staging,
responsável, snapshots, screenshots relevantes, trace de falhas e resultado por
fluxo. Qualquer falha de isolamento bloqueia a produção.
