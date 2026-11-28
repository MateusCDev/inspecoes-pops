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
      <div class="login-key-wrap">
        <input id="google-key" name="key" type="password" autocomplete="off" placeholder="Cole sua chave recebida da Gestão" required ${ready?'':'disabled'}>
        <button type="button" class="btn tiny login-key-toggle" data-toggle-login-key aria-label="Mostrar ou ocultar chave" aria-pressed="false">Mostrar</button>
      </div>
      <button type="submit" class="btn primary" ${ready?'':'disabled'}>Entrar no portal</button>
    </form>
    <p id="google-login-error" class="portal-login-error" role="alert"></p>
    <details class="login-help-box">
      <summary>Primeiro acesso? Como funciona a chave e os perfis</summary>
      <ul>
        <li><strong>Chave individual:</strong> cada colaborador recebe uma chave única da Gestão (não é sua senha Google).</li>
        <li><strong>Perfil Operação:</strong> registra inspeções em campo (funciona offline), acompanha seus envios e usa o Fibra Import.</li>
        <li><strong>Perfil Gestão:</strong> acessa Central com SLA, Dashboard de Ativos, pendências, Frota, FTTx e emissão/revogação de chaves.</li>
        <li><strong>Perdeu a chave?</strong> Solicite a reemissão à Gestão — a chave antiga é revogada automaticamente.</li>
      </ul>
    </details>
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
    const result=await googleRpc('session',{includeStations:true},key);if(session!==googleSession)return;
    if(!result.user?.email||!['GESTAO','OPERACAO'].includes(result.user.role))throw Error('Perfil não confirmado.');
    const stations=Array.isArray(result.stations)?result.stations:(await googleRpc('stations',{},key)).stations;if(session!==googleSession)return;
    if(!Array.isArray(stations))throw Error('Cadastro de POPs indisponível.');
    googleStations=stations;googleCapabilities=result.capabilities||{};
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
  if(typeof flushLocalSave==='function')flushLocalSave();
  if(typeof closePhotoDB==='function')closePhotoDB();
  if(googleHistoryFilterTimer!==null){clearTimeout(googleHistoryFilterTimer);googleHistoryFilterTimer=null;}
  googleCapabilities={};googleSummary=null;googleNextCursor=null;
  googleSession++;googleAccessKey='';googleUser=null;records=[];activeId=null;view='home';
  googleCentralItems=[];googleStations=[];googleCentralUpdated='';googleCentralError='';googleCentralBusy=false;
  googlePageBusy=false;googlePageError='';googleStationOptics=null;googleHistoryQuery='';googleHistoryPendingOnly=false;photosCache.clear();render();
  window.VOANET_PORTAL?.refresh();
}
function isSwapStation(station){return Boolean(station?.swap||/\bSWAP\b/i.test(String(station?.name||'')+' '+String(station?.code||'')));}
function googleStation(record){return googleStations.find(s=>s.code===String(record.codigoPop??'').trim()&&!s.duplicate&&!s.inactive&&!isSwapStation(s));}
function googleStationField(r){return `<div class="field full"><label>POP cadastrado — prazo por criticidade<span class="req-mark" aria-hidden="true">*</span></label><select data-google-station required><option value="">Selecione o POP</option>${googleStations.filter(s=>!s.inactive&&!isSwapStation(s)).map(s=>`<option value="${esc(s.code)}" ${r.codigoPop===s.code?'selected':''} ${s.duplicate||!s.days?'disabled':''}>${esc(s.code+' — '+s.name+' · '+s.criticality+(s.duplicate?' — código duplicado':s.days?' · '+s.days+' dias':' — regra não definida'))}</option>`).join('')}</select><small class="muted">Apenas POPs elegíveis para vistoria (POPs SWAP ficam fora do escopo).</small></div>`;}
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
  if(typeof inspectionValidation==='function'){
    const check=inspectionValidation(r);
    if(check.errors.length){
      alert('Preencha os itens obrigatórios antes de finalizar:\n• '+check.errors.map(item=>item.message).join('\n• '));
      if(typeof navigate==='function'&&check.errors[0].step)navigate(check.errors[0].step);
      return;
    }
  } else if(!r?.nome?.trim()||!r.inspetor?.trim()||!r.data){
    return alert('Informe estação, Técnico 01 e data.');
  }
  const station=googleStation(r);if(!station?.days)return alert('Selecione um POP cadastrado com criticidade ALTA ou MÉDIA.');
  if(!confirm('Finalizar e enviar a inspeção e o PDF? Sem conexão, o envio ficará pendente.'))return;
  if(!String(r.fim||'').trim()&&typeof localTimeNow==='function')r.fim=localTimeNow();
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
  window.VOANET_PORTAL?.updateOverview?.();
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

