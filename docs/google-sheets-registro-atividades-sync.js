/**
 * GN · Sync automático da aba "Registro de atividades"
 * Planilha: Controle de Produção GN
 *
 * v2 — detecta automaticamente a linha de cabeçalho e loga diagnóstico.
 * Configure GN_SYNC_TOKEN em Configurações do projeto → Propriedades do
 * script. Nunca grave o token neste arquivo.
 */

const GN_RA_APP_URL      = 'https://agendei-rho.vercel.app';
const GN_RA_ABA          = 'Registro de atividades';
const GN_RA_MAX_LINHAS   = 2000;

// Palavras-chave usadas para detectar a linha de cabeçalho
// (qualquer coluna que contenha uma dessas palavras conta)
var GN_RA_PALAVRAS_CABECALHO = ['data', 'serviço', 'servico', 'atividade', 'projeto', 'fazenda', 'talhão', 'talhao'];

function _tokenRegistroAtividades_() {
  var token = PropertiesService.getScriptProperties().getProperty('GN_SYNC_TOKEN');
  if (!token) throw new Error('Configure GN_SYNC_TOKEN nas Propriedades do script.');
  return token;
}

// ─── FUNÇÕES PÚBLICAS ──────────────────────────────────────────────────────────

function instalarSyncRegistroAtividadesGN() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === '_onChangeRegistroAtividades_'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('_onChangeRegistroAtividades_')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  _logRA_('✅ Trigger instalado.');
  SpreadsheetApp.getUi().alert(
    'Sync GN instalado!',
    'Edições na aba "' + GN_RA_ABA + '" serão enviadas ao app automaticamente.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function sincronizarRegistroAtividadesAgora() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(GN_RA_ABA);
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "' + GN_RA_ABA + '" não encontrada.'); return; }
  var r = _enviarAba_(sheet, false);
  SpreadsheetApp.getUi().alert('Pronto!\n' + r.ok + ' ok · ' + r.ignored + ' ignoradas · ' + r.errors + ' erros');
}

function validarRegistroAtividadesGN() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(GN_RA_ABA);
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "' + GN_RA_ABA + '" não encontrada.'); return; }
  var r = _enviarAba_(sheet, true);
  SpreadsheetApp.getUi().alert('[Validação]\n' + r.ok + ' válidas · ' + r.ignored + ' ignoradas · ' + r.errors + ' erros');
}

