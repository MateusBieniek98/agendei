/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * GN · Sync automático da planilha "Controle de Produção GN" para o app.
 *
 * COMO INSTALAR:
 * 1. Abra a planilha "Controle de Produção GN" no Google Sheets.
 * 2. Vá em Extensões → Apps Script.
 * 3. Cole TODO este código no editor (substitua qualquer código existente OU
 *    crie um novo arquivo .gs e cole aqui).
 * 4. Em Configurações do projeto → Propriedades do script, crie
 *    GN_SYNC_TOKEN com o token configurado no Vercel.
 * 5. Ajuste GN_ABA_SERVICOS e GN_ABA_PROJETOS com os nomes exatos das abas.
 * 6. Rode instalarSyncControleProducaoGN() UMA VEZ para instalar os triggers.
 * 7. Autorize o script quando o Google pedir.
 *
 * Depois disso, qualquer edição nas abas de Serviços ou Projetos
 * será enviada automaticamente ao app em segundos.
 */

// ─── CONFIGURAÇÃO ──────────────────────────────────────────────────────────────

function _tokenControleProducao_() {
  const token = PropertiesService.getScriptProperties().getProperty('GN_SYNC_TOKEN');
  if (!token) throw new Error('Configure GN_SYNC_TOKEN nas Propriedades do script.');
  return token;
}

/** URL base do app em produção. */
const GN_CP_APP_URL = 'https://agendei-rho.vercel.app';

/**
 * Nome EXATO da aba que contém a tabela de serviços/atividades.
 * Exemplos comuns: "Tabela de Serviços", "Serviços", "Atividades".
 * Deixe em branco ('') para sincronizar qualquer aba editada.
 */
const GN_ABA_SERVICOS = 'Tabela de Serviços';

/**
 * Nome EXATO da aba que contém a lista de projetos/fazendas.
 * Exemplos: "Projetos", "Fazendas".
 * Deixe em branco ('') para não sincronizar projetos.
 */
const GN_ABA_PROJETOS = 'Projetos';

/** Linha que contém os cabeçalhos nas abas (normalmente 1). */
const GN_LINHA_CABECALHO = 1;

/** Número máximo de linhas enviadas por disparo (protege contra planilhas enormes). */
const GN_MAX_LINHAS = 500;

// ─── FUNÇÕES PÚBLICAS (rode manualmente quando necessário) ──────────────────────

/** Instala os triggers de mudança automática. Execute UMA VEZ após instalar o script. */
function instalarSyncControleProducaoGN() {
  _removerTriggersPorFuncao_('_onChangeSyncControleProducaoGN_');

  ScriptApp.newTrigger('_onChangeSyncControleProducaoGN_')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  _logGN_('✅ Trigger de sync instalado com sucesso!');
  SpreadsheetApp.getUi().alert(
    'Sync GN instalado!',
    'A partir de agora, edições nas abas de Serviços e Projetos serão enviadas ao app automaticamente.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Sincroniza TODOS os serviços da aba agora (sem esperar uma edição). */
function sincronizarTodosServicosGN() {
  const sheet = _getSheet_(GN_ABA_SERVICOS);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Aba "' + GN_ABA_SERVICOS + '" não encontrada.');
    return;
  }
  const result = _syncServicos_(sheet, null);
  SpreadsheetApp.getUi().alert('Serviços sincronizados: ' + result.ok + ' OK, ' + result.errors + ' erros.');
}

/** Sincroniza TODOS os projetos da aba agora (sem esperar uma edição). */
function sincronizarTodosProjetosGN() {
  if (!GN_ABA_PROJETOS) {
    SpreadsheetApp.getUi().alert('GN_ABA_PROJETOS não configurado.');
    return;
  }
  const sheet = _getSheet_(GN_ABA_PROJETOS);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Aba "' + GN_ABA_PROJETOS + '" não encontrada.');
    return;
  }
  const result = _syncProjetos_(sheet, null);
  SpreadsheetApp.getUi().alert('Projetos sincronizados: ' + result.ok + ' OK, ' + result.errors + ' erros.');
}

/** Adiciona o menu GN App na barra de menus. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GN App')
    .addItem('Instalar sync automático', 'instalarSyncControleProducaoGN')
    .addSeparator()
    .addItem('Sincronizar todos os serviços agora', 'sincronizarTodosServicosGN')
    .addItem('Sincronizar todos os projetos agora', 'sincronizarTodosProjetosGN')
    .addSeparator()
    .addItem('Ver logs', '_abrirLogsGN_')
    .addToUi();
}

// ─── TRIGGER INTERNO ───────────────────────────────────────────────────────────

/**
 * Disparado automaticamente pelo trigger onChange.
 * NÃO renomeie esta função — o trigger a referencia pelo nome.
 */
