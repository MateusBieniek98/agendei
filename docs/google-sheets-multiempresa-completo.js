/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * TALHIVO · Integração completa Google Sheets <-> App
 *
 * Fluxos cobertos:
 * 1. Aba "Registro de atividades" -> App/Supabase.
 * 2. App/Supabase -> aba "Apontamentos App".
 *
 * Importante:
 * - A coluna "App Source ID" evita apontamentos duplicados no app.
 * - A coluna "App Sync Status" marca o que já foi enviado.
 * - O endpoint do app também usa upsert por chave de origem.
 * - Configure SYNC_TOKEN em Configurações do projeto → Propriedades do
 *   script. Nunca grave o token neste arquivo.
 */

const APP_BASE_URL = String(
  PropertiesService.getScriptProperties().getProperty('APP_BASE_URL') ||
  'https://app.dominio.com.br'
).replace(/\/+$/, '');
const APP_IMPORT_SHEET_NAME = 'Registro de atividades';
const APP_EXPORT_SHEET_NAME = 'Apontamentos App';
const APP_LOG_SHEET_NAME = 'App Logs';

const APP_SOURCE_ID_HEADER = 'App Source ID';
const APP_STATUS_HEADER = 'App Sync Status';

function obterSyncTokenAPP_() {
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!token) throw new Error('Configure SYNC_TOKEN nas Propriedades do script.');
  return token;
}

const APP_IMPORT_API_URL = APP_BASE_URL + '/api/sync/google-sheets/registro-atividades';
const APP_EXPORT_API_URL = APP_BASE_URL + '/api/sync/google-sheets/apontamentos?escopo=tudo';
const APP_HEALTH_API_URL = APP_BASE_URL + '/api/health';

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Talhivo')
      .addItem('Instalar automação completa', 'instalarAutomacaoCompletaApp')
      .addSeparator()
      .addItem('Importar Registro para App agora', 'importarRegistroAtividadesParaAppApp')
      .addItem('Atualizar Apontamentos App agora', 'atualizarApontamentosAppApp')
      .addItem('Rodar fluxo completo agora', 'rodarFluxoCompletoApp')
      .addSeparator()
      .addItem('Validar Registro sem gravar', 'validarRegistroAtividadesApp')
      .addItem('Teste de conexão', 'testeConexaoApp')
      .addSeparator()
      .addItem('Remover automações', 'removerAutomacoesApp')
      .addToUi();
  } catch (erro) {
    escreverLogApp('Menu Talhivo não foi criado neste contexto. Abra a planilha ou execute instalarAutomacaoCompletaApp diretamente.');
  }
}

/**
 * Webhook chamado pelo app quando um apontamento é criado, editado ou excluído.
 * Publique este Apps Script como Web App e cole a URL /exec no Vercel em:
 * GOOGLE_SHEETS_APONTAMENTOS_WEBHOOK_URL
 */
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
    const token = String(body.token || (e && e.parameter && e.parameter.token) || '').trim();

    if (token !== obterSyncTokenAPP_()) {
      escreverLogApp('Webhook recusado: token inválido.');
      return criarJsonAPP_({ ok: false, error: 'unauthorized' });
    }

    const acao = String(body.acao || 'atualizar_apontamentos').trim();

    escreverLogApp(
      'Webhook recebido do app: ' +
      acao +
      ' · ' +
      String(body.evento || 'evento') +
      (body.producaoId ? ' · ' + body.producaoId : '')
    );

    if (acao === 'rodar_fluxo_completo') {
      rodarFluxoCompletoApp();
    } else {
      atualizarApontamentosAppApp();
    }

    return criarJsonAPP_({ ok: true, acao: acao, updated_at: new Date().toISOString() });
  } catch (erro) {
    escreverLogApp('ERRO doPost: ' + erro.message);
    return criarJsonAPP_({ ok: false, error: erro.message });
  }
}

function rodarFluxoCompletoApp() {
  importarRegistroAtividadesParaAppApp();
  atualizarApontamentosAppApp();
}

function importarRegistroAtividadesParaAppApp() {
  importarOuValidarRegistroAtividadesApp(false);
}

function validarRegistroAtividadesApp() {
  importarOuValidarRegistroAtividadesApp(true);
}

