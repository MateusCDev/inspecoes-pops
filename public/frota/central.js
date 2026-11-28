'use strict';

let fleetKey = '';
let fleetUser = null;
let fleetRevision = 0;
let fleetCommitted = fresh();
let fleetSaving = false;
let fleetConflict = false;
const fleetFields = ['vehicles','drivers','inspections','issues','handovers','settings','version'];
const fleetLimit = 12 * 1024 * 1024;
const fleetMedia = value => typeof value === 'string' &&
  /^data:image\/(?:png|jpeg|gif|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value) ? value : '';

async function fleetRpc(action, data, key = fleetKey) {
  const endpoint = window.VOANET_SYNC_CONFIG?.fleet?.endpoint;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint || '')) {
    throw Error('Serviço Google da Frota não configurado.');
  }
  const body = JSON.stringify({version:1,action,token:key,...data});
  if (new Blob([body]).size > fleetLimit) throw Error('O acervo excede o limite de 12 MB desta integração.');
  const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body});
  if (!response.ok) throw Error('Serviço Google indisponível.');
  const result = await response.json();
  if (!result.ok) {
    const error = Error(result.error || 'Operação não confirmada.');
    error.code = result.code;
    throw error;
  }
  return result;
}

function fleetConnectionView(message, retry = false) {
  $('root').innerHTML = `<main class="portal-module-status">
    <h1>Frota Infra</h1>
    <p role="${retry?'alert':'status'}">${h(message)}</p>
    ${retry?'<button class="btn" type="button" id="fleet-retry">Tentar novamente</button>':''}
  </main>`;
  $('fleet-retry')?.addEventListener('click',fleetConnect);
}

function fleetUse(result) {
  fleetRevision = result.version;
  fleetCommitted = result.state;
  state = structuredClone(fleetCommitted);
  fleetConflict = false;
}

async function fleetConnect() {
  fleetConnectionView('Verificando seu acesso à Frota…');
  try {
    const session = window.parent.VOANET_PORTAL?.fleetSession(window);
    if (!session) throw Error('Abra a aba Frota pelo Portal de Infraestrutura.');
    const {user} = await fleetRpc('session',{},session.key);
    if (user?.role !== 'GESTAO' || user.email !== session.email) {
      throw Error('O serviço da Frota precisa confirmar o mesmo usuário de Gestão.');
    }
    fleetUse(await fleetRpc('fleetLoad',{},session.key));
    fleetUser = user;
    fleetKey = session.key;
    page = 'dashboard';
    render();
    openQRRoute();
  } catch (error) {
    const message = error.code === 'AUTH' ? 'O serviço da Frota recusou a chave da sessão. Confira se as duas implantações usam o mesmo projeto Apps Script.' : error.message;
    fleetConnectionView(message,true);
  }
}

function fleetLogout() {
  if (!fleetSaving) window.parent.VOANET_PORTAL?.fleetLogout(window);
}

async function fleetRefresh() {
  if (fleetSaving) return;
  if (state.inspectionDraft && !confirm('Recarregar e descartar o rascunho desta sessão?')) return;
  fleetSaving = true;
  $('root').inert = true;
  try {
    const result = await fleetRpc('fleetLoad',{});
    clearDraft();
    fleetUse(result);
    render();
    notify('Registros atualizados.');
  } catch (error) {
    notify(error.message);
  } finally {
    fleetSaving = false;
    $('root').inert = false;
  }
}

async function save() {
  if (!fleetUser || fleetSaving || fleetConflict) throw Error('Recarregue a frota antes de gravar.');
  const payload = Object.fromEntries(fleetFields.map(key => [key,state[key]]));
  const draft = state.inspectionDraft;
  fleetSaving = true;
  $('root').inert = true;
  try {
    const result = await fleetRpc('fleetSave',{revision:fleetRevision,state:payload});
    state.audit = result.audit;
    fleetRevision = result.version;
    fleetCommitted = structuredClone({...payload,audit:result.audit});
  } catch (error) {
    fleetConflict = error.code === 'FLEET_CONFLICT';
    state = structuredClone(fleetCommitted);
    if (draft) state.inspectionDraft = draft;
    render();
    notify(error.message);
    throw error;
  } finally {
    fleetSaving = false;
    $('root').inert = false;
  }
}

function settingsScreen() {
  $('main').innerHTML = `<div class="panel"><h2>Dados da Frota</h2>
    <p>Gestor autenticado: ${h(fleetUser.email)}</p>
    <p>Os registros operacionais aparecem na guia Frota. O acervo completo fica no Drive restrito.</p>
    <div class="flex"><button class="btn secondary" onclick="fleetRefresh()">Atualizar da planilha e do Drive</button>
    <button class="btn secondary" onclick="exportData()">Exportar backup JSON</button>
    ${fleetRevision === 0 ? `<label>Importar backup inicial<input type="file" accept="application/json" onchange="importData(event)"></label>` : ''}
    <button class="btn secondary" onclick="fleetLogout()">Sair</button></div></div>
    <div class="panel"><h2>QR Code</h2>${f('qr_base','URL fixa da aplicação (opcional)',state.settings?.qrBase||'','url')}
    <button class="btn" onclick="saveQRBase()">Salvar endereço QR</button></div>`;
}

function auditScreen() {
  $('main').innerHTML = `<div class="panel"><h2>Gravações da Frota</h2>
    <div class="table-wrap"><table><thead><tr><th>Data e hora</th><th>Gestor autenticado</th><th>Revisão</th></tr></thead>
    <tbody>${(state.audit || []).slice().reverse().map(a => `<tr><td>${h(new Date(a.at).toLocaleString('pt-BR'))}</td><td>${h(a.actor)}</td><td>${h(a.id)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

window.addEventListener('message', event => {
  if (event.origin === location.origin && event.data?.type === 'voanet-theme') {
    document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
  }
});
window.addEventListener('storage', event => {
  if (event.key === 'voanet_theme') {
    document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
  }
});
window.addEventListener('unhandledrejection', event => {
  if (event.reason instanceof Error) notify(event.reason.message);
});
if (window.parent !== window) fleetConnect();