function _onChangeSyncControleProducaoGN_(e) {
  try {
    const ss = SpreadsheetApp.getActive();
    const activeSheet = ss.getActiveSheet();
    const sheetName = activeSheet.getName();

    _logGN_('onChange disparado na aba: ' + sheetName);

    // Aba de serviços/atividades
    if (!GN_ABA_SERVICOS || sheetName === GN_ABA_SERVICOS) {
      _syncServicos_(activeSheet, e);
    }

    // Aba de projetos/fazendas
    if (GN_ABA_PROJETOS && sheetName === GN_ABA_PROJETOS) {
      _syncProjetos_(activeSheet, e);
    }
  } catch (err) {
    _logGN_('Erro no trigger onChange: ' + String(err));
  }
}

// ─── SYNC DE SERVIÇOS ─────────────────────────────────────────────────────────

function _syncServicos_(sheet, e) {
  const ss = SpreadsheetApp.getActive();
  const spreadsheetName = ss.getName();

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < GN_LINHA_CABECALHO + 1 || lastCol < 1) {
    return { ok: 0, errors: 0 };
  }

  const allValues = sheet.getRange(GN_LINHA_CABECALHO, 1, Math.min(lastRow, GN_MAX_LINHAS + GN_LINHA_CABECALHO), lastCol).getValues();
  const headers = allValues[0].map(String);
  const dataRows = allValues.slice(1);

  // Descobre qual linha foi editada (se disponível)
  let editedRow = null;
  if (e && e.range) {
    editedRow = e.range.getRow();
  }

  const rows = dataRows
    .map(function(row, idx) {
      const rowNum = GN_LINHA_CABECALHO + 1 + idx;
      // Filtra linhas completamente vazias
      if (row.every(function(cell) { return String(cell || '').trim() === ''; })) return null;
      return {
        rowNumber: rowNum,
        values: row.map(_valorParaApi_),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return { ok: 0, errors: 0 };

  const payload = {
    spreadsheetName: spreadsheetName,
    sheetName: sheet.getName(),
    headers: headers,
    rows: rows,
    editedRange: editedRow ? { rowNumber: editedRow } : null,
  };

  const result = _chamarApi_(GN_CP_APP_URL + '/api/sync/metadata', 'POST', payload);
  _logGN_('Serviços → app: ' + result.ok + ' ok, ' + result.errors + ' erros.');
  return result;
}

// ─── SYNC DE PROJETOS ─────────────────────────────────────────────────────────

function _syncProjetos_(sheet, e) {
  const ss = SpreadsheetApp.getActive();
  const spreadsheetName = ss.getName();

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < GN_LINHA_CABECALHO + 1 || lastCol < 1) {
    return { ok: 0, errors: 0 };
  }

  const allValues = sheet.getRange(GN_LINHA_CABECALHO, 1, Math.min(lastRow, GN_MAX_LINHAS + GN_LINHA_CABECALHO), lastCol).getValues();
  const headers = allValues[0].map(String);
  const dataRows = allValues.slice(1);

  const rows = dataRows
    .map(function(row, idx) {
      const rowNum = GN_LINHA_CABECALHO + 1 + idx;
      if (row.every(function(cell) { return String(cell || '').trim() === ''; })) return null;
      return {
        rowNumber: rowNum,
        values: row.map(_valorParaApi_),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return { ok: 0, errors: 0 };

  const payload = {
    spreadsheetName: spreadsheetName,
    headers: headers,
    rows: rows,
  };

  const result = _chamarApi_(GN_CP_APP_URL + '/api/sync/projetos', 'POST', payload);
  _logGN_('Projetos → app: ' + result.ok + ' ok, ' + result.errors + ' erros.');
  return result;
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function _getSheet_(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

function _valorParaApi_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value === null || value === undefined ? '' : value;
}

function _chamarApi_(url, method, payload) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: method.toLowerCase(),
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + _tokenControleProducao_(),
      },
      payload: JSON.stringify(payload),
    });

    const status = response.getResponseCode();
    const text = response.getContentText();

    if (status !== 200) {
      _logGN_('Erro HTTP ' + status + ' em ' + url + ': ' + text.slice(0, 300));
      return { ok: 0, errors: 1, message: 'HTTP ' + status };
    }

    const parsed = JSON.parse(text);
    return { ok: parsed.ok || 0, errors: parsed.errors || 0, raw: parsed };
  } catch (err) {
    _logGN_('Erro ao chamar ' + url + ': ' + String(err));
    return { ok: 0, errors: 1, message: String(err) };
  }
}

function _logGN_(mensagem) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('GN Logs') || ss.insertSheet('GN Logs');
    sheet.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      mensagem,
    ]);
  } catch (_) {
    console.log('[GN]', mensagem);
  }
}

function _abrirLogsGN_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('GN Logs');
  if (sheet) {
    SpreadsheetApp.getActive().setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('Nenhum log registrado ainda.');
  }
}

function _removerTriggersPorFuncao_(nomeFuncao) {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === nomeFuncao; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
}