function importarOuValidarRegistroAtividadesApp(dryRun) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const ss = abrirPlanilhaAPP_();
    const sheet = ss.getSheetByName(APP_IMPORT_SHEET_NAME);

    if (!sheet) {
      escreverLogApp('ERRO: Aba "' + APP_IMPORT_SHEET_NAME + '" não encontrada.');
      return;
    }

    const sourceCol = garantirColunaAPP_(sheet, APP_SOURCE_ID_HEADER, '#0f766e');
    const statusCol = garantirColunaAPP_(sheet, APP_STATUS_HEADER, '#1856B3');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) {
      escreverLogApp('Aba "' + APP_IMPORT_SHEET_NAME + '" sem linhas para importar.');
      return;
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(function (h) { return String(h || '').trim(); });
    const rowsToSend = [];

    for (let i = 1; i < data.length; i += 1) {
      const rowNumber = i + 1;
      const row = data[i];
      const statusAtual = String(row[statusCol - 1] || '').toUpperCase().trim();

      if (statusAtual.startsWith('OK')) continue;
      if (!linhaTemConteudoAPP_(row, headers)) continue;

      let sourceId = String(row[sourceCol - 1] || '').trim();
      if (!sourceId) {
        sourceId = gerarSourceIdAPP_(ss, sheet, rowNumber);
        sheet.getRange(rowNumber, sourceCol).setValue(sourceId);
        row[sourceCol - 1] = sourceId;
      }

      rowsToSend.push({
        rowNumber: rowNumber,
        sourceId: sourceId,
        values: row
      });
    }

    if (rowsToSend.length === 0) {
      escreverLogApp(dryRun ? 'Nenhuma linha para validar.' : 'Nenhuma linha nova para importar.');
      return;
    }

    escreverLogApp(
      (dryRun ? 'Validando ' : 'Importando ') +
      rowsToSend.length +
      ' linhas da aba "' +
      APP_IMPORT_SHEET_NAME +
      '".'
    );

    const payload = {
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      headers: headers,
      rows: rowsToSend,
      dryRun: dryRun,
      atualizarCadastros: true
    };

    const response = chamarApiAPP_(APP_IMPORT_API_URL, 'post', payload);
    const results = response.results || [];
    const agora = Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy HH:mm');

    results.forEach(function (result) {
      if (!result.rowNumber) return;

      let statusFinal = '';
      if (result.status === 'ok') {
        statusFinal = 'OK ' + agora;
      } else if (result.status === 'validated') {
        statusFinal = 'VALIDADO ' + agora;
      } else if (result.status === 'ignored') {
        statusFinal = 'IAppORADO: ' + String(result.message || 'linha sem dados suficientes').slice(0, 450);
      } else {
        statusFinal = 'ERRO: ' + String(result.message || 'falha no servidor').slice(0, 450);
      }

      sheet.getRange(result.rowNumber, statusCol).setValue(statusFinal);
    });

    escreverLogApp(
      'Importação finalizada. OK: ' +
      (response.ok || 0) +
      ' · Ignoradas: ' +
      (response.ignored || 0) +
      ' · Erros: ' +
      (response.errors || 0)
    );
  } catch (erro) {
    escreverLogApp('ERRO importarOuValidarRegistroAtividadesApp: ' + erro.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function atualizarApontamentosAppApp() {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const payload = chamarApiAPP_(APP_EXPORT_API_URL, 'get');
    const headers = payload.headers || [];
    const rows = payload.rows || [];
    const values = [headers].concat(rows);

    const ss = abrirPlanilhaAPP_();
    const sheet = ss.getSheetByName(APP_EXPORT_SHEET_NAME) || ss.insertSheet(APP_EXPORT_SHEET_NAME);
    const requiredRows = Math.max(values.length, 2);
    const requiredCols = Math.max(headers.length, 1);

    if (sheet.getMaxRows() < requiredRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
    }

    if (sheet.getMaxColumns() < requiredCols) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredCols - sheet.getMaxColumns());
    }

    sheet.clearContents();

    if (headers.length > 0) {
      sheet.getRange(1, 1, values.length, requiredCols).setValues(values);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, requiredCols)
        .setFontWeight('bold')
        .setFontColor('#ffffff')
        .setBackground('#1856B3');
      formatarApontamentosAPP_(sheet, headers, rows.length);
      sheet.autoResizeColumns(1, requiredCols);
      sheet.getRange('A1').setNote(
        'Atualizado pelo Aplicativo em ' +
        (payload.generated_at || new Date().toISOString()) +
        '. Registros: ' +
        (payload.count || rows.length) +
        '.'
      );
    }

    escreverLogApp('Aba "' + APP_EXPORT_SHEET_NAME + '" atualizada com ' + rows.length + ' apontamentos.');
  } catch (erro) {
    escreverLogApp('ERRO atualizarApontamentosAppApp: ' + erro.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function testeConexaoApp() {
  try {
    const health = UrlFetchApp.fetch(APP_HEALTH_API_URL, {
      method: 'get',
      muteHttpExceptions: true
    });
    escreverLogApp('Teste /api/health: Status ' + health.getResponseCode() + ' - ' + health.getContentText());

    const apontamentos = UrlFetchApp.fetch(APP_EXPORT_API_URL, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + obterSyncTokenAPP_() }
    });
    escreverLogApp(
      'Teste apontamentos: Status ' +
      apontamentos.getResponseCode() +
      ' - ' +
      apontamentos.getContentText().slice(0, 500)
    );
  } catch (erro) {
    escreverLogApp('ERRO testeConexaoApp: ' + erro.message);
  }
}

