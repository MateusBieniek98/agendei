/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * GN APP · Integração completa Google Sheets <-> App
 *
 * Fluxos cobertos:
 * 1. Aba "Registro de atividades" -> App/Supabase.
 * 2. App/Supabase -> aba "Apontamentos App".
 *
 * Importante:
 * - A coluna "GN Source ID" evita apontamentos duplicados no app.
 * - A coluna "GN Sync Status" marca o que já foi enviado.
 * - O endpoint do app também usa upsert por chave de origem.
 */

const GN_SYNC_TOKEN = 'gn-sync-2026-mateus-app-planilha';

const GN_APP_BASE_URL = 'https://agendei-rho.vercel.app';
const GN_IMPORT_SHEET_NAME = 'Registro de atividades';
const GN_EXPORT_SHEET_NAME = 'Apontamentos App';
const GN_LOG_SHEET_NAME = 'GN Logs';

const GN_SOURCE_ID_HEADER = 'GN Source ID';
const GN_STATUS_HEADER = 'GN Sync Status';

const GN_IMPORT_API_URL = GN_APP_BASE_URL + '/api/sync/google-sheets/registro-atividades';
const GN_EXPORT_API_URL = GN_APP_BASE_URL + '/api/sync/google-sheets/apontamentos?escopo=tudo';
const GN_HEALTH_API_URL = GN_APP_BASE_URL + '/api/health';

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('GN App')
      .addItem('Instalar automação completa', 'instalarAutomacaoCompletaGN')
      .addSeparator()
      .addItem('Importar Registro para App agora', 'importarRegistroAtividadesParaAppGN')
      .addItem('Atualizar Apontamentos App agora', 'atualizarApontamentosAppGN')
      .addItem('Rodar fluxo completo agora', 'rodarFluxoCompletoGN')
      .addSeparator()
      .addItem('Validar Registro sem gravar', 'validarRegistroAtividadesGN')
      .addItem('Teste de conexão', 'testeConexaoGN')
      .addSeparator()
      .addItem('Remover automações', 'removerAutomacoesGN')
      .addToUi();
  } catch (erro) {
    escreverLogGN('Menu GN App não foi criado neste contexto. Abra a planilha ou execute instalarAutomacaoCompletaGN diretamente.');
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

    if (token !== GN_SYNC_TOKEN) {
      escreverLogGN('Webhook recusado: token inválido.');
      return criarJsonGN_({ ok: false, error: 'unauthorized' });
    }

    const acao = String(body.acao || 'atualizar_apontamentos').trim();

    escreverLogGN(
      'Webhook recebido do app: ' +
      acao +
      ' · ' +
      String(body.evento || 'evento') +
      (body.producaoId ? ' · ' + body.producaoId : '')
    );

    if (acao === 'rodar_fluxo_completo') {
      rodarFluxoCompletoGN();
    } else {
      atualizarApontamentosAppGN();
    }

    return criarJsonGN_({ ok: true, acao: acao, updated_at: new Date().toISOString() });
  } catch (erro) {
    escreverLogGN('ERRO doPost: ' + erro.message);
    return criarJsonGN_({ ok: false, error: erro.message });
  }
}

function rodarFluxoCompletoGN() {
  importarRegistroAtividadesParaAppGN();
  atualizarApontamentosAppGN();
}

function importarRegistroAtividadesParaAppGN() {
  importarOuValidarRegistroAtividadesGN(false);
}

function validarRegistroAtividadesGN() {
  importarOuValidarRegistroAtividadesGN(true);
}

