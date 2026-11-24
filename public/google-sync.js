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
async function googleRpc(action,data={},key=googleAccessKey){
  if(!googleReady())throw Error('Aguardando a URL do serviço Google.');
  const body=JSON.stringify({version:1,action,...data,token:key});
  if(new Blob([body]).size>15*1024*1024)throw Error('O envio excede 15 MB. Reduza as fotos.');
  const response=await fetch(cfg.google.endpoint,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},body});
  if(!response.ok)throw Error('Serviço Google indisponível.');
  const result=await response.json();
  if(!result.ok)throw Error(result.error||'Operação não confirmada.');
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
  googlePageBusy=false;googlePageError='';photosCache.clear();render();
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
async function googleSend(r){
  if(googleCapabilities.stagedPhotos&&typeof googleSendV2==='function')return googleSendV2(r);
  if(googleSending||!r?.finalizedAt)return false;
  if(!googleReady()||!googleUser||!googleAccessKey||!navigator.onLine){r.syncState='pendente';saveAll();render();return false;}
  googleSending=true;const session=googleSession;r.syncState='enviando';saveAll();render();
  try{
    const version=r.updated,snapshot=await portableRecord(r);if(session!==googleSession)return false;
    if((snapshot.photoFiles||[]).length!==(snapshot.photos||[]).length)throw Error('Uma foto está indisponível. Restaure o backup antes de enviar.');
    for(const key of ['syncState','syncedAt','syncedOrg','googlePdfUrl','googleError','ownerEmail'])delete snapshot[key];
    const result=await googleRpc('submit',{record:snapshot});if(session!==googleSession)return false;
    if(result.inspectionId!==r.id||!/^https:\/\/drive\.google\.com\//.test(result.pdfUrl||''))throw Error('Gravação completa não confirmada.');
    if(result.schedule&&r.updated===version){r.schedulePeriod=result.schedule.days;r.scheduleBaseDate=result.schedule.baseDate;r.scheduleDueDate=result.schedule.dueDate;r.popCriticality=result.schedule.criticality;}
    r.syncedAt=result.receivedAt;r.syncState=r.updated===version?'sincronizado':'pendente';r.googleError='';saveAll();render();return true;
  }catch(error){if(session===googleSession){r.syncState='erro';r.googleError=error.message;saveAll();render();alert('Envio pendente: '+error.message);}return false;}
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
  if(r?.syncState==='processando'){
    if(typeof googlePollJobs==='function')await googlePollJobs();
    if(cur()?.id===r.id&&r.syncState==='processando')alert('A inspeção já foi recebida. Aguarde a geração do PDF.');
    return;
  }
  if(!r?.nome?.trim()||!r.inspetor?.trim()||!r.data)return alert('Informe estação, Técnico 01 e data.');
  const station=googleStation(r);if(!station?.days)return alert('Selecione um POP cadastrado com criticidade ALTA ou MÉDIA.');
  if(!confirm('Finalizar e enviar a inspeção e o PDF? Sem conexão, o envio ficará pendente.'))return;
  r.nome=station.name;r.popCriticality=station.criticality;r.schedulePeriod=station.days;
  if(!r.finalizedAt){r.finalizedAt=new Date().toISOString();r.updated=r.finalizedAt;}
  r.scheduleBaseDate=r.data;r.scheduleDueDate=addLocalDays(r.data,station.days);r.syncState='pendente';
  if(!saveAll())return;render();const session=googleSession,sent=await googleSend(r);
  if(session===googleSession)alert(sent?(r.syncState==='sincronizado'?'Dados e PDF confirmados. Próxima inspeção: '+fmt(r.scheduleDueDate)+'.':r.syncState==='processando'?'Inspeção recebida. O PDF e os ativos estão em processamento; você pode continuar usando o aplicativo.':'Versão enviada. Há alterações recentes pendentes.'):'Inspeção salva neste dispositivo. Confira o painel para reenviar.');
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
  render();
  if(selector)document.getElementById('app')?.querySelector(selector)?.focus({preventScroll:true});
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
  const historyHTML=()=>`<div class="card"><h2 >Histórico de inspeções</h2><p>Exibindo ${items.length} de ${googleSummary?.total??items.length} registros.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>POP / data</th><th>Técnico / autor</th><th>Criticidade</th><th>NC</th><th>Próxima inspeção</th><th>Relatório e ativos</th></tr></thead><tbody>${items.map(r=>`<tr><td>${esc(r.station)}<br>${esc(fmt(r.date))}</td><td>${esc(r.technician)}<br>${esc(r.owner)}</td><td>${esc(r.criticality)}</td><td>${Number(r.nc)||0}</td><td>${esc(fmt(r.due))}</td><td>${manager?button('googleSummaryPdf:'+r.id,'Baixar PDF gerencial (1 página)','primary tiny'):''}<details class="archived-pdf"><summary>Relatório arquivado</summary>${button('googlePdf:'+r.id,'Baixar arquivo do Drive','tiny')}${manager&&googleCapabilities.reportRefresh?button('googleRefreshReport:'+r.id,'Gerar novo PDF no Drive','tiny'):''}</details>${r.assets?`<p>${esc(googleAssetText(r.assets))}</p>`:''}${r.assets?.pending?button('googleIssues:'+r.id,'Ver pendências','tiny')+button('googleAssets:'+r.id,'Reprocessar ativos','tiny'):''}</td></tr>`).join('')||'<tr><td colspan="6">Nenhuma inspeção recebida nesta consulta.</td></tr>'}</tbody></table></div>${googleMoreButton()}</div>`;
  return `<div class="shell" style="display:block;max-width:1160px">${googleProfilePanel()}
    <div class="card"><div class="card-head"><div><h1 id="google-central-title" tabindex="-1">${title}</h1>
      <p>${description}</p><p class="small muted" role="status">${esc(googleCentralStatus())}</p>
      </div><div class="btnrow">${button('googleRefresh',googleCentralBusy?'Atualizando…':'Atualizar dados','primary tiny')}${button('home','Voltar','tiny')}</div></div>
      <nav class="central-navigation" aria-label="Visões da base central">${nav}</nav>
    </div>
    ${section==='plans'?googleActionPlansView(items):{dashboard:dashboardHTML,history:historyHTML,schedule:scheduleHTML}[section]()}
  </div>`;
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
