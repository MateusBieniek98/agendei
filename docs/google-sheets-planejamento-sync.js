/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * GN · Sync automático da planilha "Planejamento de atividades - GN" para o app.
 *
 * COMO INSTALAR:
 * 1. Abra a planilha "Planejamento de atividades- GN - MAIO2026" no Google Sheets.
 * 2. Vá em Extensões → Apps Script.
 * 3. Cole TODO este código no editor (substitua qualquer código existente OU
 *    crie um novo arquivo .gs).
 * 4. Em Configurações do projeto → Propriedades do script, crie
 *    GN_SYNC_TOKEN com o token configurado no Vercel.
 * 5. Ajuste GN_PLAN_ABA_PRINCIPAL com o nome exato da aba de planejamento.
 * 6. Verifique GN_PLAN_ANO e GN_PLAN_MES (ou deixe 0 para detectar automático).
 * 7. Rode instalarSyncPlanejamentoGN() UMA VEZ para instalar os triggers.
 * 8. Autorize o script quando o Google pedir.
 *
 * Depois disso, qualquer edição na aba de planejamento será enviada
 * automaticamente ao app em segundos.
 */

// ─── CONFIGURAÇÃO ──────────────────────────────────────────────────────────────

function _tokenPlanejamentoGN_() {
  const token = PropertiesService.getScriptProperties().getProperty('GN_SYNC_TOKEN');
  if (!token) throw new Error('Configure GN_SYNC_TOKEN nas Propriedades do script.');
  return token;
}

/** URL base do app em produção. */
const GN_PLAN_APP_URL = 'https://agendei-rho.vercel.app';

/**
 * ID da planilha de planejamento (encontrado na URL do Google Sheets).
 * Ex.: https://docs.google.com/spreadsheets/d/ESTE_ID_AQUI/edit
 * Deixe em branco para usar a planilha ativa automaticamente.
 */
const GN_PLAN_SPREADSHEET_ID = '';

/**
 * Nome EXATO da aba que contém o planejamento mensal.
 * Baseado no histórico: "Programação Mensal".
 */
const GN_PLAN_ABA_PRINCIPAL = 'Programação Mensal';

/**
 * Ano e mês do planejamento.
 * Use 0 em ambos para detectar automaticamente pelo nome da planilha
 * (ex.: "MAIO2026" → mes=5, ano=2026).
 */
const GN_PLAN_ANO = 0;  // ex.: 2026 (ou 0 para auto)
const GN_PLAN_MES = 0;  // ex.: 5 para maio (ou 0 para auto)

/** Linha que contém os cabeçalhos (normalmente 1). */
const GN_PLAN_LINHA_CABECALHO = 1;

/** Número máximo de linhas enviadas por disparo. */
const GN_PLAN_MAX_LINHAS = 500;

// ─── FUNÇÕES PÚBLICAS ──────────────────────────────────────────────────────────

/** Instala os triggers de mudança automática. Execute UMA VEZ após instalar o script. */
function instalarSyncPlanejamentoGN() {
  _removerTriggersPlanejamento_('_onChangeSyncPlanejamentoGN_');

  const ss = GN_PLAN_SPREADSHEET_ID
    ? SpreadsheetApp.openById(GN_PLAN_SPREADSHEET_ID)
    : SpreadsheetApp.getActive();

  ScriptApp.newTrigger('_onChangeSyncPlanejamentoGN_')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  _logPlan_('✅ Trigger de sync do planejamento instalado!');
  SpreadsheetApp.getUi().alert(
    'Sync GN instalado!',
    'A partir de agora, edições na aba "' + GN_PLAN_ABA_PRINCIPAL + '" serão enviadas ao app automaticamente.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Sincroniza TODO o planejamento da aba agora (sem esperar uma edição). */
function sincronizarTodoPlanejamentoGN() {
  const ss = GN_PLAN_SPREADSHEET_ID
    ? SpreadsheetApp.openById(GN_PLAN_SPREADSHEET_ID)
    : SpreadsheetApp.getActive();

  const sheet = ss.getSheetByName(GN_PLAN_ABA_PRINCIPAL);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Aba "' + GN_PLAN_ABA_PRINCIPAL + '" não encontrada.');
    return;
  }

  const result = _syncPlanejamento_(ss, sheet, false);
  SpreadsheetApp.getUi().alert(
    'Planejamento sincronizado!\n' +
    result.ok + ' linhas enviadas\n' +
    result.ignored + ' ignoradas\n' +
    result.errors + ' erros'
  );
}

/** Valida o planejamento sem gravar no banco (dry run). */
function validarPlanejamentoGN() {
  const ss = GN_PLAN_SPREADSHEET_ID
    ? SpreadsheetApp.openById(GN_PLAN_SPREADSHEET_ID)
    : SpreadsheetApp.getActive();

  const sheet = ss.getSheetByName(GN_PLAN_ABA_PRINCIPAL);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Aba "' + GN_PLAN_ABA_PRINCIPAL + '" não encontrada.');
    return;
  }

  const result = _syncPlanejamento_(ss, sheet, true);
  SpreadsheetApp.getUi().alert(
    'Validação (sem gravar):\n' +
    result.ok + ' linhas válidas\n' +
    result.ignored + ' ignoradas\n' +
    result.errors + ' com erro'
  );
}