function importarOuValidarRegistroAtividadesGN(dryRun) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const ss = abrirPlanilhaGN_();
    const sheet = ss.getSheetByName(GN_IMPORT_SHEET_NAME);

    if (!sheet) {
      escreverLogGN('ERRO: Aba "' + GN_IMPORT_SHEET_NAME + '" não encontrada.');
      return;
    }

    const sourceCol = garantirColunaGN_(sheet, GN_SOURCE_ID_HEADER, '#0f766e');
    const statusCol = garantirColunaGN_(sheet, GN_STATUS_HEADER, '#1856B3');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) {
      escreverLogGN('Aba "' + GN_IMPORT_SHEET_NAME + '" sem linhas para importar.');
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
      if (!linhaTemConteudoGN_(row, headers)) continue;

      let sourceId = String(row[sourceCol - 1] || '').trim();
      if (!sourceId) {
        sourceId = gerarSourceIdGN_(ss, sheet, rowNumber);
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
      escreverLogGN(dryRun ? 'Nenhuma linha para validar.' : 'Nenhuma linha nova para importar.');
      return;
    }

    escreverLogGN(
      (dryRun ? 'Validando ' : 'Importando ') +
      rowsToSend.length +
      ' linhas da aba "' +
      GN_IMPORT_SHEET_NAME +
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

    const response = chamarApiGN_(GN_IMPORT_API_URL, 'post', payload);
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
        statusFinal = 'IGNORADO: ' + String(result.message || 'linha sem dados suficientes').slice(0, 450);
      } else {
        statusFinal = 'ERRO: ' + String(result.message || 'falha no servidor').slice(0, 450);
      }

      sheet.getRange(result.rowNumber, statusCol).setValue(statusFinal);
    });

    escreverLogGN(
      'Importação finalizada. OK: ' +
      (response.ok || 0) +
      ' · Ignoradas: ' +
      (response.ignored || 0) +
      ' · Erros: ' +
      (response.errors || 0)
    );
  } catch (erro) {
    escreverLogGN('ERRO importarOuValidarRegistroAtividadesGN: ' + erro.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function atualizarApontamentosAppGN() {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const payload = chamarApiGN_(GN_EXPORT_API_URL, 'get');
    const headers = payload.headers || [];
    const rows = payload.rows || [];
    const values = [headers].concat(rows);

    const ss = abrirPlanilhaGN_();
    const sheet = ss.getSheetByName(GN_EXPORT_SHEET_NAME) || ss.insertSheet(GN_EXPORT_SHEET_NAME);
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
      formatarApontamentosGN_(sheet, headers, rows.length);
      sheet.autoResizeColumns(1, requiredCols);
      sheet.getRange('A1').setNote(
        'Atualizado pelo GN App em ' +
        (payload.generated_at || new Date().toISOString()) +
        '. Registros: ' +
        (payload.count || rows.length) +
        '.'
      );
    }

    escreverLogGN('Aba "' + GN_EXPORT_SHEET_NAME + '" atualizada com ' + rows.length + ' apontamentos.');
  } catch (erro) {
    escreverLogGN('ERRO atualizarApontamentosAppGN: ' + erro.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function testeConexaoGN() {
  try {
    const health = UrlFetchApp.fetch(GN_HEALTH_API_URL, {
      method: 'get',
      muteHttpExceptions: true
    });
    escreverLogGN('Teste /api/health: Status ' + health.getResponseCode() + ' - ' + health.getContentText());

    const apontamentos = UrlFetchApp.fetch(GN_EXPORT_API_URL, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + GN_SYNC_TOKEN }
    });
    escreverLogGN(
      'Teste apontamentos: Status ' +
      apontamentos.getResponseCode() +
      ' - ' +
      apontamentos.getContentText().slice(0, 500)
    );
  } catch (erro) {
    escreverLogGN('ERRO testeConexaoGN: ' + erro.message);
  }
}

function instalarAutomacaoCompletaGN() {
  removerAutomacoesGN();

  ScriptApp.newTrigger('rodarFluxoCompletoGN')
    .timeBased()
    .everyHours(1)
    .create();

  escreverLogGN('Automação completa instalada. O fluxo roda a cada 1 hora.');
}

function removerAutomacoesGN() {
  const funcoes = [
    'rodarFluxoCompletoGN',
    'importarRegistroAtividadesParaAppGN',
    'atualizarApontamentosAppGN',
    'validarRegistroAtividadesGN'
  ];

  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return funcoes.indexOf(trigger.getHandlerFunction()) >= 0;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  escreverLogGN('Automações GN removidas.');
}

function chamarApiGN_(url, method, payload) {
  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + GN_SYNC_TOKEN }
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

function abrirPlanilhaGN_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function garantirColunaGN_(sheet, headerName, color) {
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

function gerarSourceIdGN_(ss, sheet, rowNumber) {
  return [
    'gn',
    ss.getId(),
    limparChaveGN_(sheet.getName()),
    rowNumber
  ].join(':');
}

function limparChaveGN_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function linhaTemConteudoGN_(row, headers) {
  const campos = ['Data', 'Serviço', 'Servico', 'Projeto', 'Talhão', 'Talhao', 'Produção', 'Producao'];

  return campos.some(function (campo) {
    const idx = headers.indexOf(campo);
    return idx >= 0 && String(row[idx] || '').trim() !== '';
  });
}

function colunaGN_(headers, nome) {
  const index = headers.indexOf(nome);
  return index >= 0 ? index + 1 : null;
}

function formatarColunaGN_(sheet, headers, nome, totalLinhas, formato) {
  const col = colunaGN_(headers, nome);
  if (!col || totalLinhas <= 0) return;
  sheet.getRange(2, col, totalLinhas, 1).setNumberFormat(formato);
}

function formatarApontamentosGN_(sheet, headers, totalLinhas) {
  if (totalLinhas <= 0) return;

  formatarColunaGN_(sheet, headers, 'Data', totalLinhas, 'dd/mm/yyyy');
  formatarColunaGN_(sheet, headers, 'Quantidade', totalLinhas, '#,##0.00');
  formatarColunaGN_(sheet, headers, 'Descarte', totalLinhas, '#,##0.00');
  formatarColunaGN_(sheet, headers, 'Tarifa', totalLinhas, 'R$ #,##0.00');
  formatarColunaGN_(sheet, headers, 'Faturamento', totalLinhas, 'R$ #,##0.00');

  for (let i = 1; i <= 5; i += 1) {
    formatarColunaGN_(sheet, headers, 'QTD ' + i, totalLinhas, '#,##0.00');
  }
}

function escreverLogGN(msg) {
  const ss = abrirPlanilhaGN_();
  const logSheet = ss.getSheetByName(GN_LOG_SHEET_NAME) || ss.insertSheet(GN_LOG_SHEET_NAME);
  logSheet.appendRow([
    Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy HH:mm:ss'),
    msg
  ]);
}

function criarJsonGN_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
