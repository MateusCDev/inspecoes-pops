let googleCapabilities={},googleSummary=null,googleNextCursor=null,googleJobsPolling=false;
// Credenciais individuais de envio, diferentes das senhas Google.
let googleAccessKey='',googleUser=null,googleSending=false,googleSession=0;
let googleCentralItems=[],googleCentralBusy=false,googleCentralUpdated='',googleCentralError='';
let googlePageBusy=false,googlePageError='';
let googleStations=[];
const isGoogleMode=()=>cfg.mode==='google';
const googleReady=()=>/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(cfg.google?.endpoint||'');
function googleAssetText(result){return result?`${result.updated||0} atualização(ões), ${result.created||0} novo(s) ativo(s), ${result.pending||0} pendência(s) de conferência`:'Atualização de ativos não informada por esta versão do serviço.';}
function googleStorageKey(){return googleUser?'voanet_google_records_'+encodeURIComponent(googleUser.email):null;}
function googlePhotoDatabase(){if(!googleUser)throw Error('Entre para acessar as fotos.');return 'voanet_google_photos_'+encodeURIComponent(googleUser.email);}
class GoogleTransportError extends Error {}

async function googleResponse(body,timeout){
  const controller=timeout&&typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
  try{
    let response;
    try{
      response=await fetch(cfg.google.endpoint,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},body,signal:controller?.signal});
    }catch(_){
      throw new GoogleTransportError('A conexão com o serviço de inspeções foi interrompida.');
    }
    if([408,429].includes(response.status)||response.status>=500)throw new GoogleTransportError('O serviço de inspeções está temporariamente indisponível.');
    if(!response.ok)throw Error('Serviço Google indisponível (HTTP '+response.status+').');
    try{
      return await response.json();
    }catch(_){
      throw new GoogleTransportError('A resposta do serviço de inspeções não foi recebida por completo.');
    }
  }finally{
    if(timer!==null)clearTimeout(timer);
  }
}

async function googleRpc(action,data={},key=googleAccessKey,{retry,onRetry,timeout}={}){
  if(!googleReady())throw Error('Aguardando a URL do serviço Google.');
  const body=JSON.stringify({version:1,action,...data,token:key});
  if(new Blob([body]).size>15*1024*1024)throw Error('O envio excede 15 MB. Reduza as fotos.');
  const session=googleSession;
  let result;
  try{
    result=await googleResponse(body,timeout);
  }catch(error){
    if(!retry||!(error instanceof GoogleTransportError)||session!==googleSession||!navigator.onLine)throw error;
    onRetry?.();
    await new Promise(resolve=>setTimeout(resolve,850));
    if(session!==googleSession||!navigator.onLine)throw error;
    result=await googleResponse(body,timeout);
  }
  if(!result?.ok)throw Error(result?.error||'Operação não confirmada.');
  return result;
}