/** Adiciona menu GN App na planilha. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GN App')
    .addItem('Instalar sync automático', 'instalarSyncPlanejamentoGN')
    .addSeparator()
    .addItem('Sincronizar todo o planejamento agora', 'sincronizarTodoPlanejamentoGN')
    .addItem('Validar (sem gravar no app)', 'validarPlanejamentoGN')
    .addSeparator()
    .addItem('Ver logs', '_abrirLogsPlan_')
    .addToUi();
}

// ─── TRIGGER INTERNO ───────────────────────────────────────────────────────────

/**
 * Disparado automaticamente pelo trigger onChange.
 * NÃO renomeie esta função.
 */
function _onChangeSyncPlanejamentoGN_(e) {
  try {
    const ss = GN_PLAN_SPREADSHEET_ID
      ? SpreadsheetApp.openById(GN_PLAN_SPREADSHEET_ID)
      : SpreadsheetApp.getActive();

    const activeSheet = ss.getActiveSheet();
    const sheetName = activeSheet.getName();

    _logPlan_('onChange disparado na aba: ' + sheetName);

    if (sheetName !== GN_PLAN_ABA_PRINCIPAL) {
      _logPlan_('Aba ignorada (não é o planejamento): ' + sheetName);
      return;
    }

    _syncPlanejamento_(ss, activeSheet, false);
  } catch (err) {
    _logPlan_('Erro no trigger onChange: ' + String(err));
  }
}

// ─── SYNC PRINCIPAL ────────────────────────────────────────────────────────────

