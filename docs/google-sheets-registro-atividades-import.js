/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * GN · importacao automatica da aba "Registro de atividades" para o app.
 *
 * Cole este codigo em Extensoes -> Apps Script dentro da planilha:
 * Controle de Producao GN
 *
 * Depois:
 * 1. Troque GN_SYNC_TOKEN pelo mesmo valor configurado no Vercel.
 * 2. Rode importarRegistroAtividadesParaAppGN() uma vez.
 * 3. Autorize o script quando o Google pedir.
 * 4. Se quiser automatico, rode instalarImportacaoRegistroAtividadesGN().
 */

const GN_IMPORT_SPREADSHEET_ID = '1KrTQYh1JkNCUj4UvgSZm4LCd58MFSAAzP0sdC1jMv9Y';
const GN_IMPORT_SHEET_NAME = 'Registro de atividades';
const GN_IMPORT_API_URL = 'https://www.appdamarei.com/api/sync/google-sheets/registro-atividades';
const GN_SYNC_TOKEN = 'COLE_AQUI_O_GOOGLE_SHEETS_SYNC_TOKEN';
const GN_ID_HEADER = 'GN App ID';
const GN_STATUS_HEADER = 'GN Sync Status';
const GN_BATCH_SIZE = 300;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GN App')
    .addItem('Enviar Registro de atividades para o app', 'importarRegistroAtividadesParaAppGN')
    .addItem('Validar sem gravar no app', 'validarRegistroAtividadesGN')
    .addItem('Instalar sincronizacao automatica', 'instalarImportacaoRegistroAtividadesGN')
    .addToUi();
}

function normalizarCabecalhoGN(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function indiceCabecalhoGN(headers, nomes) {
  const buscados = nomes.map(normalizarCabecalhoGN);
  return headers.findIndex((header) => buscados.includes(normalizarCabecalhoGN(header)));
}

function valorParaApiGN(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value === null || value === undefined ? '' : value;
}

function garantirColunaGN(sheet, headerName) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const existingIndex = headers.findIndex((header) => header.trim() === headerName);
  if (existingIndex >= 0) return existingIndex + 1;

  sheet.insertColumnAfter(lastColumn);
  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(headerName);
  sheet.getRange(1, newColumn).setFontWeight('bold').setBackground('#1856B3').setFontColor('#ffffff');
  return newColumn;
}

function linhaTemConteudoGN(row, headers) {
  const indices = [
    indiceCabecalhoGN(headers, ['Data']),
    indiceCabecalhoGN(headers, ['Servico', 'Serviço', 'Atividade']),
    indiceCabecalhoGN(headers, ['Projeto', 'Fazenda']),
    indiceCabecalhoGN(headers, ['Talhao', 'Talhão']),
    indiceCabecalhoGN(headers, ['Producao', 'Produção', 'Quantidade']),
  ].filter((index) => index >= 0);

  return indices.some((index) => String(row[index] || '').trim() !== '');
}

function carregarLinhasRegistroAtividadesGN() {
  const ss = SpreadsheetApp.openById(GN_IMPORT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(GN_IMPORT_SHEET_NAME);
  if (!sheet) throw new Error(`Aba "${GN_IMPORT_SHEET_NAME}" nao encontrada.`);

  const idCol = garantirColunaGN(sheet, GN_ID_HEADER);
  const statusCol = garantirColunaGN(sheet, GN_STATUS_HEADER);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return { sheet, headers: [], rows: [], statusCol };
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map((header) => String(header || '').trim());
  const rows = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index].map(valorParaApiGN);
    if (!linhaTemConteudoGN(row, headers)) continue;

    let sourceId = String(row[idCol - 1] || '').trim();
    if (!sourceId) {
      sourceId = Utilities.getUuid();
      row[idCol - 1] = sourceId;
      sheet.getRange(index + 1, idCol).setValue(sourceId);
    }

    rows.push({
      rowNumber: index + 1,
      sourceId,
      values: row,
    });
  }

  return { sheet, headers, rows, statusCol };
}

function enviarLoteRegistroAtividadesGN(headers, rows, dryRun) {
  const response = UrlFetchApp.fetch(GN_IMPORT_API_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${GN_SYNC_TOKEN}`,
    },
    payload: JSON.stringify({
      spreadsheetName: 'Controle de Producao GN',
      sheetName: GN_IMPORT_SHEET_NAME,
      headers,
      rows,
      dryRun: dryRun === true,
      atualizarCadastros: true,
    }),
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Erro ${status} ao importar Registro de atividades: ${text}`);
  }

  return JSON.parse(text);
}

function atualizarStatusLinhasGN(sheet, statusCol, results, dryRun) {
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

  results.forEach((result) => {
    if (!result.rowNumber) return;

    let status = '';
    if (result.status === 'ok') status = `OK ${now}`;
    else if (result.status === 'validated') status = `VALIDADO ${now}`;
    else if (result.status === 'ignored') status = `IGNORADO: ${result.message || ''}`;
    else status = `ERRO: ${result.message || 'falha desconhecida'}`;

    if (dryRun && result.status !== 'validated') status = `VALIDACAO: ${status}`;
    sheet.getRange(result.rowNumber, statusCol).setValue(status);
  });
}

function importarOuValidarRegistroAtividadesGN(dryRun) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const { sheet, headers, rows, statusCol } = carregarLinhasRegistroAtividadesGN();
    if (rows.length === 0) {
      SpreadsheetApp.getUi().alert('Nenhuma linha encontrada para importar.');
      return;
    }

    let totalOk = 0;
    let totalIgnored = 0;
    let totalErrors = 0;

    for (let start = 0; start < rows.length; start += GN_BATCH_SIZE) {
      const lote = rows.slice(start, start + GN_BATCH_SIZE);
      const payload = enviarLoteRegistroAtividadesGN(headers, lote, dryRun);
      atualizarStatusLinhasGN(sheet, statusCol, payload.results || [], dryRun);
      totalOk += payload.ok || 0;
      totalIgnored += payload.ignored || 0;
      totalErrors += payload.errors || 0;
    }

    SpreadsheetApp.getUi().alert(
      `${dryRun ? 'Validacao' : 'Importacao'} concluida.\n` +
      `OK: ${totalOk}\nIgnoradas: ${totalIgnored}\nErros: ${totalErrors}`
    );
  } finally {
    lock.releaseLock();
  }
}

function importarRegistroAtividadesParaAppGN() {
  importarOuValidarRegistroAtividadesGN(false);
}

function validarRegistroAtividadesGN() {
  importarOuValidarRegistroAtividadesGN(true);
}

function instalarImportacaoRegistroAtividadesGN() {
  const functionName = 'importarRegistroAtividadesParaAppGN';

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === functionName)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();

  importarRegistroAtividadesParaAppGN();
}
