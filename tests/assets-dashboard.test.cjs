const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFrontendDash() {
  const ctx = vm.createContext({
    document: { addEventListener() {}, getElementById() { return null; } },
    esc: s => String(s ?? ''),
    googleUser: { role: 'GESTAO', email: 'gestor@voanet.com.br' }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/assets-dashboard.js'), 'utf8'), ctx);
  return ctx;
}

function loadBackendDash() {
  const sheets = {
    Ativos: [
      ['Local', 'Categoria', 'Equipamento', 'Fabricante', 'Modelo', 'Nº Série', 'Patrimônio', 'Status', 'Data_Ultima_Inspecao', 'ID_Ativo', 'Codigo_POP', 'ID_Ultima_Inspecao', 'Observações'],
      ['POP Curralinho', 'OLT', 'OLT', 'Huawei', 'MA5800-X7', '0012345', 'PAT-001', 'Operacional', '2026-11-20', 'AS-1', 'POP-01', 'INSP-1', 'OK'],
      ['POP Curralinho', 'Retificadora', 'Sistema Retificador', 'Delta', 'ESR-48', 'SN-RET-1', 'PAT-002', 'Crítico', '2026-06-01', 'AS-2', 'POP-01', 'INSP-2', 'UR02 em falha'],
      ['POP Centro', 'Ar-condicionado', 'Ar-condicionado', 'Elgin', 'Eco 30k', 'SN-AC-1', 'PAT-003', 'Atenção', '2026-11-10', 'AS-3', 'POP-02', 'INSP-3', '']
    ],
    Controle_Baterias: [
      ['Estação', 'Tecnologia', 'Fabricante', 'Modelo', 'Quantidade', 'Patrimônio', 'Descrição', 'Ano Fabricante', 'Data Instalação', 'Tempo de Uso (meses)', 'Autonomia (h)', 'Tensão Nominal (V)', 'Capacidade (Ah)', 'Próxima Teste', 'Status', 'Data_Ultima_Inspecao', 'ID_Ativo', 'Codigo_POP', 'Observações'],
      ['POP Curralinho', 'CHUMBO-ÁCIDO (VRLA)', 'Moura', '12MF150', '4', 'PAT-B1', 'Banco 01', '2022', '01/03/2022', '56', '2.5', '48', '150', '01/12/2026', 'Atenção', '2026-11-20', 'AS-B1', 'POP-01', '']
    ],
    Retificadores: [
      ['Estação', 'Fabricante', 'Modelo', 'Módulos', 'Corrente (A) (TOTAL)', 'Tensão (V)', 'UR 01', 'UR 02', 'UR 03', 'UR 04', 'Data de Verficação', 'Proxima Verificação', 'Status', 'Nº Série', 'Patrimônio', 'ID_Ativo', 'Codigo_POP', 'Observações'],
      ['POP Curralinho', 'Delta', 'ESR-48', '3', '150', '53.5', 'OK', 'Falha', 'OK', '', '2026-06-01', '2026-09-01', 'Crítico', 'SN-RET-1', 'PAT-002', 'AS-R1', 'POP-01', '']
    ],
    'Climatização_Voanet': [
      ['Estação', 'Fabricante', 'Modelo', 'BTUs', 'Tipo', 'Nº Série', 'Patrimônio', 'Tipo de Gás', 'Carga Gás', 'Data Instalação', 'Última Medição Corrente', 'Última Medição Temperatura', 'Próxima Manutenção', 'Status', 'Data_Ultima_Inspecao', 'ID_Ativo', 'Codigo_POP', 'Observações'],
      ['POP Centro', 'Elgin', 'Eco 30k', '30000', 'Split', 'SN-AC-1', 'PAT-003', 'R410A', '1.8kg', '2024-01-10', '11.2', '28.5', '2026-10-01', 'Atenção', '2026-11-10', 'AS-C1', 'POP-02', '']
    ],
    Historico_Ativos_POPs: [
      ['ID_Evento', 'Momento', 'ID_Inspecao', 'Codigo_POP', 'Aba', 'ID_Ativo', 'Acao', 'Detalhe'],
      ['EV-1', '2026-11-20 10:00', 'INSP-1', 'POP-01', 'Ativos', 'AS-1', 'ATUALIZADO', 'MA5800-X7']
    ]
  };
  const makeSheet = rows => ({
    getLastRow: () => rows.length,
    getLastColumn: () => rows[0].length,
    getRange: (r, c, nr, nc) => ({
      getDisplayValues: () => rows.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc))
    })
  });
  const cacheStore = new Map();
  const ctx = vm.createContext({
    config_: () => ({ SPREADSHEET_ID: 'main', ACCESS_SPREADSHEET_ID: 'access' }),
    book_: () => ({ getSheetByName: name => (sheets[name] ? makeSheet(sheets[name]) : null) }),
    privateValue_: () => 'v1',
    hash_: s => 'h_' + s,
    CacheService: { getScriptCache: () => ({ get: k => cacheStore.get(k) || null, put: (k, v) => cacheStore.set(k, v) }) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/assets.gs'), 'utf8'), ctx);
  return { ctx, cacheStore };
}

test('endpoint assetsDashboard exige perfil GESTAO, consolida 4 abas preservando zeros e usa cache', () => {
  const { ctx, cacheStore } = loadBackendDash();
  assert.throws(() => ctx.assetsDashboard_({}, { role: 'OPERACAO', email: 'op@voanet.com.br' }), /Gestão/);

  const res = ctx.assetsDashboard_({}, { role: 'GESTAO', email: 'gestor@voanet.com.br' });
  assert.equal(res.ok, true);
  assert.equal(res.assets.length, 3);
  assert.equal(res.assets[0].serial, '0012345');
  assert.equal(res.batteries.length, 1);
  assert.equal(res.rectifiers.length, 1);
  assert.equal(res.climate.length, 1);
  assert.equal(res.recentEvents.length, 1);
  assert.equal(cacheStore.size, 1);
});

test('dashboard de ativos calcula saúde, ranking de POPs críticos, alertas de infra, busca por série e CSV seguro', () => {
  const dash = loadFrontendDash();
  const nowMs = Date.UTC(2026, 10, 28);
  const sample = {
    assets: [
      { id: '1', stationCode: 'POP-01', station: 'POP Curralinho', category: 'OLT', equipment: 'OLT', maker: 'Huawei', model: 'MA5800', serial: '0012345', assetTag: 'PAT-001', status: 'Operacional', lastInspection: '2026-11-20', note: '=SUM(1,2)' },
      { id: '2', stationCode: 'POP-01', station: 'POP Curralinho', category: 'Retificadora', equipment: 'Sistema Retificador', maker: 'Delta', model: 'ESR-48', serial: 'SN-RET-1', assetTag: 'PAT-002', status: 'Crítico', lastInspection: '2026-06-01' },
      { id: '3', stationCode: 'POP-02', station: 'POP Centro', category: 'Ar-condicionado', equipment: 'Ar-condicionado', maker: 'Elgin', model: 'Eco 30k', serial: 'SN-AC-1', assetTag: 'PAT-003', status: 'Atenção', lastInspection: '2026-11-10' }
    ],
    batteries: [
      { station: 'POP Curralinho', tech: 'CHUMBO-ÁCIDO (VRLA)', maker: 'Moura', model: '12MF150', ageMonths: '56', autonomy: '2.5', status: 'Operacional' },
      { station: 'POP Centro', tech: 'LÍTIO (LiFePO4)', maker: 'Huawei', model: 'ESM-48100', ageMonths: '12', autonomy: '8', status: 'Operacional' }
    ],
    rectifiers: [
      { station: 'POP Curralinho', maker: 'Delta', model: 'ESR-48', ur01: 'OK', ur02: 'Falha', nextCheck: '2026-09-01', status: 'Operacional' }
    ],
    climate: [
      { station: 'POP Centro', maker: 'Elgin', model: 'Eco 30k', tempC: '28.5', status: 'Operacional' }
    ],
    recentEvents: []
  };

  const m = dash.computeAssetDashboardMetrics(sample, {}, nowMs);
  assert.equal(m.totalBase, 3);
  assert.equal(m.statusCounts.Operacional, 1);
  assert.equal(m.statusCounts['Crítico'], 1);
  assert.equal(m.statusCounts['Atenção'], 1);
  assert.equal(m.healthPct, 33);
  assert.equal(m.staleCount, 1);
  assert.equal(m.popRanking[0].station, 'POP Curralinho');
  assert.equal(m.batteryTech.vrla, 1);
  assert.equal(m.batteryTech.litio, 1);
  assert.equal(m.batteryAlerts, 1);
  assert.equal(m.rectifierAlerts, 1);
  assert.equal(m.climateAlerts, 1);
  assert.equal(m.infraAlertCount, 3);

  // Busca por número de série
  const bySerial = dash.computeAssetDashboardMetrics(sample, { search: '0012345' }, nowMs);
  assert.equal(bySerial.filteredAssets.length, 1);
  assert.equal(bySerial.filteredAssets[0].assetTag, 'PAT-001');

  // CSV neutraliza fórmula
  const csv = dash.adBuildCsv('assets', bySerial);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
});

test('stationInventory carrega ativos do POP para Operação/Gestão e resumo semanal envia apenas para Gestão', () => {
  const { ctx } = loadBackendDash();
  const sentEmails = [];
  ctx.stations_ = () => [
    { code: 'POP-01', name: 'POP Curralinho', criticality: 'Alta', days: 45, inactive: false, duplicate: false },
    { code: 'POP-02', name: 'POP Centro', criticality: 'Média', days: 90, inactive: false, duplicate: false }
  ];
  ctx.beginRequest_ = () => {};
  ctx.requirePrivateData_ = () => {};
  ctx.accessUsers_ = () => [
    { email: 'gestor@voanet.com.br', role: 'GESTAO', active: true },
    { email: 'op@voanet.com.br', role: 'OPERACAO', active: true }
  ];
  ctx.dashboard_ = () => ({
    summary: {
      latest: [
        { stationCode: 'POP-01', station: 'POP Curralinho', due: '2026-10-01' }
      ]
    }
  });
  ctx.Utilities = { formatDate: () => '2026-11-28' };
  ctx.MailApp = { sendEmail: opts => sentEmails.push(opts) };

  const inv = ctx.stationInventory_({ stationCode: 'POP-01' }, { role: 'OPERACAO', email: 'op@voanet.com.br' });
  assert.equal(inv.ok, true);
  assert.equal(inv.equipment.length, 1);
  assert.equal(inv.equipment[0].modelo, 'MA5800-X7');
  assert.equal(inv.retificadoras.length, 1);
  assert.equal(inv.bancos.length, 1);
  assert.equal(inv.climatizadores.length, 0);

  assert.throws(() => ctx.sendWeeklySummaryRequest_({}, { role: 'OPERACAO', email: 'op@voanet.com.br' }), /Gestão/);
  const sent = ctx.sendWeeklySummaryRequest_({}, { role: 'GESTAO', email: 'gestor@voanet.com.br' });
  assert.equal(sent.ok, true);
  assert.equal(sent.sent, 1);
  assert.equal(sentEmails[0].to, 'gestor@voanet.com.br');
  assert.equal(sent.stats.overdue, 1);
  assert.equal(sent.stats.neverInspected, 1);
  assert.equal(sent.stats.critAssets, 1);
});

test('applyStationInventoryToRecord mescla sem duplicar e googleHistoryTrend calcula evolução de NCs', () => {
  const ctx = vm.createContext({
    document: { addEventListener() {}, getElementById() { return null; } },
    window: { addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    esc: s => String(s ?? ''),
    fmt: s => String(s ?? ''),
    button: () => '',
    isGoogleMode: () => true,
    cur: () => null,
    view: 'home'
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/google-sync.js'), 'utf8'), ctx);

  const rec = {
    inventory: [{ id: 'EQ-1', centralId: 'AS-1', serie: '0012345', modelo: 'MA5800-X7' }],
    equipamentos: { climatizadores: [], retificadoras: [], dios: [] },
    invBatteryBanks: []
  };
  const added = ctx.applyStationInventoryToRecord(rec, {
    equipment: [
      { centralId: 'AS-1', tipo: 'OLT', fabricante: 'Huawei', modelo: 'MA5800-X7', serie: '0012345' },
      { centralId: 'AS-9', tipo: 'Switch', fabricante: 'Datacom', modelo: 'DM4370', serie: 'SN-SW-9' }
    ],
    climatizadores: [{ centralId: 'AS-C1', marca: 'Elgin', modelo: 'Eco 30k', serie: 'SN-AC-1' }],
    retificadoras: [{ centralId: 'AS-R1', fabricante: 'Delta', modelo: 'ESR-48', serie: 'SN-RET-1' }],
    bancos: [{ centralId: 'AS-B1', identificacao: 'Banco 01', tensao: '48', capacidade: '150' }]
  });
  assert.equal(added, 4);
  assert.equal(rec.inventory.length, 2);
  assert.equal(rec.equipamentos.climatizadores.length, 1);
  assert.equal(rec.equipamentos.retificadoras.length, 1);
  assert.equal(rec.invBatteryBanks.length, 1);

  const history = [
    { id: 'INSP-3', stationCode: 'POP-01', date: '2026-11-20', updated: '2026-11-20T12:00:00Z', nc: 1 },
    { id: 'INSP-2', stationCode: 'POP-01', date: '2026-10-01', updated: '2026-10-01T12:00:00Z', nc: 4 },
    { id: 'INSP-1', stationCode: 'POP-01', date: '2026-08-15', updated: '2026-08-15T12:00:00Z', nc: 4 }
  ];
  assert.equal(ctx.googleHistoryTrend(history[0], history).cls, 'down');
  assert.equal(ctx.googleHistoryTrend(history[0], history).label, '↓ -3 NC');
  assert.equal(ctx.googleHistoryTrend(history[1], history).cls, 'same');
  assert.equal(ctx.googleHistoryTrend(history[2], history), null);
});