function googleHistoryTrend(item,items){
  const key=String(item.stationCode||item.station||'').trim().toUpperCase();
  if(!key)return null;
  const currentStamp=String(item.date||'')+'|'+String(item.updated||'');
  let prev=null,prevStamp='';
  for(const other of items||[]){
    if(other.id===item.id)continue;
    const otherKey=String(other.stationCode||other.station||'').trim().toUpperCase();
    if(otherKey!==key)continue;
    const stamp=String(other.date||'')+'|'+String(other.updated||'');
    if(stamp<currentStamp&&stamp>prevStamp){prev=other;prevStamp=stamp;}
  }
  if(!prev)return null;
  const delta=(Number(item.nc)||0)-(Number(prev.nc)||0);
  if(delta<0)return {cls:'down',label:`↓ ${delta} NC`};
  if(delta>0)return {cls:'up',label:`↑ +${delta} NC`};
  return {cls:'same',label:'= Estável'};
}

function googleHistoryCard(item,manager,allItems){
  const id=esc(item.id),pending=Number(item.assets?.pending)||0;
  const trend=googleHistoryTrend(item,allItems);
  return `<article class="history-record">
    <header class="history-record-title">
      <div><h3>${esc(item.station||'Estação sem nome')}</h3><p>${esc(fmt(item.date))}</p></div>
      ${pending>0?`<span class="history-badge history-badge-pending">${pending} ${pending===1?'pendência de ativos':'pendências de ativos'}</span>`:''}
    </header>
    <dl class="history-record-facts">
      <div><dt>Técnico</dt><dd>${esc(item.technician||'—')}</dd>${item.owner?`<dd class="small muted">${esc(item.owner)}</dd>`:''}</div>
      <div><dt>Criticidade</dt><dd>${esc(item.criticality||'—')}</dd></div>
      <div><dt>Não conformidades</dt><dd>${Number(item.nc)||0}${trend?` <span class="history-trend history-trend-${trend.cls}">${esc(trend.label)}</span>`:''}</dd></div>
      <div><dt>Próxima inspeção</dt><dd>${esc(fmt(item.due))}</dd></div>
    </dl>
    <footer class="history-record-actions">
      <div class="btnrow">
        ${pending>0?button('googleIssues:'+id,'Ver pendências','primary tiny'):''}
        ${manager?button('googleSummaryPdf:'+id,'Baixar PDF gerencial (1 página)',pending>0?'tiny':'primary tiny'):''}
        ${pending>0?button('googleAssets:'+id,'Reprocessar ativos','tiny'):''}
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
    ? filtered.map(item=>googleHistoryCard(item,manager,items)).join('')
    : `<div class="empty"><strong>${googleCentralBusy?'Consultando as inspeções…':
      items.length?'Nenhuma inspeção corresponde aos filtros.':'Nenhuma inspeção recebida nesta consulta.'}</strong></div>`}`;
}

function googleHistoryView(items,manager){
  return `<section class="card history-section">
    <header class="inspection-section-head"><h2>Histórico de inspeções</h2></header>
    <div class="history-filters">
      <label for="google-history-query">Buscar no histórico<input id="google-history-query" type="search" maxlength="100"
        placeholder="Estação, técnico ou data" value="${esc(googleHistoryQuery)}"></label>
      <label class="history-pending-filter"><input type="checkbox" id="google-history-pending" ${googleHistoryPendingOnly?'checked':''}> Só com pendências de ativos</label>
    </div>
    <div id="google-history-results">${googleHistoryResults(items,manager)}</div>
    ${googleMoreButton()}</section>`;
}

