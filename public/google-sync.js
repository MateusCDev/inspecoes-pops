// Chave individual digitada pela equipe: nunca incluir segredos neste arquivo.
let googleAccessKey = '';
let googleSending = false;
const isGoogleMode = () => cfg.mode === 'google';
const googleReady = () => /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(cfg.google?.endpoint || '');
function googlePanel(r) {
  const pending = records.filter(x => x.finalizedAt && x.syncState !== 'sincronizado').length;
  return `<div class="card"><h2>Planilha e relatórios PDF</h2><p>${googleReady() ? 'Envio configurado. Informe sua chave individual para enviar.' : 'Aguardando ativação do serviço Google. Os registros continuam salvos neste navegador.'}</p><p>${esc(r ? syncStatusText(r) : '')} · ${pending} pendente(s)</p>${r ? `<div class="field"><label>Código do POP (igual ao cadastro da planilha)</label><input data-field="codigoPop" value="${esc(r.codigoPop || '')}" placeholder="Ex.: CIS-001"></div>` : ''}<div class="btnrow">${button('googleKey', googleAccessKey ? 'Trocar chave de envio' : 'Informar chave de envio', 'tiny')}${googleAccessKey ? button('googleExit', 'Esquecer chave', 'tiny') : ''}${button('retrySync', 'Enviar pendentes', 'primary tiny')}${r?.googlePdfUrl ? `<a class="btn" target="_blank" rel="noopener" href="${esc(r.googlePdfUrl)}">Abrir PDF no Drive</a>` : ''}</div>${r?.googleError ? `<p role="alert">${esc(r.googleError)}</p>` : ''}<p class="small muted">A chave fica apenas na memória desta página. A confirmação exige que a planilha e o PDF tenham sido gravados.</p></div>`;
}
async function googleSend(r) {
  if (googleSending || !r?.finalizedAt) return;
  if (!googleReady() || !googleAccessKey || !navigator.onLine) {
    r.syncState = 'pendente'; saveAll(); render();
    return false;
  }
  googleSending = true;
  r.syncState = 'enviando'; saveAll(); render();
  try {
    const version = r.updated;
    const snapshot = await portableRecord(r);
    if ((snapshot.photoFiles || []).length !== (snapshot.photos || []).length) throw Error('Uma fotografia não está disponível neste dispositivo. Restaure o backup antes de enviar.');
    for (const key of ['syncState','syncedAt','syncedOrg','googlePdfUrl','googleError']) delete snapshot[key];
    const body = JSON.stringify({version: 1, token: googleAccessKey, record: snapshot});
    if (new Blob([body]).size > 15 * 1024 * 1024) throw Error('A inspeção excede 15 MB. Reduza as fotografias antes de enviar.');
    // text/plain evita preflight; nunca usar no-cors, pois esconderia a confirmação.
    const response = await fetch(cfg.google.endpoint, {method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=UTF-8'}, body});
    if (!response.ok) throw Error('Serviço Google indisponível. Tente novamente.');
    const result = await response.json();
    if (!result.ok || result.inspectionId !== r.id || !/^https:\/\/drive\.google\.com\//.test(result.pdfUrl || '')) throw Error(result.error || 'O serviço não confirmou a gravação completa.');
    r.googlePdfUrl = result.pdfUrl;
    r.syncedAt = result.receivedAt;
    r.syncState = r.updated === version ? 'sincronizado' : 'pendente';
    r.googleError = '';
    saveAll(); render();
    return true;
  } catch (error) {
    r.syncState = 'erro'; r.googleError = error.message; saveAll(); render();
    alert('Envio pendente: ' + error.message);
    return false;
  } finally { googleSending = false; }
}
async function googleSendPending() {
  if (googleSending) return;
  if (!googleReady()) return alert('O serviço Google ainda precisa ser ativado.');
  if (!googleAccessKey) return alert('Informe sua chave individual de envio no painel.');
  if (!navigator.onLine) return alert('Sem conexão. Os dados continuam neste dispositivo.');
  for (const r of records.filter(x => x.finalizedAt && x.syncState !== 'sincronizado')) {
    if (!await googleSend(r)) break;
  }
}
async function googleFinalize() {
  if (googleSending) return;
  const r = cur();
  if (!r?.nome?.trim() || !r.inspetor?.trim() || !r.data) return alert('Informe estação, Técnico 01 e data.');
  if (![30,90,180].includes(Number(r.schedulePeriod))) return alert('Escolha a próxima inspeção: 30, 90 ou 180 dias.');
  if (!confirm('Finalizar esta inspeção e enviar os dados à planilha e o PDF ao Drive? Sem conexão, o envio ficará pendente.')) return;
  r.finalizedAt = new Date().toISOString();
  r.scheduleBaseDate = localToday(); r.scheduleDueDate = deriveSchedule(r);
  r.syncState = 'pendente'; r.updated = new Date().toISOString();
  if (!saveAll()) return;
  render();
  const sent = await googleSend(r);
  alert(sent ? (r.syncState === 'sincronizado' ? 'Dados e PDF confirmados no Google.' : 'Versão enviada. Há alterações mais recentes pendentes.') : 'Inspeção salva neste dispositivo. Confira o painel de envio para reenviar.');
}
document.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'googleKey') {
    const value = prompt('Informe sua chave individual fornecida pelo responsável. Não use sua senha Google.');
    if (value?.trim()) {googleAccessKey = value.trim(); render(); googleSendPending();}
  }
  if (action === 'googleExit') {googleAccessKey = ''; render();}
});
window.addEventListener('online', () => {if (isGoogleMode() && googleAccessKey) googleSendPending();});