/** Mostra os primeiros cabeçalhos detectados — útil para diagnóstico. */
function diagnosticarCabecalhosGN() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(GN_RA_ABA);
  if (!sheet) { SpreadsheetApp.getUi().alert('Aba "' + GN_RA_ABA + '" não encontrada.'); return; }

  var headerRow = _detectarLinhaCabecalho_(sheet);
  if (headerRow < 1) {
    SpreadsheetApp.getUi().alert('Não foi possível detectar a linha de cabeçalho.\n\nVerifique se a aba "' + GN_RA_ABA + '" tem colunas como "Data", "Serviço", "Projeto", "Talhão" e "Produção".');
    return;
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(String);
  var firstDataRow = sheet.getRange(headerRow + 1, 1, 1, lastCol).getValues()[0].map(String);

  SpreadsheetApp.getUi().alert(
    'Linha de cabeçalho detectada: ' + headerRow + '\n\n' +
    'Colunas: ' + headers.filter(function(h) { return h.trim(); }).join(' | ') + '\n\n' +
    'Primeira linha de dados:\n' + firstDataRow.filter(function(v) { return v.trim(); }).slice(0, 6).join(' | ')
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GN App')
    .addItem('Instalar sync automático', 'instalarSyncRegistroAtividadesGN')
    .addSeparator()
    .addItem('Sincronizar aba agora', 'sincronizarRegistroAtividadesAgora')
    .addItem('Validar sem gravar', 'validarRegistroAtividadesGN')
    .addItem('Diagnosticar cabeçalhos', 'diagnosticarCabecalhosGN')
    .addSeparator()
    .addItem('Ver logs', '_abrirLogsRA_')
    .addToUi();
}

// ─── TRIGGER INTERNO ──────────────────────────────────────────────────────────

function _onChangeRegistroAtividades_(e) {
  try {
    var ss        = SpreadsheetApp.getActive();
    var sheetName = ss.getActiveSheet().getName();
    _logRA_('onChange em: ' + sheetName);
    if (sheetName !== GN_RA_ABA) return;
    _enviarAba_(ss.getSheetByName(GN_RA_ABA), false);
  } catch (err) {
    _logRA_('Erro no trigger: ' + String(err));
  }
}

// ─── DETECÇÃO DE CABEÇALHO ────────────────────────────────────────────────────

/**
 * Procura a linha de cabeçalho nas primeiras 5 linhas da aba.
 * Retorna o número da linha (1-based) ou -1 se não encontrar.
 */
function _detectarLinhaCabecalho_(sheet) {
  var maxLinhasParaVerificar = 5;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return -1;

  var amostra = sheet.getRange(1, 1, Math.min(maxLinhasParaVerificar, sheet.getLastRow()), lastCol).getValues();

  for (var r = 0; r < amostra.length; r++) {
    var row = amostra[r];
    var textos = row.map(function(c) { return _normalizar_(String(c || '')); });
    var temPalavraChave = GN_RA_PALAVRAS_CABECALHO.some(function(palavra) {
      return textos.some(function(t) { return t === palavra || t.indexOf(palavra) >= 0; });
    });
    if (temPalavraChave) {
      _logRA_('Cabeçalho detectado na linha ' + (r + 1) + ': ' + row.map(String).filter(function(h) { return h.trim(); }).join(' | '));
      return r + 1; // 1-based
    }
  }
  return -1;
}

function _normalizar_(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── ENVIO PARA O APP ─────────────────────────────────────────────────────────

function _enviarAba_(sheet, dryRun) {
  var ss      = SpreadsheetApp.getActive();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    _logRA_('Aba vazia.');
    return { ok: 0, ignored: 0, errors: 0 };
  }

  // Detecta a linha de cabeçalho
  var headerRow = _detectarLinhaCabecalho_(sheet);
  if (headerRow < 1) {
    _logRA_('ERRO: não foi possível detectar a linha de cabeçalho. Certifique-se de que a aba tem colunas como "Data", "Serviço", "Projeto", "Talhão" e "Produção".');
    return { ok: 0, ignored: 0, errors: 1 };
  }

  var maxRow  = Math.min(lastRow, GN_RA_MAX_LINHAS + headerRow);
  var numLinhas = maxRow - headerRow + 1;
  if (numLinhas < 2) {
    _logRA_('Sem linhas de dados após o cabeçalho.');
    return { ok: 0, ignored: 0, errors: 0 };
  }

  var allValues = sheet.getRange(headerRow, 1, numLinhas, lastCol).getValues();
  var headers   = allValues[0].map(String);
  var dataRows  = allValues.slice(1);

  // Log de diagnóstico dos cabeçalhos
  _logRA_('Cabeçalhos enviados: ' + headers.filter(function(h) { return h.trim(); }).slice(0, 12).join(' | '));

  var rows = dataRows
    .map(function(row, i) {
      if (row.every(function(c) { return String(c || '').trim() === ''; })) return null;
      return { rowNumber: headerRow + 1 + i, values: row.map(_fmt_) };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    _logRA_('Nenhuma linha com dados encontrada.');
    return { ok: 0, ignored: 0, errors: 0 };
  }

  _logRA_('Enviando ' + rows.length + ' linhas para o app...');

  var payload = {
    spreadsheetName:    ss.getName(),
    sheetName:          sheet.getName(),
    headers:            headers,
    rows:               rows,
    dryRun:             dryRun,
    atualizarCadastros: true,
  };

  var resp = _post_(GN_RA_APP_URL + '/api/sync/google-sheets/registro-atividades', payload);

  // Log do resultado com amostra de erros/ignorados
  _logRA_((dryRun ? '[DRY] ' : '') + 'ok=' + resp.ok + ' ignored=' + resp.ignored + ' errors=' + resp.errors);

  if (resp.results && Array.isArray(resp.results)) {
    // Loga as primeiras 3 linhas ignoradas com o motivo
    var ignoradas = resp.results.filter(function(r) { return r.status === 'ignored'; }).slice(0, 3);
    ignoradas.forEach(function(r) {
      _logRA_('Ignorada linha ' + r.rowNumber + ': ' + (r.message || '(sem mensagem)'));
    });
    // Loga os primeiros 3 erros
    var erros = resp.results.filter(function(r) { return r.status === 'error'; }).slice(0, 3);
    erros.forEach(function(r) {
      _logRA_('ERRO linha ' + r.rowNumber + ': ' + (r.message || '(sem mensagem)'));
    });
  }

  return { ok: resp.ok || 0, ignored: resp.ignored || 0, errors: resp.errors || 0 };
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function _fmt_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()))
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : v;
}

function _post_(url, payload) {
  try {
    var res  = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + _tokenRegistroAtividades_() },
      payload: JSON.stringify(payload),
    });
    var code = res.getResponseCode();
    var text = res.getContentText();
    if (code !== 200) { _logRA_('HTTP ' + code + ': ' + text.slice(0, 300)); return { ok:0, ignored:0, errors:1 }; }
    return JSON.parse(text);
  } catch (err) {
    _logRA_('Erro fetch: ' + String(err));
    return { ok:0, ignored:0, errors:1 };
  }
}

function _logRA_(msg) {
  try {
    var ss    = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName('GN Logs') || ss.insertSheet('GN Logs');
    sheet.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'), msg]);
  } catch (_) { console.log('[GN]', msg); }
}

function _abrirLogsRA_() {
  var s = SpreadsheetApp.getActive().getSheetByName('GN Logs');
  if (s) SpreadsheetApp.getActive().setActiveSheet(s);
  else SpreadsheetApp.getUi().alert('Nenhum log ainda.');
}