function instalarAutomacaoCompletaApp() {
  removerAutomacoesApp();

  ScriptApp.newTrigger('rodarFluxoCompletoApp')
    .timeBased()
    .everyHours(1)
    .create();

  escreverLogApp('Automação completa instalada. O fluxo roda a cada 1 hora.');
}

function removerAutomacoesApp() {
  const funcoes = [
    'rodarFluxoCompletoApp',
    'importarRegistroAtividadesParaAppApp',
    'atualizarApontamentosAppApp',
    'validarRegistroAtividadesApp'
  ];

  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return funcoes.indexOf(trigger.getHandlerFunction()) >= 0;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  escreverLogApp('Automações App removidas.');
}

function chamarApiAPP_(url, method, payload) {
  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + obterSyncTokenAPP_() }
  };

  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Erro ' + status + ' em ' + url + ': ' + text);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (erro) {
    throw new Error('Resposta inválida do servidor: ' + text.slice(0, 500));
  }
}

function abrirPlanilhaAPP_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function garantirColunaAPP_(sheet, headerName, color) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim();
  });

  let idx = headers.indexOf(headerName) + 1;
  if (idx === 0) {
    idx = lastCol + 1;
    sheet.getRange(1, idx)
      .setValue(headerName)
      .setFontWeight('bold')
      .setFontColor('#ffffff')
      .setBackground(color);
  }

  return idx;
}

function gerarSourceIdAPP_(ss, sheet, rowNumber) {
  return [
    'gn',
    ss.getId(),
    limparChaveAPP_(sheet.getName()),
    rowNumber
  ].join(':');
}

function limparChaveAPP_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function linhaTemConteudoAPP_(row, headers) {
  const campos = ['Data', 'Serviço', 'Servico', 'Projeto', 'Talhão', 'Talhao', 'Produção', 'Producao'];

  return campos.some(function (campo) {
    const idx = headers.indexOf(campo);
    return idx >= 0 && String(row[idx] || '').trim() !== '';
  });
}

function colunaAPP_(headers, nome) {
  const index = headers.indexOf(nome);
  return index >= 0 ? index + 1 : null;
}

function formatarColunaAPP_(sheet, headers, nome, totalLinhas, formato) {
  const col = colunaAPP_(headers, nome);
  if (!col || totalLinhas <= 0) return;
  sheet.getRange(2, col, totalLinhas, 1).setNumberFormat(formato);
}

function formatarApontamentosAPP_(sheet, headers, totalLinhas) {
  if (totalLinhas <= 0) return;

  formatarColunaAPP_(sheet, headers, 'Data', totalLinhas, 'dd/mm/yyyy');
  formatarColunaAPP_(sheet, headers, 'Quantidade', totalLinhas, '#,##0.00');
  formatarColunaAPP_(sheet, headers, 'Descarte', totalLinhas, '#,##0.00');
  formatarColunaAPP_(sheet, headers, 'Tarifa', totalLinhas, 'R$ #,##0.00');
  formatarColunaAPP_(sheet, headers, 'Faturamento', totalLinhas, 'R$ #,##0.00');

  for (let i = 1; i <= 5; i += 1) {
    formatarColunaAPP_(sheet, headers, 'QTD ' + i, totalLinhas, '#,##0.00');
  }
}

function escreverLogApp(msg) {
  const ss = abrirPlanilhaAPP_();
  const logSheet = ss.getSheetByName(APP_LOG_SHEET_NAME) || ss.insertSheet(APP_LOG_SHEET_NAME);
  logSheet.appendRow([
    Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy HH:mm:ss'),
    msg
  ]);
}

function criarJsonAPP_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