function _syncPlanejamento_(ss, sheet, dryRun) {
  const spreadsheetName = ss.getName();
  const spreadsheetId = ss.getId();

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < GN_PLAN_LINHA_CABECALHO + 1 || lastCol < 1) {
    _logPlan_('Aba vazia ou sem dados após o cabeçalho.');
    return { ok: 0, ignored: 0, errors: 0 };
  }

  const maxLinhas = Math.min(lastRow, GN_PLAN_MAX_LINHAS + GN_PLAN_LINHA_CABECALHO);
  const allValues = sheet.getRange(GN_PLAN_LINHA_CABECALHO, 1, maxLinhas, lastCol).getValues();
  const headers = allValues[0].map(String);
  const dataRows = allValues.slice(1);

  const rows = dataRows
    .map(function(row, idx) {
      const rowNum = GN_PLAN_LINHA_CABECALHO + 1 + idx;
      // Pula linhas em branco
      if (row.every(function(cell) { return String(cell || '').trim() === ''; })) return null;
      return {
        rowNumber: rowNum,
        values: row.map(_valorParaPlanApi_),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    _logPlan_('Nenhuma linha com conteúdo encontrada.');
    return { ok: 0, ignored: 0, errors: 0 };
  }

  // Ano/Mês: usa configuração manual ou deixa o backend derivar do nome
  const payload = {
    spreadsheetId: spreadsheetId,
    spreadsheetName: spreadsheetName,
    sheetName: sheet.getName(),
    headers: headers,
    rows: rows,
    dryRun: dryRun,
  };

  if (GN_PLAN_ANO > 0) payload.ano = GN_PLAN_ANO;
  if (GN_PLAN_MES > 0) payload.mes = GN_PLAN_MES;

  const url = GN_PLAN_APP_URL + '/api/sync/planejamento' + (dryRun ? '' : '');
  const response = _chamarApiPlan_(url, payload);

  const ok = response.ok || 0;
  const ignored = response.ignored || 0;
  const errors = response.errors || 0;

  _logPlan_(
    (dryRun ? '[DRY RUN] ' : '') +
    'Planejamento → app: ' + ok + ' ok, ' + ignored + ' ignorados, ' + errors + ' erros. ' +
    'Mês: ' + (response.mes || '?') + '/' + (response.ano || '?')
  );

  // Marca erros na aba com fundo vermelho claro (opcional)
  if (!dryRun && Array.isArray(response.results)) {
    _marcarErrosNaAba_(sheet, response.results, headers);
  }

  return { ok: ok, ignored: ignored, errors: errors };
}

// ─── MARCAÇÃO DE STATUS NA ABA ─────────────────────────────────────────────────

/**
 * Opcional: colore as linhas com erro em vermelho claro na aba.
 * Cria a coluna "GN Status" se não existir.
 */
function _marcarErrosNaAba_(sheet, results, headers) {
  try {
    const lastCol = sheet.getLastColumn();
    const headerRow = sheet.getRange(GN_PLAN_LINHA_CABECALHO, 1, 1, lastCol).getValues()[0];
    let statusCol = headerRow.findIndex(function(h) { return String(h).trim() === 'GN Status'; });

    if (statusCol < 0) {
      statusCol = lastCol; // Adiciona nova coluna
      sheet.getRange(GN_PLAN_LINHA_CABECALHO, statusCol + 1).setValue('GN Status')
        .setFontWeight('bold')
        .setBackground('#1856B3')
        .setFontColor('#ffffff');
    } else {
      statusCol = statusCol; // já existe
    }

    results.forEach(function(result) {
      if (!result.rowNumber) return;
      const cell = sheet.getRange(result.rowNumber, statusCol + 1);
      if (result.status === 'ok') {
        cell.setValue('✅ Sincronizado').setBackground('#d9f0d3');
      } else if (result.status === 'error') {
        cell.setValue('❌ ' + (result.message || 'Erro')).setBackground('#ffd7d7');
      } else if (result.status === 'ignored') {
        cell.setValue('— Ignorado').setBackground('#f5f5f5');
      }
    });
  } catch (err) {
    _logPlan_('Aviso: não foi possível marcar status na aba: ' + String(err));
  }
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function _valorParaPlanApi_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value === null || value === undefined ? '' : value;
}

function _chamarApiPlan_(url, payload) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + _tokenPlanejamentoGN_(),
      },
      payload: JSON.stringify(payload),
    });

    const status = response.getResponseCode();
    const text = response.getContentText();

    if (status !== 200) {
      _logPlan_('Erro HTTP ' + status + ': ' + text.slice(0, 400));
      return { ok: 0, ignored: 0, errors: 1, results: [] };
    }

    return JSON.parse(text);
  } catch (err) {
    _logPlan_('Erro na chamada à API: ' + String(err));
    return { ok: 0, ignored: 0, errors: 1, results: [] };
  }
}

function _logPlan_(mensagem) {
  try {
    const ss = GN_PLAN_SPREADSHEET_ID
      ? SpreadsheetApp.openById(GN_PLAN_SPREADSHEET_ID)
      : SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('GN Logs') || ss.insertSheet('GN Logs');
    sheet.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      mensagem,
    ]);
  } catch (_) {
    console.log('[GN Planejamento]', mensagem);
  }
}

function _abrirLogsPlan_() {
  const ss = GN_PLAN_SPREADSHEET_ID
    ? SpreadsheetApp.openById(GN_PLAN_SPREADSHEET_ID)
    : SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('GN Logs');
  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('Nenhum log registrado ainda.');
  }
}

function _removerTriggersPlanejamento_(nomeFuncao) {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === nomeFuncao; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
}
