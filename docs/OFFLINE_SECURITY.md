# Segurança da operação offline

## Propriedade da fila

Cada item novo da fila IndexedDB registra `ownerUserId` e envia
`client_user_id` junto do payload. A interface lista e sincroniza somente itens
do usuário ativo; a API rejeita quando `client_user_id` difere da sessão.

Itens criados antes dessa regra não recebem autoria automaticamente. Eles ficam
bloqueados e aparecem apenas como contagem em `/sincronizar`. O usuário precisa
selecionar **Confirmar minha autoria** antes que esses itens possam ser enviados.
Essa confirmação nunca altera apontamentos já salvos no servidor.

## Dispositivos compartilhados

- Trocar de usuário não transfere, apaga nem envia a fila anterior.
- O indicador e o feed mostram somente pendências do usuário ativo.
- O logout avisa sobre pendências, mas preserva o IndexedDB.
- A sincronização para se a identidade ativa mudar durante o envio.

## Cache e logout

O Service Worker não armazena HTML de navegação nem respostas da API. Somente
assets públicos explícitos e arquivos de `/_next/static/` podem entrar no cache.
Sem rede, uma página neutra é exibida sem dados da sessão anterior.

O logout usa `POST /api/auth/logout`, encerra apenas a sessão atual no Supabase,
limpa caches do app e remove o identificador local do usuário. Falhas mantêm o
usuário na tela e exibem erro; não existe logout silencioso incompleto.
