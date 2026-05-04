# Roadmap — melhorias futuras

Sugestões priorizadas pensando em **ganhos reais para a operação de
silvicultura da GN**, não apenas refinamentos genéricos.

## Curto prazo (próximos sprints)

### 1. PWA offline-first robusto
Hoje há um fallback rudimentar com `localStorage`. Evoluir para:
- Service Worker com **Workbox** para cachear assets e API
- Background Sync para reenviar lançamentos quando voltar a conexão
- IndexedDB para fila de operações pendentes
- Indicador visual claro de "offline / sincronizando / sincronizado"

### 2. Foto de comprovação por lançamento
Encarregado pode anexar 1–3 fotos no momento do registro. Storage no
Supabase Storage, EXIF preservado (data/hora/coordenadas quando
disponíveis). Útil para auditoria do contratante e para resolver
divergências.

### 3. Geolocalização da frente
Captura de `navigator.geolocation` opcional no lançamento. Em campo
permite:
- Validar se o lançamento foi feito dentro do polígono do talhão
- Mostrar no admin um pin do local em mapa (Leaflet + tiles abertos)
- Identificar "pingos fora" (lançamentos suspeitos)

### 4. App nativo (React Native + Expo)
Reaproveita o backend Supabase. Ganha câmera nativa, GPS contínuo,
push notifications, e funcionamento offline mais previsível em
celulares Android antigos. Mantém uma única base de schema/auth.

## Médio prazo

### 5. Mapa de talhões com GeoJSON
- Cadastro de talhões/áreas em GeoJSON (uploadável)
- Tela do gestor mostra o mosaico colorido por % de execução
- Cálculo automático de área plantada/restante por talhão

### 6. Integração com clima (INMET / OpenWeather)
- Card "previsão hoje" no app do encarregado
- Alertas de chuva forte para reorganizar frentes
- Histórico cruzado: "produção por dia × precipitação" (correlação
  útil para projetar metas em períodos chuvosos)

### 7. Predição de produção
Modelo simples (regressão sobre os últimos 30/60 dias) para projetar:
- "Vamos bater a meta?" — previsão + intervalo de confiança
- "Frente Norte está 30% abaixo da média" — alerta automático
- "Plantio cai 40% em dias de chuva > 20mm" — insights acionáveis

### 8. Controle de combustível e EPI
- Lançamento de combustível por máquina/dia → custo real por hectare
- Controle de EPI (ficha de entrega + validade dos itens)
- Custo total por atividade = mão de obra + máquina + combustível + insumo

### 9. Relatórios prontos para o contratante
PDF mensal automatizado contendo:
- Quadro resumo de produção
- Mapa de talhões
- Fotos de comprovação
- Notas técnicas (clima, ocorrências)

Geração programada via cron (`/api/cron/relatorio-mensal`) e envio
automático por e-mail no dia 1º.

## Longo prazo

### 10. Integração com ERP do contratante (SAP / TOTVS)
Webhooks de saída em `lib/integrations/webhooks.ts` já preparados.
Adicionar um adapter SAP que:
- Mapeia `producao` → ordem de serviço
- Concilia `faturamento` → fatura
- Recebe atualizações de preço por atividade

### 11. Controle de qualidade e replantio direcionado
- Vistorias periódicas de mortandade por talhão
- Geração automática de **lista de replantio** com volumes
- Histórico que vincula custo de plantio inicial × replantio

### 12. Inventário florestal e CAR/SISCAR
- Cadastro de espécie, idade, altura média, DAP por talhão
- Cálculo de volume estimado (`m³` por hectare) usando equações de
  inventário (ex.: Schumacher–Hall)
- Geração de relatórios para órgãos ambientais

### 13. Multi-empresa / multi-cliente
Hoje o GN serve uma operação. Para escalar como produto:
- Tabela `clientes` (a contratante)
- RLS por `cliente_id`
- Faturamento separado por contratante na visão admin

### 14. Assinatura digital de medições
Encarregado e fiscal do contratante assinam a medição diária na tela
(mouse/dedo). Hash da assinatura + timestamp + foto vão para um log
imutável (idealmente em outra tabela com RLS append-only).

### 15. Pagamento por produção (folha)
Tela específica para fechamento de folha:
- Produção por colaborador (não só por equipe) com valor pago
- Exportação em layout de banco (CNAB 240) para pagamento em massa
- Holerite com comprovação por foto/assinatura

## Melhorias de UX/DX

- **Atalhos de teclado** no admin (`g d` → dashboard, `g l` → lançamentos)
- **Busca global** (Ctrl+K) para encontrar lançamentos / máquinas / equipes
- **Tema escuro** completo — operação noturna em alguns turnos
- **Internacionalização** (PT-BR padrão; ES e EN para clientes futuros)
- **Testes** — Playwright pra fluxos críticos de campo, Vitest pras
  funções de cálculo de meta e faturamento
- **Observability** — Sentry para erros + Posthog/Mixpanel para entender
  como o encarregado realmente usa em campo
