/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * GN · sincronização automática de apontamentos do app para Google Sheets.
 *
 * Cole este código em Extensões → Apps Script dentro da planilha:
 * Controle de Produção GN
 *
 * Depois:
 * 1. Troque GN_SYNC_TOKEN pelo mesmo valor configurado no Vercel.
 * 2. Rode instalarAtualizacaoAutomaticaGN() uma vez.
 * 3. Autorize o script quando o Google pedir.
 */

const GN_SPREADSHEET_ID = '1KrTQYh1JkNCUj4UvgSZm4LCd58MFSAAzP0sdC1jMv9Y';
const GN_SHEET_NAME = 'Apontamentos App';
const GN_SYNC_TOKEN = 'COLE_AQUI_O_GOOGLE_SHEETS_SYNC_TOKEN';
const GN_API_URL = 'https://www.appdamarei.com/api/sync/google-sheets/apontamentos?escopo=tudo';

function atualizarApontamentosGN() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const response = UrlFetchApp.fetch(GN_API_URL, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${GN_SYNC_TOKEN}`,
      },
    });

    const status = response.getResponseCode();
    const text = response.getContentText();

    if (status !== 200) {
      throw new Error(`Erro ${status} ao buscar apontamentos: ${text}`);
    }

    const payload = JSON.parse(text);
    const headers = payload.headers || [];
    const rows = payload.rows || [];
    const values = [headers, ...rows];

    const ss = SpreadsheetApp.openById(GN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(GN_SHEET_NAME) || ss.insertSheet(GN_SHEET_NAME);

    const requiredRows = Math.max(values.length, 2);
    const requiredCols = Math.max(headers.length, 1);

    if (sheet.getMaxRows() < requiredRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
    }
    if (sheet.getMaxColumns() < requiredCols) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredCols - sheet.getMaxColumns());
    }

    sheet.clearContents();
    sheet.getRange(1, 1, values.length, requiredCols).setValues(values);
    sheet.setFrozenRows(1);

    const headerRange = sheet.getRange(1, 1, 1, requiredCols);
    headerRange
      .setFontWeight('bold')
      .setFontColor('#ffffff')
      .setBackground('#1856B3');

    formatarApontamentosGN(sheet, headers, rows.length);

    sheet.autoResizeColumns(1, requiredCols);
    sheet.getRange('A1').setNote(
      `Atualizado automaticamente pelo app GN em ${payload.generated_at}. ` +
      `Registros: ${payload.count}.`
    );
  } finally {
    lock.releaseLock();
  }
}

function colunaGN(headers, nome) {
  const index = headers.indexOf(nome);
  return index >= 0 ? index + 1 : null;
}

function formatarColunaGN(sheet, headers, nome, totalLinhas, formato) {
  const col = colunaGN(headers, nome);
  if (!col || totalLinhas <= 0) return;
  sheet.getRange(2, col, totalLinhas, 1).setNumberFormat(formato);
}

function formatarApontamentosGN(sheet, headers, totalLinhas) {
  if (totalLinhas <= 0) return;

  formatarColunaGN(sheet, headers, 'Data', totalLinhas, 'yyyy-mm-dd');
  formatarColunaGN(sheet, headers, 'Quantidade', totalLinhas, '#,##0.00');
  formatarColunaGN(sheet, headers, 'Descarte', totalLinhas, '#,##0.00');

  for (let i = 1; i <= 5; i += 1) {
    formatarColunaGN(sheet, headers, `QTD ${i}`, totalLinhas, '#,##0.00');
  }

  formatarColunaGN(sheet, headers, 'Tarifa', totalLinhas, 'R$ #,##0.00');
  formatarColunaGN(sheet, headers, 'Faturamento', totalLinhas, 'R$ #,##0.00');
}

function instalarAtualizacaoAutomaticaGN() {
  const functionName = 'atualizarApontamentosGN';

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === functionName)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();

  atualizarApontamentosGN();
}