function googleLoginView(){
  const ready=googleReady();
  return `<main class="portal-login"><div class="portal-login-card"><div class="portal-login-body">
    <h1>Portal de Infraestrutura</h1>
    <p>Entre com sua chave individual para acessar as aplicações do seu perfil.</p>
    ${ready?'':'<p role="status">Aguardando a configuração do serviço Google.</p>'}
    <form id="googleAccessLogin">
      <label for="google-key">Chave individual</label>
      <input id="google-key" name="key" type="password" autocomplete="off" required ${ready?'':'disabled'}>
      <button type="submit" class="btn primary" ${ready?'':'disabled'}>Entrar</button>
    </form>
    <p id="google-login-error" class="portal-login-error" role="alert"></p>
  </div></div></main>`;
}
function googleProfilePanel(){
  const manager=googleUser.role==='GESTAO';
  return `<div class="portal-profile">
    <div class="portal-profile-account"><strong>${manager?'Gestão':'Operação'}</strong><span>${esc(googleUser.email)}</span></div>
    ${button('googleExit','Sair','tiny')}
    ${manager&&!googleCapabilities.assetsSync?'<p class="notice">Atualização automática dos ativos ainda não habilitada neste serviço. Atualize o Apps Script.</p>':''}
  </div>`;
}
async function googleLogin(form){
  const key=form.elements.key.value.trim();if(!key)return;
  const submit=form.querySelector('button');submit.disabled=true;const session=++googleSession;
  try{
    const result=await googleRpc('session',{},key);if(session!==googleSession)return;
    if(!result.user?.email||!['GESTAO','OPERACAO'].includes(result.user.role))throw Error('Perfil não confirmado.');
    const catalog=await googleRpc('stations',{},key);if(session!==googleSession)return;
    if(!Array.isArray(catalog.stations))throw Error('Cadastro de POPs indisponível.');
    googleStations=catalog.stations;googleCapabilities=result.capabilities||{};
    googleAccessKey=key;googleUser=result.user;records=loadAll();activeId=null;view='home';photosCache.clear();
    googleCentralItems=[];googleSummary=null;googleNextCursor=null;googleCentralUpdated='';googleCentralError='';render();if(typeof googlePollJobs==='function')googlePollJobs();
    window.VOANET_PORTAL?.refresh();
    googleRefreshCentral();
    if(navigator.onLine&&records.some(r=>r.finalizedAt&&!['sincronizado','processando'].includes(r.syncState)))googleSendPending();
  }catch(error){if(session===googleSession){const node=document.getElementById('google-login-error');if(node)node.textContent=error.message;}}
  finally{form.elements.key.value='';if(submit.isConnected)submit.disabled=false;}
}
function googleLogout(){
  if(typeof closeGoogleAssetIssues==='function')closeGoogleAssetIssues();
  if(typeof googleClearAccessState==='function')googleClearAccessState();
  if(typeof flushLocalSave==='function')flushLocalSave();googleCapabilities={};googleSummary=null;googleNextCursor=null;
  googleSession++;googleAccessKey='';googleUser=null;records=[];activeId=null;view='home';
  googleCentralItems=[];googleStations=[];googleCentralUpdated='';googleCentralError='';googleCentralBusy=false;
  googlePageBusy=false;googlePageError='';googleHistoryQuery='';googleHistoryPendingOnly=false;photosCache.clear();render();
  window.VOANET_PORTAL?.refresh();
}
function googleStation(record){return googleStations.find(s=>s.code===String(record.codigoPop??'').trim()&&!s.duplicate&&!s.inactive);}
function googleStationField(r){return `<div class="field full"><label>POP cadastrado — prazo por criticidade</label><select data-google-station><option value="">Selecione o POP</option>${googleStations.filter(s=>!s.inactive).map(s=>`<option value="${esc(s.code)}" ${r.codigoPop===s.code?'selected':''} ${s.duplicate||!s.days?'disabled':''}>${esc(s.code+' — '+s.name+' · '+s.criticality+(s.duplicate?' — código duplicado':s.days?' · '+s.days+' dias':' — regra não definida'))}</option>`).join('')}</select></div>`;}
function googleScheduleForm(r){
  const station=googleStation(r),due=station?.days?addLocalDays(r.data,station.days):'';
  return `<div class="card"><h2>Próxima inspeção preventiva</h2>${googleStationField(r)}<p>ALTA/CRÍTICA: 45 dias · MÉDIA: 90 dias.</p><p>Contagem em dias corridos a partir da data da vistoria. Recalculada a cada nova inspeção.</p><p><b>Criticidade do POP:</b> ${esc(station?.criticality||'Selecione o POP')} · <b>Prazo:</b> ${station?.days||'—'} dias</p><p><b>Próxima inspeção:</b> ${esc(due?fmt(due):'Informe POP e data da vistoria')}</p><p class="small muted">O servidor confirma o prazo usando o cadastro de POPs. A criticidade operacional da vistoria é registrada separadamente.</p></div>`;
}
function googlePanel(r){
  const pending=records.filter(x=>x.finalizedAt&&!['sincronizado','processando'].includes(x.syncState)).length;
  return `<div class="card"><h2>Planilha e relatórios PDF</h2><p>${esc(r?syncStatusText(r):'')} · ${pending} pendente(s) neste dispositivo</p><div class="btnrow">${button('retrySync','Enviar pendentes','primary tiny')}${button('googleCentral',googleUser.role==='GESTAO'?'Painel central da equipe':'Minhas inspeções enviadas','tiny')}${r?.syncState==='sincronizado'?button('googlePdf:'+r.id,'Baixar PDF','tiny'):''}${button('googleExit','Sair','tiny')}</div>${r?`<p id="google-progress-${esc(r.id)}" role="status">${esc(r.googleProgress||'')}</p>`:''}${r?.googleAssets?`<p>${esc(googleAssetText(r.googleAssets))}</p>${r.googleAssets?.pending?button('googleIssues:'+r.id,'Ver pendências dos ativos','tiny'):''}`:''}${r?.googleError?`<p role="alert">${esc(r.googleError)}</p>`:''}<p class="small muted">Registros locais de ${esc(googleUser.email)}. Confirmação somente após gravar os dados e o PDF.</p></div>`;
}
function googleInspectionSyncCard(r){
  const actions={
    enviando:'<button type="button" class="btn primary" disabled>Enviando…</button>',
    processando:button('googleCheckCurrent','Verificar processamento','primary'),
    sincronizado:button('googlePdf:'+esc(r.id),'Baixar PDF do Drive','primary'),
    pendente:button('googleRetryCurrent','Reenviar esta inspeção','primary'),
    erro:button('googleRetryCurrent','Reenviar esta inspeção','primary')
  };
  return `<div class="card"><h2>Finalização e sincronização</h2>
    <p class="muted small">O registro fica salvo neste navegador. O portal envia as fotos e confirma quando os dados e o PDF estiverem disponíveis.</p>
    <p><b>Estado:</b> ${esc(syncStatusText(r))}</p>
    <p id="google-progress-${esc(r.id)}" class="inspection-sync-message" role="status">${esc(r.googleProgress||'')}</p>
    ${r.googleError?`<p class="inspection-sync-error" role="alert">${esc(r.googleError)}</p>`:''}
    <div class="btnrow">${r.finalizedAt?(actions[r.syncState]||actions.pendente):button('finalize','✓ Finalizar e sincronizar','primary')}
    ${r.googleAssets?.pending?button('googleIssues:'+esc(r.id),'Ver pendências dos ativos','tiny'):''}</div></div>`;
}

