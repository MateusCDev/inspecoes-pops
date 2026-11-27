const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAppContext() {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const match = html.match(/<script>\r?\n([\s\S]*?)<\/script>/);
  assert.ok(match, 'Inline script not found in public/index.html');
  const syncScript = fs.readFileSync(path.join(__dirname, '../public/google-sync.js'), 'utf8');
  const photosScript = fs.readFileSync(path.join(__dirname, '../public/inspection-photos.js'), 'utf8');

  const alerts = [];
  const navigated = [];
  const elements = new Map([
    ['app', { innerHTML: '', hidden: false, querySelector: () => null }],
    ['goHome', { onclick: null }],
    ['save', { textContent: '' }],
  ]);

  const context = vm.createContext({
    console,
    Blob,
    URL,
    CSS: { escape: (s) => s },
    Intl,
    localStorage: {
      store: new Map(),
      getItem(k) { return this.store.get(k) ?? null; },
      setItem(k, v) { this.store.set(k, String(v)); },
    },
    navigator: { onLine: true },
    location: { protocol: 'https:', hostname: 'example.test', href: 'https://example.test/' },
    window: {
      VOANET_SYNC_CONFIG: { mode: 'google', google: { endpoint: 'https://script.google.com/macros/s/mock/exec' } },
      addEventListener() {},
      scrollTo() {},
    },
    document: {
      visibilityState: 'visible',
      activeElement: null,
      addEventListener() {},
      getElementById(id) { return elements.get(id) || null; },
    },
    alert(msg) { alerts.push(msg); },
    confirm: () => true,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(photosScript, context);
  vm.runInContext(syncScript, context);
  vm.runInContext(match[1], context);
  vm.runInContext(`
    googleUser = { email: 'tecnico@example.test', role: 'OPERACAO' };
    googleAccessKey = 'chave-teste';
    googleStations = [{ code: 'POP.001', name: 'POP Centro', city: 'Salvador', criticality: 'ALTA', days: 45, duplicate: false, inactive: false }];
    navigate = (step) => { __navigated.push(step); view = step; };
  `, Object.assign(context, { __navigated: navigated }));

  return { context, alerts, navigated };
}

test('blank preenche horário de início automaticamente e validação exige campos obrigatórios', () => {
  const { context } = loadAppContext();
  const r = context.blank();
  assert.match(r.inicio, /^\d{2}:\d{2}$/);
  assert.equal(r.fim, '');

  const check = context.inspectionValidation(r);
  const messages = check.errors.map((e) => e.message).join(' | ');
  assert.match(messages, /POP cadastrado/);
  assert.match(messages, /Técnico 01/);
  assert.match(messages, /condição de acesso/);
  assert.match(messages, /possui torre/);
  assert.match(messages, /câmeras CFTV/);
  assert.match(messages, /criticidade operacional/);
});

test('sem acesso dispensa checklist/torre/CFTV e exige justificativa', () => {
  const { context } = loadAppContext();
  const r = context.blank();
  r.codigoPop = 'POP.001';
  r.nome = 'POP Centro';
  r.inspetor = 'Mateus Cesar';
  r.acesso = 'Sem acesso';

  const withoutReason = context.inspectionValidation(r);
  assert.equal(withoutReason.errors.length, 1);
  assert.match(withoutReason.errors[0].message, /registre o motivo/);

  r.observacoes = 'Portão trancado e sem contato do responsável local.';
  const withReason = context.inspectionValidation(r);
  assert.equal(withReason.errors.length, 0);
  assert.ok(withReason.warnings.some((w) => /foto da fachada/.test(w.message)));
});

test('NC exige observação e síntese, enquanto foto, plano de ação e inventário incompleto viram alertas opcionais', () => {
  const { context } = loadAppContext();
  const r = context.blank();
  r.codigoPop = 'POP.001';
  r.nome = 'POP Centro';
  r.inspetor = 'Mateus Cesar';
  r.acesso = 'Liberado';
  r.torrePresenca = 'Não';
  r.cftvPresenca = 'Não';
  r.classificacao = 'Moderada';
  r.checks['EL-01'] = { status: 'NC', note: '' };
  r.inventoryReview = { equipamentos: 'alterado' };
  r.inventory = [{ id: 'AT-1', tipo: 'Switch', modelo: 'S5720' }];

  const first = context.inspectionValidation(r);
  assert.equal(first.errors.length, 2);
  assert.ok(first.errors.some((e) => /EL-01/.test(e.message)));
  assert.ok(first.errors.some((e) => /síntese/.test(e.message)));

  r.checks['EL-01'].note = 'Quadro sem identificação de disjuntores.';
  r.sintese = 'Identificada pendência de identificação no quadro elétrico.';
  const second = context.inspectionValidation(r);
  assert.equal(second.errors.length, 0);
  assert.ok(second.warnings.some((w) => /sem foto vinculada: EL-01/.test(w.message)));
  assert.ok(second.warnings.some((w) => /sem registro no Plano de ação/.test(w.message)));
  assert.ok(second.warnings.some((w) => /sem nº de série nem patrimônio/.test(w.message)));
});

test('googleFinalize bloqueia quando falta obrigatório, navega para a etapa e preenche término ao finalizar', async () => {
  const { context, alerts, navigated } = loadAppContext();
  const r = context.blank();
  r.codigoPop = 'POP.001';
  r.nome = 'POP Centro';
  r.inspetor = 'Mateus Cesar';
  r.acesso = 'Liberado';
  r.torrePresenca = 'Não';
  r.cftvPresenca = 'Não';
  // Falta criticidade operacional
  vm.runInContext('records = [__r]; activeId = __r.id; googleSend = async () => true;', Object.assign(context, { __r: r }));

  await context.googleFinalize();
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /criticidade operacional/);
  assert.equal(navigated[0], 'resumo');
  assert.equal(r.finalizedAt, undefined);

  r.classificacao = 'Baixa';
  await context.googleFinalize();
  assert.match(r.fim, /^\d{2}:\d{2}$/);
  assert.ok(r.finalizedAt);
});
