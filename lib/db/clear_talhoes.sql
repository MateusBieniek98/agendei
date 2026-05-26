-- GN · limpar cadastro de talhoes
-- Use quando quiser apagar todos os talhoes cadastrados manualmente
-- e recomecar o preenchimento pela aba Admin > Projetos.
--
-- Este script NAO apaga projetos/fazendas, planejamento ou apontamentos.

delete from public.talhoes;

select
  count(*) as talhoes_restantes
from public.talhoes;
