# Importar dados reais da GN

Use `lib/db/real_gn_base.sql` para apagar os dados de demonstração e cadastrar as equipes/atividades reais com tarifas extraídas da planilha.

Use `lib/db/update_real_fleet.sql` quando quiser atualizar somente a frota real de máquinas sem mexer nos lançamentos, equipes ou atividades.

Use `lib/db/enable_machine_status_updates.sql` para habilitar a alteração segura de status de máquinas pelo encarregado.

Use `lib/db/import_real_gn_from_tsv.sql` quando quiser importar todos os lançamentos da planilha. Cole no bloco `$gn_tsv$` as colunas desde `Inicio` até `Faturamento da Atividade`, incluindo o cabeçalho.

O app atual ainda não tem tabelas próprias para projeto, talhão e insumos. Por isso, no importador, projeto/talhão/encarregado/faturamento original entram em `observacoes` do lançamento. Insumos são ignorados por enquanto.

Antes de rodar em produção, confira se os usuários de teste existem no Supabase Auth:

- `admin@gn.local`
- `encarregado@gn.local`
- `gestor@gn.local`

Depois de importar, abra o dashboard no filtro `Ciclo atual`, `Mês anterior` ou `Personalizado`, porque os dados enviados estão em março e abril de 2026.
