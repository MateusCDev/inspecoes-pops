// A planilha compartilhada recebe apenas a visão operacional. O acervo e a
// auditoria autenticada ficam no Drive, em uma pasta dedicada e restrita.
const FLEET_SHEET = 'Frota';
const FLEET_HEADERS = ['Tipo de registro','ID do registro','ID do veículo','Placa','Descrição','Data','Status'];
const FLEET_COLLECTIONS = ['vehicles','drivers','inspections','issues','handovers'];
const FLEET_LIMIT = 12 * 1024 * 1024;

function fleetSheet_() {
  const sheet = book_(config_().SPREADSHEET_ID).getSheetByName(FLEET_SHEET);
  if (!sheet || JSON.stringify(sheet.getRange(1,1,1,FLEET_HEADERS.length).getDisplayValues()[0]) !== JSON.stringify(FLEET_HEADERS)) {
    throw Error('A guia Frota precisa ter os cabeçalhos previstos.');
  }
  return sheet;
}

function fleetFolder_() {
  const id = privateValue_('FLEET_FOLDER_ID');
  if (!id) throw Error('A Frota aguarda configuração no Apps Script.');
  const folder = DriveApp.getFolderById(id);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw Error('A pasta da Frota precisa ter acesso geral Restrito.');
  return folder;
}

function setupFleet() {
  return withWriteLock_(() => {
    fleetSheet_();
    if (!privateValue_('FLEET_FOLDER_ID')) {
      const folder = DriveApp.createFolder('Frota Infra — arquivo restrito');
      setPrivate_('FLEET_FOLDER_ID',folder.getId());
    }
    fleetFolder_();
  });
}

function fleetHead_() {
  return JSON.parse(privateValue_('FLEET_HEAD') || 'null');
}

function fleetState_(head) {
  return head ? readJsonFile_(head.file) : {
    vehicles:[], drivers:[], inspections:[], issues:[], handovers:[], settings:{weeklyDay:1}, version:4, audit:[]
  };
}

function fleetDay_(value) {
  const date = typeof value === 'string' ? value.slice(0,10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : '';
}

function fleetId_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

function fleetValidate_(state) {
  if (!state || state.version !== 4 || !state.settings || Array.isArray(state.settings) || typeof state.settings !== 'object') throw Error('Formato de frota inválido.');
  for (const key of FLEET_COLLECTIONS) {
    if (!Array.isArray(state[key])) throw Error('Coleção da frota inválida.');
    const ids = new Set();
    for (const entry of state[key]) {
      if (!fleetId_(entry?.id) || ids.has(entry.id)) throw Error('ID de frota inválido ou duplicado.');
      ids.add(entry.id);
    }
  }
  if (typeof state.settings.qrBase !== 'undefined' &&
      (typeof state.settings.qrBase !== 'string' || state.settings.qrBase.length > 1024 ||
      (state.settings.qrBase && !/^https?:\/\/[^\s@]+$/i.test(state.settings.qrBase)))) throw Error('Endereço QR inválido.');
  if (state.drivers.some(driver => typeof driver.name !== 'string' || !driver.name.trim())) throw Error('Cadastro de condutor inválido.');
  if (state.inspections.some(record => !Array.isArray(record.answers) || record.answers.some(answer => !answer || typeof answer.k !== 'string'))) {
    throw Error('Respostas do checklist inválidas.');
  }
  const vehicles = new Set(state.vehicles.map(v => v.id));
  const drivers = new Set(state.drivers.map(d => d.id));
  for (const vehicle of state.vehicles) {
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(vehicle.plate || '') ||
        typeof vehicle.model !== 'string' || !vehicle.model.trim() ||
        !['Em utilização','Disponível','Indisponível','Aguardando recebimento'].includes(vehicle.status) ||
        (vehicle.driverId && !drivers.has(vehicle.driverId))) throw Error('Cadastro de veículo inválido.');
  }
  if (new Set(state.vehicles.map(v => v.plate)).size !== state.vehicles.length) throw Error('Placa duplicada.');
  for (const key of ['inspections','issues','handovers']) {
    if (state[key].some(record => !vehicles.has(record.vehicleId) || !fleetDay_(record.date))) throw Error('Registro sem veículo ou data válida.');
  }
  const checkValue = (value, depth) => {
    if (depth > 14) throw Error('Estrutura da frota inválida.');
    if (typeof value === 'string' && /^data:/i.test(value) &&
        !/^data:(?:application\/pdf|image\/(?:png|jpeg|gif|webp));base64,[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
      throw Error('Formato de anexo inválido.');
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__','constructor','prototype'].includes(key)) throw Error('Propriedade inválida.');
        checkValue(child, depth + 1);
      }
    }
  };
  checkValue(state, 0);
}