let googleHistoryFilterTimer=null;
function renderGoogleHistoryResultsNow(){
  const container=document.getElementById('google-history-results');
  if(container)container.innerHTML=googleHistoryResults(googleCentralItems,googleUser?.role==='GESTAO');
}
function updateGoogleHistoryFilters(event){
  if(event.target.id==='google-history-query'){
    googleHistoryQuery=event.target.value;
    if(googleHistoryFilterTimer!==null)clearTimeout(googleHistoryFilterTimer);
    googleHistoryFilterTimer=setTimeout(()=>{googleHistoryFilterTimer=null;renderGoogleHistoryResultsNow();},120);
    return;
  }
  if(event.target.id==='google-history-pending'){
    googleHistoryPendingOnly=event.target.checked;
    if(googleHistoryFilterTimer!==null){clearTimeout(googleHistoryFilterTimer);googleHistoryFilterTimer=null;}
    renderGoogleHistoryResultsNow();
  }
}
document.addEventListener('input',updateGoogleHistoryFilters);

const googleNumberFormat=new Intl.NumberFormat('pt-BR');
function googleUpcomingInspections(items){
  const latest=new Map();
  for(const item of googleSummary?.latest||items){
    const key=String(item.stationCode||'')+'|'+item.station;
    const previous=latest.get(key);
    if(!previous||String(item.date)+String(item.updated)>String(previous.date)+String(previous.updated))latest.set(key,item);
  }
  const inactive=new Set(googleStations.filter(station=>station.inactive||isSwapStation(station)).map(station=>String(station.code)+'|'+station.name));
  return [...latest.values()]
    .filter(item=>!inactive.has(String(item.stationCode)+'|'+item.station)&&!/\bSWAP\b/i.test(String(item.station||'')+' '+String(item.stationCode||'')))
    .sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999')));
}

function googleScheduleLabel(due){
  const days=daysUntil(due);
  if(days===null)return {className:'neutral',label:'Sem programação'};
  if(days<0){
    const elapsed=Math.abs(days);
    return {className:'overdue',label:`Vencida há ${elapsed} ${elapsed===1?'dia':'dias'}`};
  }
  if(days===0)return {className:'soon',label:'Vence hoje'};
  return {className:days<=7?'soon':'current',label:days===1?'Vence amanhã':`Faltam ${days} dias`};
}

function googleScheduleBadge(due){
  const {className,label}=googleScheduleLabel(due);
  return `<span class="inspection-due inspection-due-${className}">${esc(label)}</span>`;
}

function googleCentralSchedule(items){
  const upcoming=googleUpcomingInspections(items);
  return `<section class="card inspection-schedule">
    <header class="inspection-section-head"><h2 id="google-schedule-heading" tabindex="-1">Próximas inspeções por POP</h2>
      <p class="muted">Prazos calculados a partir da última vistoria de cada estação.</p>
    </header>
    ${upcoming.length?`<ol class="inspection-schedule-list">${upcoming.map(item=>`<li class="inspection-schedule-row">
      <div class="inspection-schedule-station"><h3>${esc(item.station||'Estação sem nome')}</h3>
        ${item.stationCode?`<span>${esc(item.stationCode)}</span>`:''}</div>
      <dl>
        <div><dt>Última vistoria</dt><dd>${esc(fmt(item.date))}</dd></div>
        <div><dt>Próxima inspeção</dt><dd>${esc(fmt(item.due))}</dd></div>
        <div><dt>Periodicidade</dt><dd>${Number(item.period)>0?Number(item.period)+' dias':'—'}</dd></div>
      </dl>
      ${googleScheduleBadge(item.due)}
    </li>`).join('')}</ol>`:'<p class="inspection-empty">Sem inspeções recebidas.</p>'}
  </section>`;
}

