# Rollout do estoque de insumos

O controle foi desenhado para valer **somente para os próximos lançamentos**.
Registros antigos continuam legíveis com o payload histórico e não consomem nem
estornam estoque retroativamente.

## Antes de liberar a operação

- [ ] Conferir unidade e estoque mínimo de cada insumo ativo.
- [ ] Fazer contagem física do estoque geral GN.
- [ ] Registrar cada saldo real em **Admin → Insumos → Estoque** como entrada
      ou ajuste, com uma observação de inventário inicial.
- [ ] Confirmar que o catálogo offline foi atualizado nos aparelhos de campo.
- [ ] Criar um lançamento controlado de teste e confirmar a baixa automática.
- [ ] Editar/excluir o teste e confirmar o estorno transacional.
- [ ] Testar um lançamento offline e validar o resultado ao sincronizar.

Não preencha saldos estimados. Enquanto todos os itens ativos estiverem em zero,
a tela administrativa exibe um aviso de estoque ainda não inicializado.

## Garantias técnicas

- O cliente bloqueia excessos óbvios para melhorar a experiência offline.
- O servidor decide no momento da sincronização e trava as linhas de estoque.
- Criação, edição, exclusão, baixa e estorno acontecem por RPCs transacionais.
- `origem_chave` preserva idempotência para reenvios da fila offline.
- Helpers internos de estoque não são executáveis por `anon` ou
  `authenticated`; somente os RPCs públicos validados são expostos.