function fleetRows_(state) {
  const plates = new Map(state.vehicles.map(v => [v.id,v.plate]));
  return [
    ...state.vehicles.map(v => ['Veículo',v.id,v.id,v.plate,'Cadastro de veículo','',v.status]),
    ...state.inspections.map(r => ['Checklist',r.id,r.vehicleId,plates.get(r.vehicleId),'Inspeção veicular',fleetDay_(r.date),'Registrada']),
    ...state.issues.map(r => ['Avaria',r.id,r.vehicleId,plates.get(r.vehicleId),'Avaria veicular',fleetDay_(r.date),r.status === 'Resolvida' ? 'Resolvida' : 'Em aberto']),
    ...state.handovers.map(r => ['Devolução',r.id,r.vehicleId,plates.get(r.vehicleId),'Movimentação de veículo',fleetDay_(r.date),r.confirmed ? 'Confirmada' : 'Pendente'])
  ].map(row => row.map(text_));
}

function fleetWriteRows_(sheet, state) {
  const rows = fleetRows_(state);
  const count = Math.max(rows.length,sheet.getLastRow()-1);
  if (!count) return;
  if (count + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),count + 1 - sheet.getMaxRows());
  while (rows.length < count) rows.push(Array(FLEET_HEADERS.length).fill(''));
  sheet.getRange(2,1,count,FLEET_HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();
}

function fleetComplete_(sheet, next, state) {
  fleetWriteRows_(sheet,state);
  setPrivate_('FLEET_HEAD',JSON.stringify(next));
  deletePrivate_('FLEET_PENDING');
  if (next.previous && next.previous !== next.file) {
    try { DriveApp.getFileById(next.previous).setTrashed(true); } catch (_) { /* O acervo atual já foi confirmado. */ }
  }
}

function fleetRequest_(input,user) {
  if (user.role !== 'GESTAO') throw Error('A Frota está disponível para o perfil Gestão nesta implantação.');
  if (input.action === 'fleetLoad') {
    fleetFolder_();
    fleetSheet_();
    const head = fleetHead_();
    return {ok:true,version:head?.version || 0,state:fleetState_(head)};
  }
  return withWriteLock_(() => {
    // Revalida a chave dentro do bloqueio, inclusive após reemissão ou revogação.
    const actor = authenticate_(input);
    if (!actor || actor.role !== 'GESTAO') throw Error('Acesso à Frota revogado.');
    const folder = fleetFolder_(), sheet = fleetSheet_();
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw Error('Versão da frota inválida.');
    fleetValidate_(input.state);
    const serialized = JSON.stringify(input.state);
    if (serialized.length > FLEET_LIMIT) throw Error('O acervo excede o limite de 12 MB desta integração.');
    const hash = hash_(serialized);
    const pending = JSON.parse(privateValue_('FLEET_PENDING') || 'null');
    if (pending) fleetComplete_(sheet,pending,fleetState_(pending));
    const head = fleetHead_(), version = head?.version || 0;
    if (head?.hash === hash) return {ok:true,version,audit:fleetState_(head).audit};
    if (input.revision !== version) return {ok:false,code:'FLEET_CONFLICT',error:'A frota foi atualizada em outra sessão. Recarregue os registros e refaça a alteração.'};

    const current = fleetState_(head);
    const nextState = Object.fromEntries(FLEET_COLLECTIONS.map(key => [key,input.state[key]]));
    nextState.version = 4;
    nextState.settings = {weeklyDay:1,qrBase:input.state.settings.qrBase || ''};
    nextState.audit = (current.audit || []).concat([{
      at:new Date().toISOString(),actor:actor.email,action:'Gravação',entity:'Frota',id:String(version + 1),fields:[]
    }]).slice(-500);
    const blob = Utilities.newBlob(JSON.stringify(nextState),'application/json','frota-' + Utilities.getUuid() + '.json');
    if (blob.getBytes().length > FLEET_LIMIT) throw Error('O acervo excede o limite de 12 MB desta integração.');
    const file = folder.createFile(blob);
    const next = {version:version + 1,hash,file:file.getId(),previous:head?.file || ''};
    setPrivate_('FLEET_PENDING',JSON.stringify(next));
    fleetComplete_(sheet,next,nextState);
    return {ok:true,version:next.version,audit:nextState.audit};
  });
}