function googleCentralDashboard(items){
  const number=googleNumberFormat;
  const sum=key=>items.reduce((total,item)=>total+(Number(item[key])||0),0);
  const conform=Number(googleSummary?.conform??sum('conform'))||0;
  const nonconform=Number(googleSummary?.nc??sum('nc'))||0;
  const loaded=Boolean(googleSummary||googleCentralUpdated||items.length);
  const total=Number(googleSummary?.total??items.length)||0;
  const percent=conform+nonconform?100*conform/(conform+nonconform):null;
  const percentText=percent===null?'—':percent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  const byPOP=new Map();
  for(const item of items){
    const station=item.station||'Estação sem nome';
    byPOP.set(station,(byPOP.get(station)||0)+(Number(item.nc)||0));
  }
  const ranking=(googleSummary?.ranking||[...byPOP].sort((a,b)=>b[1]-a[1]))
    .filter(([,count])=>Number(count)>0).slice(0,8);
  const ceiling=Math.max(1,...ranking.map(([,count])=>Number(count)));
  const scheduled=googleUpcomingInspections(items).filter(item=>item.due).slice(0,4);
  return `<div class="inspection-kpis">
    <article class="inspection-kpi"><h2>Inspeções recebidas</h2>
      <strong>${loaded?number.format(total):'—'}</strong>
      ${button('centralSection:history','Consultar histórico','tiny')}</article>
    <article class="inspection-kpi inspection-kpi-attention"><h2>Não conformidades</h2>
      <strong>${loaded?number.format(nonconform):'—'}</strong>
      ${button('centralSection:plans','Ver planos de ação','tiny')}</article>
    <article class="inspection-kpi inspection-kpi-rate"><h2>Taxa de conformidade</h2><strong>${percentText}</strong>
      ${percent===null?'':`<meter min="0" max="100" value="${percent}" aria-label="Taxa de conformidade"></meter>`}
      <p>Itens conformes entre os itens avaliados.</p></article>
    </div>
    <div class="inspection-overview-grid">
      <section class="card inspection-overview-panel"><header class="inspection-section-head"><h2>Não conformidades por POP</h2></header>
      ${ranking.length?`<ul class="inspection-ranking">${ranking.map(([station,count])=>`<li>
        <div><span>${esc(station)}</span><strong>${number.format(count)}</strong></div>
        <progress aria-label="${esc(station)}" max="${ceiling}" value="${Number(count)}"></progress>
      </li>`).join('')}</ul>`:`<p class="inspection-empty">${loaded?'Sem não conformidades no ranking.':'Aguardando os registros da base central.'}</p>`}
      </section>
      <section class="card inspection-overview-panel"><header class="inspection-section-head"><h2>Agenda de vistorias</h2>
        ${button('centralSection:schedule','Abrir cronograma','tiny')}</header>
        ${scheduled.length?`<ul class="inspection-agenda">${scheduled.map(item=>`<li>
          <div><strong>${esc(item.station||'Estação sem nome')}</strong><span>${esc(fmt(item.due))}</span></div>
          ${googleScheduleBadge(item.due)}
        </li>`).join('')}</ul>`:`<p class="inspection-empty">${loaded?'Sem vistorias programadas.':'Aguardando os registros da base central.'}</p>`}
      </section>
    </div>`;
}