function googleInspectionSendFailure(record,error){
  record.syncState=error instanceof GoogleTransportError?'pendente':'erro';
  const unfinished=record.googleProgress?.match(/foto (\d+ de \d+)/i);
  const detail=unfinished?' O envio parou na foto '+unfinished[1]+'.':'';
  record.googleError=(error.message||'Falha ao enviar a inspeção.')+detail+
    ' A inspeção está salva neste dispositivo. Use Reenviar esta inspeção.';
  delete record.googleProgress;
  saveAll();
  render();
}

function googleInspectionOffline(record){
  googleInspectionSendFailure(record,new GoogleTransportError('Sem conexão com a internet.'));
  return false;
}

function googleInspectionSnapshot(record){
  const snapshot=JSON.parse(JSON.stringify(record));
  for(const key of ['syncState','syncedAt','syncedOrg','googlePdfUrl','googleError','ownerEmail',
    'googlePhotoRefs','googleProgress','googleJobHash','googleSubmittedVersion','googleAssets']) delete snapshot[key];
  snapshot.photoFiles=[];
  return snapshot;
}

async function googlePreparePhotoFiles(record,snapshot,session){
  const photos=snapshot.photos||[];
  if(photos.length>inspectionPhotoLimit)throw Error('A inspeção aceita até '+inspectionPhotoLimit+' fotos.');
  const progress=text=>{if(typeof googleProgress==='function')googleProgress(record,text);};
  const files=[];
  if(photos.length)progress('Verificando tamanho das fotos…');
  for(const photo of photos){
    if(session!==googleSession)return null;
    const label=photo.name||photo.id;
    let stored;
    try{
      stored=await getPhoto(photo.id);
    }catch(_){
      throw Error('O navegador não conseguiu ler a foto '+label+' neste dispositivo. Reabra a inspeção e confira a foto na galeria.');
    }
    if(session!==googleSession)return null;
    if(!stored?.blob)throw Error('Foto indisponível neste dispositivo: '+label+'. Restaure o backup ou anexe a imagem novamente.');
    files.push({photo,blob:stored.blob});
  }
  // Folga para a codificação Base64, identificadores, assinaturas e campos da requisição.
  const metadataBytes=new Blob([JSON.stringify(snapshot)]).size;
  const available=Math.floor((14*1024*1024-metadataBytes-256*files.length)*3/4);
  if(available<=0)throw Error('Os dados da inspeção excedem o tamanho disponível para o envio.');
  const limit=inspectionPhotoBudget(files.map(file=>file.blob),available);
  for(const [index,file] of files.entries()){
    if(session!==googleSession)return null;
    if(inspectionPhotoTypes.has(file.blob.type)&&file.blob.size<=limit)continue;
    progress('Otimizando foto '+(index+1)+' de '+files.length+' para o envio…');
    try{
      file.blob=await compressImage(file.blob,Math.min(limit,160*1024));
    }catch(error){
      throw Error('Não foi possível otimizar a foto '+(file.photo.name||file.photo.id)+'. '+error.message);
    }
  }
  return session===googleSession?files:null;
}

