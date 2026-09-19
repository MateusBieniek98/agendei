# Formato da importação completa de apontamentos

Esta é a ordem exibida pelo importador em massa. Os seis pares de insumo existem
na tabela, mas todos são opcionais: um apontamento pode ter nenhum, um ou até
seis insumos.

| Coluna | Obrigatória | Exemplo | Regra |
| --- | --- | --- | --- |
| Data | sim | 18/07/2026 | formato `DD/MM/AAAA` |
| Equipe | sim | Equipe Norte | deve existir na empresa ativa |
| Projeto | sim | Mãe Santa | deve existir na empresa ativa |
| Talhão | sim | 017-01 | formato `000-00` |
| Serviço | sim | Roçada manual | deve existir na empresa ativa |
| Quantidade | sim | 12,5 | número maior que zero |
| Insumo 1 | não | 90000746 | código ou nome cadastrado |
| Quantidade 1 | condicional | 2,5 | obrigatória se Insumo 1 for usado |
| Insumo 2 | não |  | código ou nome cadastrado |
| Quantidade 2 | condicional |  | obrigatória se Insumo 2 for usado |
| Insumo 3 | não |  | código ou nome cadastrado |
| Quantidade 3 | condicional |  | obrigatória se Insumo 3 for usado |
| Insumo 4 | não |  | código ou nome cadastrado |
| Quantidade 4 | condicional |  | obrigatória se Insumo 4 for usado |
| Insumo 5 | não |  | código ou nome cadastrado |
| Quantidade 5 | condicional |  | obrigatória se Insumo 5 for usado |
| Insumo 6 | não |  | código ou nome cadastrado |
| Quantidade 6 | condicional |  | obrigatória se Insumo 6 for usado |
| Descarte | não | 0 | número opcional |
| Observações | não | Sem intercorrências | texto livre |

## Exemplo com três insumos

```text
Data;Equipe;Projeto;Talhão;Serviço;Quantidade;Insumo 1;Quantidade 1;Insumo 2;Quantidade 2;Insumo 3;Quantidade 3;Insumo 4;Quantidade 4;Insumo 5;Quantidade 5;Insumo 6;Quantidade 6;Descarte;Observações
18/07/2026;Equipe Norte;Mãe Santa;017-01;Roçada manual;12,5;90000746;2,5;Adjuvante X;1;Essense;16;;;;;;;;0;Concluído sem intercorrências
```

Os pares 4, 5 e 6 ficam vazios nesse exemplo. Informar quantidade sem insumo,
insumo sem quantidade, insumo inexistente ou mais de seis insumos bloqueia a
linha antes do lançamento. A API e a RPC repetem a validação no servidor.