function googleCentralView(){
  const manager=googleUser.role==='GESTAO',items=googleCentralItems;
  const section=googleCentralSection;
  const title={dashboard:manager?'Dashboard Gerencial':'Minhas inspeções enviadas',
    history:manager?'Inspeções Recebidas':'Minhas inspeções enviadas',schedule:'Cronograma de inspeções',plans:'Planos de Ação'}[section];
  const description={dashboard:'Indicadores das inspeções sincronizadas.',history:'Consulte as vistorias recebidas e baixe os relatórios.',
    schedule:'Acompanhe a próxima vistoria prevista para cada POP.',plans:'Consulte as ações registradas nas vistorias enviadas pela equipe.'}[section];
  const sections=manager?[['dashboard','Dashboard'],['history','Inspeções recebidas'],['schedule','Cronograma'],['plans','Planos de Ação']]:
    [['history','Inspeções enviadas'],['schedule','Cronograma']];
  const nav=sections.map(([id,label])=>`<button type="button" class="btn tiny" data-action="centralSection:${id}" ${id===section?'aria-current="page"':''}>${label}</button>`).join('');
  const body={dashboard:()=>googleCentralDashboard(items),history:()=>googleHistoryView(items,manager),
    schedule:()=>googleCentralSchedule(items),plans:()=>googleActionPlansView(items)};
  return `<main class="shell central-shell inspection-central-shell">
    <section class="card central-heading inspection-central-heading">${googleProfilePanel()}
    <div class="card-head"><div><h1 id="google-central-title" tabindex="-1">${title}</h1>
      <p>${description}</p><p class="central-status small muted" role="status">${esc(googleCentralStatus())}</p>
      </div><div class="btnrow">${button('googleRefresh',googleCentralBusy?'Atualizando…':'Atualizar dados','primary tiny')}${button('home','Voltar','tiny')}</div></div>
      <nav class="central-navigation" aria-label="Visões da base central">${nav}</nav>
    </section>
    ${body[section]()}
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

let googleStationOptics=null;
const transceiverIdentityFields={
  tipo:'Tipo',fabricante:'Fabricante',modelo:'Modelo',serie:'Série',patrimonio:'Patrimônio'
};
function transceiverReferenceDifferences(record,transceiver){
  const reference=transceiver.baseReference;
  if(!reference)return '';
  if(reference.stationCode!==record.codigoPop)return 'A referência veio de outro POP. Confira a identificação nesta vistoria.';
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
  const differences=Object.keys(transceiverIdentityFields).filter(field=>reference[field]&&normalize(reference[field])!==normalize(transceiver[field]));
  if(!differences.length)return 'Dados compatíveis com o cadastro consultado. Confirme pela etiqueta em campo.';
  return 'Diferença em '+differences.map(field=>transceiverIdentityFields[field]+' (base: '+reference[field]+')').join(', ')+'. Confira em campo antes de confirmar o inventário.';
}
function renderTransceiverReference(record,transceiver){
  if(!isGoogleMode()||!googleUser)return '';
  const state=googleStationOptics?.session===googleSession&&googleStationOptics.stationCode===record.codigoPop?googleStationOptics:null;
  const items=state?.items||[];
  return `<div class="transceiver-reference">
    ${items.length?`<label class="field">Consultar transceiver cadastrado no POP
      <select data-transceiver-base="${esc(transceiver.id)}">
      <option value="">Selecione pela etiqueta</option>${items.map((item,index)=>`<option value="${index}">${esc([item.modelo,item.fabricante,item.serie&&'Série '+item.serie,item.patrimonio&&'Pat. '+item.patrimonio].filter(Boolean).join(' · '))}</option>`).join('')}
      </select></label>`:
      googleCapabilities.stationTransceivers?`<p class="small muted">${esc(state?.loading?'Consultando o cadastro deste POP…':state?.error||(state?'Nenhum transceiver cadastrado neste POP.':'Selecione um POP para consultar os transceivers cadastrados.'))}</p>${state?.error?'<button type="button" class="btn tiny" data-transceiver-retry>Tentar novamente</button>':''}`:''}
    <p id="tx-base-${esc(transceiver.id)}" class="small transceiver-base-feedback" role="status">${esc(transceiverReferenceDifferences(record,transceiver))}</p>
  </div>`;
}
async function loadStationTransceivers(record,{refresh=false}={}){
  if(!isGoogleMode()||!googleUser||!googleCapabilities.stationTransceivers||!googleStation(record))return;
  const session=googleSession,stationCode=record.codigoPop;
  if(!refresh&&googleStationOptics?.session===session&&googleStationOptics.stationCode===stationCode)return;
  const state={session,stationCode,loading:true};
  googleStationOptics=state;
  try{
    const result=await googleRpc('stationTransceivers',{stationCode});
    if(result.stationCode!==stationCode||!Array.isArray(result.items))throw Error('Cadastro retornado para um POP diferente.');
    state.items=result.items;
  }catch(error){
    state.error=error.message;
  }finally{
    state.loading=false;
    if(googleStationOptics===state&&session===googleSession&&cur()===record&&view==='inventario'){
      // Atualiza só a referência para preservar o foco dos campos da vistoria.
      for(const item of record.invTransceivers||[]){
        const parent=document.getElementById('tx-base-'+item.id)?.parentElement;
        if(parent)parent.outerHTML=renderTransceiverReference(record,item);
      }
    }
  }
}
document.addEventListener('click',event=>{
  if(!event.target.closest('[data-transceiver-retry]'))return;
  const record=cur();
  if(record)loadStationTransceivers(record,{refresh:true});
});
document.addEventListener('change',event=>{
  const select=event.target;
  if(!select.dataset.transceiverBase||select.value===''||!googleUser)return;
  const record=cur(),state=googleStationOptics;
  if(!record||state?.session!==googleSession||state.stationCode!==record.codigoPop)return;
  const item=record.invTransceivers?.find(entry=>entry.id===select.dataset.transceiverBase);
  const reference=state.items?.[Number(select.value)];
  if(!item||!reference)return;
  item.baseReference={stationCode:record.codigoPop,...reference};
  for(const field of Object.keys(transceiverIdentityFields)){
    const previous=String(item[field]??'').trim();
    if(reference[field]&&(!previous||(field==='tipo'&&item.tipoAutomatico===true)))item[field]=reference[field];
  }
  delete item.tipoAutomatico;
  change();
  render();
});
document.addEventListener('input',event=>{
  const field=event.target.dataset;
  if(field.inv13Group!=='tx'||!Object.hasOwn(transceiverIdentityFields,field.inv13Field))return;
  const record=cur(),item=record?.invTransceivers?.find(entry=>entry.id===field.inv13Id);
  if(!item)return;
  if(field.inv13Field==='tipo')delete item.tipoAutomatico;
  // The inventory listener copies the input value later in the same event.
  const feedback=document.getElementById('tx-base-'+item.id);
  if(feedback)feedback.textContent=transceiverReferenceDifferences(record,{...item,[field.inv13Field]:event.target.value});
});

let googleStationInventoryState=null;
function applyStationInventoryToRecord(record,payload){
  if(!record||!payload)return 0;
  if(typeof inv13==='function')inv13(record);
  record.inventory=Array.isArray(record.inventory)?record.inventory:[];
  record.equipamentos=record.equipamentos||{climatizadores:[],retificadoras:[],dios:[]};
  record.equipamentos.climatizadores=Array.isArray(record.equipamentos.climatizadores)?record.equipamentos.climatizadores:[];
  record.equipamentos.retificadoras=Array.isArray(record.equipamentos.retificadoras)?record.equipamentos.retificadoras:[];
  record.invBatteryBanks=Array.isArray(record.invBatteryBanks)?record.invBatteryBanks:[];
  let added=0;
  const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  const hasMatch=(list,cand)=>list.some(x=>(cand.centralId&&x.centralId===cand.centralId)
    ||(cand.serie&&x.serie&&String(x.serie).trim().toUpperCase()===String(cand.serie).trim().toUpperCase())
    ||(cand.patrimonio&&x.patrimonio&&String(x.patrimonio).trim().toUpperCase()===String(cand.patrimonio).trim().toUpperCase()));

  for(const item of payload.equipment||[]){
    if(hasMatch(record.inventory,item))continue;
    record.inventory.push({
      id:uid('EQ'),centralId:item.centralId||'',tipo:item.tipo||'Equipamento',
      marca:item.fabricante||'',fabricante:item.fabricante||'',modelo:item.modelo||'',
      quantidade:1,serie:item.serie||'',patrimonio:item.patrimonio||'',
      estado:item.estado||'Operacional',confirmacao:'Pré-carregado da base',observacao:item.observacao||''
    });
    added++;
  }
  for(const item of payload.climatizadores||[]){
    if(hasMatch(record.equipamentos.climatizadores,item))continue;
    record.equipamentos.climatizadores.push({
      id:uid('CL'),centralId:item.centralId||'',marca:item.marca||'',modelo:item.modelo||'',
      capacidade:item.capacidade||'',tipo:item.tipo||'',serie:item.serie||'',
      gas:item.gas||'',cargaGas:item.cargaGas||'',instalacao:item.instalacao||''
    });
    added++;
  }
  for(const item of payload.retificadoras||[]){
    if(hasMatch(record.equipamentos.retificadoras,item))continue;
    record.equipamentos.retificadoras.push({
      id:uid('RT'),centralId:item.centralId||'',fabricante:item.fabricante||'',modelo:item.modelo||'',
      urInstaladas:item.urInstaladas||'',capacidadeCC:item.capacidadeCC||'',tensao:item.tensao||'',
      serie:item.serie||'',patrimonio:item.patrimonio||'',observacao:item.observacao||''
    });
    added++;
  }
  for(const item of payload.bancos||[]){
    if(hasMatch(record.invBatteryBanks,item))continue;
    record.invBatteryBanks.push({
      id:uid('BK'),centralId:item.centralId||'',identificacao:item.identificacao||'Banco de baterias',
      tensao:item.tensao||'',capacidade:item.capacidade||'',autonomiaHoras:item.autonomiaHoras||'',
      observacao:item.observacao||'',cadastroCompleto:false,baterias:[]
    });
    added++;
  }
  return added;
}

async function loadStationInventory(record,{manual=false}={}){
  if(!isGoogleMode()||!googleUser||!googleCapabilities.stationInventory||!googleStation(record))return;
  const session=googleSession,stationCode=record.codigoPop;
  googleStationInventoryState={session,stationCode,loading:true,message:'Consultando inventário central do POP…'};
  if(manual&&view==='inventario')render();
  try{
    const payload=await googleRpc('stationInventory',{stationCode});
    if(session!==googleSession||cur()!==record||record.codigoPop!==stationCode)return;
    const added=applyStationInventoryToRecord(record,payload);
    const totalFound=(payload.equipment?.length||0)+(payload.climatizadores?.length||0)+(payload.retificadoras?.length||0)+(payload.bancos?.length||0);
    googleStationInventoryState={
      session,stationCode,loading:false,
      message:added>0
        ? `${added} ativo(s) pré-carregado(s) da base central do POP. Confira as etiquetas e atualize as medições.`
        : totalFound>0
          ? 'Os ativos cadastrados neste POP já estão nesta vistoria.'
          : 'Nenhum ativo prévio cadastrado para este POP na base central.'
    };
    if(added>0)change();
    if(view==='inventario'||manual)render();
  }catch(error){
    if(session!==googleSession)return;
    googleStationInventoryState={session,stationCode,loading:false,message:'Não foi possível consultar a base do POP: '+error.message};
    if(view==='inventario'||manual)render();
  }
}

function renderStationInventoryImport(record){
  if(!isGoogleMode()||!googleUser||!googleCapabilities.stationInventory||!googleStation(record))return '';
  const st=googleStationInventoryState?.stationCode===record.codigoPop?googleStationInventoryState:null;
  return `<button type="button" class="btn tiny" data-load-station-inventory ${st?.loading?'disabled':''}>${st?.loading?'Carregando base…':'⬇ Importar inventário da base do POP'}</button>${st?.message?`<p class="small muted" style="width:100%;margin:.35rem 0 0" role="status">${esc(st.message)}</p>`:''}`;
}

document.addEventListener('click',event=>{
  const toggleKey=event.target.closest('[data-toggle-login-key]');
  if(toggleKey){
    const input=document.getElementById('google-key');
    if(input){
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      toggleKey.textContent=showing?'Mostrar':'Ocultar';
      toggleKey.setAttribute('aria-pressed',String(!showing));
    }
    return;
  }
  if(!event.target.closest('[data-load-station-inventory]'))return;
  const r=cur();
  if(r)loadStationInventory(r,{manual:true});
});

document.addEventListener('change',e=>{
  if(e.target.dataset.googleStation!==undefined&&googleUser){
    const r=cur(),station=googleStations.find(s=>s.code===e.target.value&&!s.duplicate&&!s.inactive);if(!r)return;
    const previous=googleStation(r);
    if(station?.city&&(!String(r.municipio??'').trim()||r.municipio===previous?.city))r.municipio=station.city;
    r.codigoPop=station?.code||'';r.nome=station?.name||r.nome;r.popCriticality=station?.criticality||'';
    r.schedulePeriod=station?.days||'';r.scheduleBaseDate=r.data;r.scheduleDueDate=station?.days?addLocalDays(r.data,station.days):'';
    change();
    loadStationTransceivers(r,{refresh:true});
    const emptyInv=!(r.inventory?.length)&&!(r.equipamentos?.climatizadores?.length)&&!(r.equipamentos?.retificadoras?.length)&&!(r.invBatteryBanks?.length);
    if(station&&emptyInv)loadStationInventory(r,{manual:false});
    render();
  }
});
