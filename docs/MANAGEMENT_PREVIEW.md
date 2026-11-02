# Prévia do painel de gestão

Issue #58. Rota: `/previa/gestao`.

Prévia independente para avaliar a organização visual inspirada no painel HTML
fornecido pelo usuário. Não substitui as telas operacionais e não importa ou
consulta dados reais. O conjunto de exemplo é gerado em
`lib/management-preview.ts`, com duas competências, fazendas e equipes fictícias.

## Avaliação local

Execute `npm run dev` e abra `/previa/gestao`. Para uma revisão isolada, as
variáveis públicas do Supabase podem apontar para um projeto local descartável;
a página não exige login e não usa APIs operacionais. A rota tem `noindex`.

Avalie os filtros combinados, o ranking clicável, os detalhes e a busca de
lançamentos, a exportação CSV do recorte, os modos do gráfico e a simulação da
meta. A identificação de demonstração permanece visível na apresentação.
Simulações vivem somente na memória da página e somem ao recarregar.

## Leitura dos valores

- O período usa a data do lançamento. A data de realização aparece nos detalhes.
- Total geral = realizado da competência + retroativos.
- Total geral = apontado + saldo pendente. Pendências incluem apontamentos parciais.
- A área e o gráfico de realizado excluem retroativos; horas não entram em hectares.
- A meta é geral, inclusive com filtros. O ritmo usa dias úteis do período filtrado
  até o corte fictício do dia 28; a projeção aplica esse ritmo aos dias úteis do mês.
- A linha visual da meta é distribuída pelos dias corridos.
- A agenda é ilustrativa e acompanha somente fazenda e encarregado.

Essas regras demonstram a interface. Não constituem homologação para fechamento
financeiro ou conferência do SGF. A conexão com a planilha, a reconciliação dos
indicadores e a autorização para dados reais precisam de entrega própria,
validada em staging antes de qualquer uso em produção.

## Validação e rollback

`npm run check` e `git diff --check`. Os testes unitários cobrem reconciliação,
filtros, unidades, calendário e estados vazios. Os E2E exercitam filtros,
detalhamento, teclado, exportação, simulação, gráfico e largura em desktop/mobile.

Sem migrations ou escrita de dados. Rollback: reverter o commit da prévia.
O PR é para avaliação visual; a entrega não autoriza merge ou publicação em produção.