async function googlePhotoData(photo,blob){
  try{
    return await fileToDataUrl(blob);
  }catch(_){
    throw Error('O navegador não conseguiu preparar a foto '+(photo.name||photo.id)+'. Abra a galeria para conferir a imagem.');
  }
}

async function googleSend(r){
  if(inspectionPhotoBatches.has(r)){alert('Aguarde o término da otimização das fotos antes de enviar.');return false;}
  if(googleCapabilities.stagedPhotos&&typeof googleSendV2==='function')return googleSendV2(r);
  if(googleSending||!r?.finalizedAt)return false;
  if(!googleReady()||!googleUser||!googleAccessKey)return false;
  if(!navigator.onLine)return googleInspectionOffline(r);
  googleSending=true;const session=googleSession;r.syncState='enviando';r.googleError='';r.googleProgress='Preparando o envio…';saveAll();render();
  try{
    const version=r.updated,snapshot=googleInspectionSnapshot(r);
    const files=await googlePreparePhotoFiles(r,snapshot,session);
    if(!files||session!==googleSession)return false;
    for(const {photo,blob} of files){
      if(session!==googleSession)return false;
      const data=await googlePhotoData(photo,blob);
      if(session!==googleSession)return false;
      snapshot.photoFiles.push({id:photo.id,data});
    }
    const result=await googleRpc('submit',{record:snapshot});if(session!==googleSession)return false;
    if(result.inspectionId!==r.id||!/^https:\/\/drive\.google\.com\//.test(result.pdfUrl||''))throw Error('Gravação completa não confirmada.');
    if(result.schedule&&r.updated===version){r.schedulePeriod=result.schedule.days;r.scheduleBaseDate=result.schedule.baseDate;r.scheduleDueDate=result.schedule.dueDate;r.popCriticality=result.schedule.criticality;}
    r.syncedAt=result.receivedAt;r.syncState=r.updated===version?'sincronizado':'pendente';r.googleError='';delete r.googleProgress;saveAll();render();return true;
  }catch(error){if(session===googleSession)googleInspectionSendFailure(r,error);return false;}
  finally{googleSending=false;}
}
async function googleSendPending(){
  if(googleSending)return;if(!googleUser)return alert('Entre com sua chave individual.');
  if(!navigator.onLine)return alert('Sem conexão. Os dados continuam neste dispositivo.');
  const session=googleSession;
  for(const r of records.filter(x=>x.finalizedAt&&!['sincronizado','processando'].includes(x.syncState)))if(session!==googleSession||!await googleSend(r))break;
}
async function googleFinalize(){
  if(googleSending||!googleUser)return;const r=cur();
  if(inspectionPhotoBatches.has(r))return alert('Aguarde o término da otimização das fotos antes de finalizar.');
  if(r?.syncState==='processando'){
    if(typeof googlePollJobs==='function')await googlePollJobs(r);
    return;
  }
  if(!r?.nome?.trim()||!r.inspetor?.trim()||!r.data)return alert('Informe estação, Técnico 01 e data.');
  const station=googleStation(r);if(!station?.days)return alert('Selecione um POP cadastrado com criticidade ALTA ou MÉDIA.');
  if(!confirm('Finalizar e enviar a inspeção e o PDF? Sem conexão, o envio ficará pendente.'))return;
  r.nome=station.name;r.popCriticality=station.criticality;r.schedulePeriod=station.days;
  if(!r.finalizedAt){r.finalizedAt=new Date().toISOString();r.updated=r.finalizedAt;}
  r.scheduleBaseDate=r.data;r.scheduleDueDate=addLocalDays(r.data,station.days);r.syncState='pendente';
  if(!saveAll())return;
  await googleSend(r);
}
let googleCentralSection='dashboard';
async function openGoogleCentral(section=googleUser?.role==='GESTAO'?'dashboard':'history'){
  if(!googleUser||!['dashboard','history','schedule','plans'].includes(section))return;
  if(section==='plans'&&googleUser.role!=='GESTAO')return;
  googleCentralSection=section;
  navigate('googleCentral');
  document.getElementById('google-central-title')?.focus({preventScroll:true});
  if(!googleCentralUpdated)await googleRefreshCentral();
}
function googleRenderCentralData(){
  if(!['home','assets','googleCentral'].includes(view))return;
  const focused=document.activeElement;
  const selector=focused?.id?'#'+CSS.escape(focused.id):focused?.dataset?.action
    ? '[data-action="'+CSS.escape(focused.dataset.action)+'"]' : '';
  const selection=focused?.id==='google-history-query'?[focused.selectionStart,focused.selectionEnd]:null;
  render();
  const restored=selector&&document.getElementById('app')?.querySelector(selector);
  if(restored){
    restored.focus({preventScroll:true});
    if(selection)restored.setSelectionRange(...selection);
  }
}
function googleCentralStatus(){
  return googleCentralBusy?'Consultando a planilha central…':googleCentralError
    ? 'Falha na consulta: '+googleCentralError : googleCentralUpdated?'Atualizado em '+googleCentralUpdated:'Aguardando consulta à planilha central';
}

async function googleRefreshCentral(){
  if(googleCapabilities.summary&&typeof googleRefreshSummary==='function')return googleRefreshSummary();
  if(googleCentralBusy||googlePageBusy||!googleUser)return;googleCentralBusy=true;googleCentralError='';const session=googleSession;googleRenderCentralData();
  try{
    const items=[];let cursor;
    do{
      const page=await googleRpc('list',cursor===undefined?{}:{cursor});if(session!==googleSession)return;
      if(!Array.isArray(page.items))throw Error('Resposta de consulta inválida.');items.push(...page.items);
      if(page.nextCursor!==null&&(!Number.isInteger(page.nextCursor)||(cursor!==undefined&&page.nextCursor>=cursor)))throw Error('Paginação inválida.');
      cursor=page.nextCursor;
    }while(cursor!==null);
    googleCentralItems=items;googleCentralUpdated=new Date().toLocaleString('pt-BR');
  }catch(error){if(session===googleSession)googleCentralError=error.message;}
  finally{if(session===googleSession){googleCentralBusy=false;googleRenderCentralData();}}
}
let googleHistoryQuery='',googleHistoryPendingOnly=false;
const googleHistorySearchText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function googleHistoryItems(items){
  const terms=googleHistorySearchText(googleHistoryQuery).trim().split(/\s+/).filter(Boolean);
  return items.filter(item=>{
    if(googleHistoryPendingOnly&&!(item.assets?.pending>0))return false;
    if(!terms.length)return true;
    const values=[item.station,item.stationCode,item.technician,item.owner,item.date,fmt(item.date)];
    const index=googleHistorySearchText(values.join(' '));
    return terms.every(term=>index.includes(term));
  });
}

function googleHistoryCard(item,manager){
  const id=esc(item.id),pending=Number(item.assets?.pending)||0;
  return `<article class="history-record">
    <header class="history-record-title">
      <div><h3>${esc(item.station||'Estação sem nome')}</h3><p>${esc(fmt(item.date))}</p></div>
      ${pending>0?`<span class="history-badge history-badge-pending">${pending} ${pending===1?'pendência de ativos':'pendências de ativos'}</span>`:''}
    </header>
    <dl class="history-record-facts">
      <div><dt>Técnico</dt><dd>${esc(item.technician||'—')}</dd>${item.owner?`<dd class="small muted">${esc(item.owner)}</dd>`:''}</div>
      <div><dt>Criticidade</dt><dd>${esc(item.criticality||'—')}</dd></div>
      <div><dt>Não conformidades</dt><dd>${Number(item.nc)||0}</dd></div>
      <div><dt>Próxima inspeção</dt><dd>${esc(fmt(item.due))}</dd></div>
    </dl>
    <footer class="history-record-actions">
      <div class="btnrow">
        ${pending>0?button('googleIssues:'+id,'Ver pendências','primary tiny'):''}
        ${manager?button('googleSummaryPdf:'+id,'Baixar PDF gerencial (1 página)',pending>0?'tiny':'primary tiny'):''}
        ${manager&&pending>0?button('googleAssets:'+id,'Reprocessar ativos','tiny'):''}
      </div>
      <details class="archived-pdf"><summary>Relatório arquivado</summary><div class="btnrow">
        ${button('googlePdf:'+id,'Baixar arquivo do Drive','tiny')}
        ${manager&&googleCapabilities.reportRefresh?button('googleRefreshReport:'+id,'Gerar novo PDF no Drive','tiny'):''}
      </div></details>
      ${item.assets?`<p class="small muted">${esc(googleAssetText(item.assets))}</p>`:''}
    </footer>
  </article>`;
}

function googleHistoryResults(items,manager){
  const filtered=googleHistoryItems(items);
  const status=googleHistoryQuery.trim()||googleHistoryPendingOnly
    ? `${filtered.length} de ${items.length} registros carregados correspondem aos filtros.`
    : `Exibindo ${items.length} de ${googleSummary?.total??items.length} registros.`;
  return `<p id="history-result-count" role="status" class="small muted">${status}</p>${filtered.length
    ? filtered.map(item=>googleHistoryCard(item,manager)).join('')
    : `<div class="empty"><strong>${googleCentralBusy?'Consultando as inspeções…':
      items.length?'Nenhuma inspeção corresponde aos filtros.':'Nenhuma inspeção recebida nesta consulta.'}</strong></div>`}`;
}

function googleHistoryView(items,manager){
  return `<section class="card history-section">
    <h2>Histórico de inspeções</h2>
    <div class="history-filters">
      <label for="google-history-query">Buscar no histórico<input id="google-history-query" type="search" maxlength="100"
        placeholder="Estação, técnico ou data" value="${esc(googleHistoryQuery)}"></label>
      <label class="history-pending-filter"><input type="checkbox" id="google-history-pending" ${googleHistoryPendingOnly?'checked':''}> Só com pendências de ativos</label>
    </div>
    <div id="google-history-results">${googleHistoryResults(items,manager)}</div>
    ${googleMoreButton()}</section>`;
}

function updateGoogleHistoryFilters(event){
  if(event.target.id==='google-history-query')googleHistoryQuery=event.target.value;
  else if(event.target.id==='google-history-pending')googleHistoryPendingOnly=event.target.checked;
  else return;
  document.getElementById('google-history-results').innerHTML=googleHistoryResults(googleCentralItems,googleUser?.role==='GESTAO');
}
document.addEventListener('input',updateGoogleHistoryFilters);

function googleCentralView(){
  const manager=googleUser.role==='GESTAO',items=googleCentralItems,sum=k=>items.reduce((n,r)=>n+(Number(r[k])||0),0),c=googleSummary?.conform??sum('conform'),nc=googleSummary?.nc??sum('nc');
  const byPOP=Object.create(null);items.forEach(r=>{byPOP[r.station]=(byPOP[r.station]||0)+(Number(r.nc)||0);});
  const ranking=googleSummary?.ranking||Object.entries(byPOP).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,8),max=Math.max(1,...ranking.map(([,n])=>n));
  const latest=new Map();for(const item of googleSummary?.latest||items){const key=String(item.stationCode||'')+'|'+item.station,old=latest.get(key);if(!old||String(item.date)+String(item.updated)>String(old.date)+String(old.updated))latest.set(key,item);}
  const upcoming=[...latest.values()].filter(r=>!googleStations.some(s=>s.inactive&&s.code===String(r.stationCode)&&s.name===r.station)).sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999')));
  const scheduleHTML=()=>`<div class="card"><h2 id="google-schedule-heading" tabindex="-1">Próximas inspeções — última vistoria de cada POP</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>POP</th><th>Última vistoria</th><th>Prazo</th><th>Próxima inspeção</th><th>Situação</th></tr></thead><tbody>${upcoming.map(r=>{const days=daysUntil(r.due),status=days===null?'Sem programação':days<0?'Vencida há '+Math.abs(days)+' dia(s)':days===0?'Vence hoje':'Faltam '+days+' dia(s)';return `<tr><td>${esc(r.station)}</td><td>${esc(fmt(r.date))}</td><td>${Number(r.period)||'—'} dias</td><td>${esc(fmt(r.due))}</td><td>${esc(status)}</td></tr>`;}).join('')||'<tr><td colspan="5">Sem inspeções recebidas.</td></tr>'}</tbody></table></div></div>`;
  const section=googleCentralSection;
  const title={dashboard:manager?'Dashboard Gerencial':'Minhas inspeções enviadas',
    history:manager?'Inspeções Recebidas':'Minhas inspeções enviadas',schedule:'Cronograma de inspeções',plans:'Planos de Ação'}[section];
  const description={dashboard:'Indicadores das inspeções sincronizadas.',history:'Consulte as vistorias recebidas e baixe os relatórios.',
    schedule:'Acompanhe a próxima vistoria prevista para cada POP.',plans:'Consulte as ações registradas nas vistorias enviadas pela equipe.'}[section];
  const sections=manager?[['dashboard','Dashboard'],['history','Inspeções recebidas'],['schedule','Cronograma'],['plans','Planos de Ação']]:
    [['history','Inspeções enviadas'],['schedule','Cronograma']];
  const nav=sections.map(([id,label])=>`<button type="button" class="btn tiny" data-action="centralSection:${id}" ${id===section?'aria-current="page"':''}>${label}</button>`).join('');
  const dashboardHTML=()=>`<div class="grid3"><div class="stat"><strong>${googleSummary?.total??items.length}</strong><span>Inspeções recebidas</span></div><div class="stat"><strong>${nc}</strong><span>Não conformidades registradas</span></div><div class="stat"><strong>${c+nc?(100*c/(c+nc)).toFixed(1)+'%':'—'}</strong><span>Conformidade: C ÷ (C + NC)</span></div></div>${ranking.length?`<div class="card"><h2>Não conformidades acumuladas por POP</h2>${ranking.map(([station,n])=>`<p>${esc(station)} · ${n}</p><div style="height:10px;background:#e5e7eb;margin-bottom:12px"><div style="height:10px;background:#c90018;width:${100*n/max}%"></div></div>`).join('')}</div>`:''}`;
  return `<main class="shell central-shell">${googleProfilePanel()}
    <section class="card central-heading"><div class="card-head"><div><h1 id="google-central-title" tabindex="-1">${title}</h1>
      <p>${description}</p><p class="central-status small muted" role="status">${esc(googleCentralStatus())}</p>
      </div><div class="btnrow">${button('googleRefresh',googleCentralBusy?'Atualizando…':'Atualizar dados','primary tiny')}${button('home','Voltar','tiny')}</div></div>
      <nav class="central-navigation" aria-label="Visões da base central">${nav}</nav>
    </section>
    ${section==='plans'?googleActionPlansView(items):{dashboard:dashboardHTML,history:()=>googleHistoryView(items,manager),schedule:scheduleHTML}[section]()}
  </main>`;
}
let googleReportRequest=null;
async function googleRefreshReport(id,trigger){
  if(googleUser?.role!=='GESTAO'||googleReportRequest===googleSession)return;
  if(!confirm('Gerar o PDF com o layout atual e atualizar o link deste relatório?'))return;
  const session=googleSession;
  googleReportRequest=session;
  trigger.disabled=true;
  trigger.textContent='Gerando PDF…';
  try{
    const result=await googleRpc('refreshReport',{inspectionId:id});
    if(session!==googleSession)return;
    if(result.inspectionId!==id||!result.pdfUrl)throw Error('Atualização do PDF não confirmada.');
    await googleDownloadPdf(id);
  }catch(error){if(session===googleSession)alert(error.message);}
  finally{
    if(googleReportRequest===session)googleReportRequest=null;
    if(trigger.isConnected){trigger.disabled=false;trigger.textContent='Gerar novo PDF no Drive';}
  }
}
async function googleDownloadPdf(id){
  const session=googleSession;
  try{
    const result=await googleRpc('pdf',{inspectionId:id});if(session!==googleSession)return;
    if(typeof result.base64!=='string')throw Error('PDF indisponível.');
    let name=String(result.fileName||id+'.pdf');
    if(name===id+'.pdf'){
      const item=googleCentralItems.find(entry=>entry.id===id);
      const local=records.find(entry=>entry.id===id);
      const station=String(item?.station||local?.nome||'').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
      const date=fmt(item?.date||local?.data).replaceAll('/','-');
      if(station)name=station+(/^\d{2}-\d{2}-\d{4}$/.test(date)?' - '+date:'')+'.pdf';
    }
    const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
    download(new Blob([bytes],{type:'application/pdf'}),name,'application/pdf');
  }catch(error){if(session===googleSession)alert(error.message);}
}
document.addEventListener('submit',e=>{if(e.target.id==='googleAccessLogin'){e.preventDefault();googleLogin(e.target);}});
document.addEventListener('click',e=>{
  const trigger=e.target.closest('[data-action]'),action=trigger?.dataset.action;
  if(action==='googleExit')return googleLogout();if(!googleUser)return;
  if(action==='googleCentral')openGoogleCentral();
  if(action==='googleRefresh')googleRefreshCentral();
  if(action==='googleRetryCurrent'){
    const record=cur();
    if(record?.finalizedAt&&['pendente','erro'].includes(record.syncState))googleSend(record);
  }
  if(action==='googleCheckCurrent'){
    const record=cur();
    if(record?.syncState==='processando')googlePollJobs(record);
  }
  if(action?.startsWith('centralSection:'))openGoogleCentral(action.slice('centralSection:'.length));
  if(action?.startsWith('googleSummaryPdf:'))googleDownloadSummary(action.slice('googleSummaryPdf:'.length),trigger);
  if(action?.startsWith('googlePdf:'))googleDownloadPdf(action.slice(10));
  if(action?.startsWith('googleRefreshReport:'))googleRefreshReport(action.slice('googleRefreshReport:'.length),trigger);
});
window.addEventListener('online',()=>{if(isGoogleMode()&&googleUser)googleSendPending();});
if(typeof window.setInterval==='function')window.setInterval(()=>{
  if(isGoogleMode()&&googleUser&&view==='googleCentral'&&['dashboard','schedule'].includes(googleCentralSection)
    &&googleCentralItems.length<=50&&!document.getElementById('app')?.hidden
    &&navigator.onLine&&document.visibilityState==='visible')googleRefreshCentral();
},60000);

document.addEventListener('change',e=>{
  if(e.target.dataset.googleStation!==undefined&&googleUser){
    const r=cur(),station=googleStations.find(s=>s.code===e.target.value&&!s.duplicate&&!s.inactive);if(!r)return;
    r.codigoPop=station?.code||'';r.nome=station?.name||r.nome;r.popCriticality=station?.criticality||'';
    r.schedulePeriod=station?.days||'';r.scheduleBaseDate=r.data;r.scheduleDueDate=station?.days?addLocalDays(r.data,station.days):'';change();render();
  }
});
