# Resposta a incidentes

## Classificação

- **Crítico:** vazamento entre clientes, indisponibilidade ampla, corrupção de
  produção/estoque ou credencial privilegiada comprometida.
- **Alto:** fluxo principal indisponível para um cliente ou fila sem processar.
- **Médio/baixo:** degradação com contorno ou falha sem impacto operacional.

## Primeiros passos

1. Registrar horário, ambiente, organização afetada, versão e responsável.
2. Conter o impacto: suspender integração, organização ou gravações somente no
   menor escopo necessário.
3. Preservar logs e evidências; não apagar dados para “limpar” o incidente.
4. Revogar/rotacionar credenciais comprometidas.
5. Comunicar responsáveis internos e cliente conforme contrato.
6. Acionar advogado/encarregado de privacidade para avaliar obrigações LGPD.

## Recuperação

- Restaurar a partir do último backup testado quando integridade estiver em
  dúvida.
- Reconciliar produção, estoque e faturamento antes de liberar gravações.
- Acompanhar filas offline e integrações para evitar duplicidade pós-retorno.
- Documentar causa raiz, linha do tempo, impacto e ações preventivas.

O procedimento e os contatos devem ser exercitados em staging pelo menos uma
vez antes do primeiro cliente externo e revisados após cada incidente.
