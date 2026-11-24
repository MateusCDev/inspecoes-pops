// Recursos v2 negociados com o serviço; clientes continuam funcionando antes da atualização do Apps Script.
function googleProgress(r,text){r.googleProgress=text;const el=document.getElementById('google-progress-'+r.id);if(el)el.textContent=text;}
async function googleDigest(text){if(!window.crypto?.subtle)return '';const data=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('');}
function googleApplyReceipt(r,result,version,session){
  if(session!==googleSession)return;
  if(result.pending){r.syncState='processando';r.googleJobHash=result.hash;r.googleSubmittedVersion=version;googleProgress(r,'Recebida. Gerando PDF e atualizando os ativos.');}
  else{
    if(result.inspectionId!==r.id||!/^https:\/\/drive\.google\.com\//.test(result.pdfUrl||''))throw Error('Confirmação de processamento inválida.');
    if(result.schedule&&r.updated===version){r.schedulePeriod=result.schedule.days;r.scheduleBaseDate=result.schedule.baseDate;r.scheduleDueDate=result.schedule.dueDate;r.popCriticality=result.schedule.criticality;}
    r.syncedAt=result.receivedAt;r.syncState=r.updated===version?'sincronizado':'pendente';r.googleAssets=result.assets;
    googleProgress(r,version===null
      ? 'A versão anterior foi concluída. Use Enviar pendentes para sincronizar esta versão.'
      : googleAssetText(result.assets));delete r.googleJobHash;delete r.googleSubmittedVersion;
  }
  r.googleError='';saveAll();if(view==='home'||view==='googleCentral'||(cur()?.id===r.id&&view==='resumo'))render();
}
async function googleSendV2(r){
  if(googleSending||!r?.finalizedAt)return false;
  if(!googleUser||!navigator.onLine){r.syncState='pendente';saveAll();render();return false;}
  googleSending=true;const session=googleSession,version=r.updated,key=googleAccessKey;r.syncState='enviando';saveAll();render();
  try{
    const snapshot=JSON.parse(JSON.stringify(r));
    for(const key of ['syncState','syncedAt','syncedOrg','googlePdfUrl','googleError','ownerEmail','googlePhotoRefs','googleProgress','googleJobHash','googleSubmittedVersion','googleAssets'])delete snapshot[key];
    snapshot.photoFiles=[];const files=[];let bytes=new Blob([JSON.stringify(snapshot)]).size;
    for(const photo of r.photos||[]){if(session!==googleSession)return false;const file=await getPhoto(photo.id);if(session!==googleSession)return false;if(!file?.blob)throw Error('Foto indisponível: '+photo.name);files.push({photo,blob:file.blob});bytes+=Math.ceil(file.blob.size*4/3)+128;}
    if(bytes>15*1024*1024)throw Error('O conjunto das fotos excede 15 MB. Reduza a quantidade ou o tamanho das fotos.');
    r.googlePhotoRefs||={};
    for(let i=0;i<files.length;i++){
      if(session!==googleSession)return false;
      const {photo,blob}=files[i];googleProgress(r,`Enviando foto ${i+1} de ${files.length}…`);
      const data=await fileToDataUrl(blob),digest=await googleDigest(data),cached=r.googlePhotoRefs[photo.id];
      if(session!==googleSession)return false;
      const reference=digest&&cached?.digest===digest?cached:(await googleRpc('photo',{inspectionId:r.id,photoId:photo.id,data},key)).photo;
      if(session!==googleSession)return false;
      if(!reference?.fileId||!reference.signature)throw Error('Foto não confirmada.');
      r.googlePhotoRefs[photo.id]=reference;snapshot.photoFiles.push(reference);
    }
    if(session!==googleSession)return false;
    googleProgress(r,'Registrando envio…');const result=await googleRpc('submit',{record:snapshot,queue:true},key);if(session!==googleSession)return false;
    googleApplyReceipt(r,result,version,session);
    if(result.pending){
      // A chamada adianta o processamento; o acionador do Google continua se a página for fechada.
      googleRpc('process',{inspectionId:r.id},key).then(done=>{
        if(done?.ok&&r.syncState==='processando'&&r.googleJobHash===result.hash)googleApplyReceipt(r,done,version,session);
      }).catch(()=>{});
    }
    return true;
  }catch(error){
    if(session!==googleSession)return false;
    if(error.message.includes('A versão anterior ainda está em processamento.')){
      try{
        const previous=await googleRpc('status',{inspectionId:r.id},key);
        if(session!==googleSession)return false;
        const submittedVersion=previous.hash&&previous.hash===r.googleJobHash ? (r.googleSubmittedVersion??null) : null;
        googleApplyReceipt(r,previous,submittedVersion,session);
        return true;
      }catch(statusError){error=statusError;}
    }
    if(session===googleSession){r.syncState='erro';r.googleError=error.message;saveAll();render();alert(error.message);}
    return false;
  }
  finally{googleSending=false;}
}
async function googlePollJobs(){
  if(googleJobsPolling||!googleUser||!navigator.onLine)return;
  googleJobsPolling=true;const session=googleSession;
  try{
    for(const r of records.filter(x=>x.syncState==='processando')){
      if(session!==googleSession)break;
      try{const result=await googleRpc('status',{inspectionId:r.id});if(session!==googleSession)break;googleApplyReceipt(r,result,r.googleSubmittedVersion??null,session);}
      catch(error){if(session===googleSession){r.syncState='erro';r.googleError=error.message;saveAll();render();}}
    }
  }finally{googleJobsPolling=false;}
}
async function googleRefreshSummary(){
  if(googleCentralBusy||!googleUser)return;googleCentralBusy=true;googleCentralError='';const session=googleSession;googleRenderCentralData();
  try{
    const result=await googleRpc('dashboard');if(session!==googleSession)return;
    if(!Array.isArray(result.items)||!result.summary)throw Error('Resumo central inválido.');
    googleCentralItems=result.items;googleSummary=result.summary;googleNextCursor=result.nextCursor;googleCentralUpdated=new Date().toLocaleString('pt-BR');
  }catch(error){if(session===googleSession)googleCentralError=error.message;}
  finally{if(session===googleSession){googleCentralBusy=false;googleRenderCentralData();}}
}
async function googleLoadMore(){
  if(googleCentralBusy||googleNextCursor===null)return;googleCentralBusy=true;const session=googleSession;
  try{const page=await googleRpc('list',{cursor:googleNextCursor});if(session!==googleSession)return;const ids=new Set(googleCentralItems.map(x=>x.id));googleCentralItems.push(...page.items.filter(x=>!ids.has(x.id)));googleNextCursor=page.nextCursor;}
  catch(error){if(session===googleSession)alert(error.message);}
  finally{if(session===googleSession){googleCentralBusy=false;render();}}
}
function googleActionPlansView(items){
  const rows=items.filter(item=>Number(item.issues)>0).map(item=>`<tr>
    <td>${esc(item.station)}</td><td>${esc(fmt(item.date))}</td><td>${esc(item.technician||'—')}</td>
    <td>${Number(item.issues)}</td><td>${button('googleActionPlan:'+esc(item.id),'Ver plano de ação','tiny')}</td></tr>`).join('');
  const empty=googleCentralBusy?'Consultando as inspeções recebidas…':googleCentralError?'Consulta indisponível. Use Atualizar dados para tentar novamente.':
    googleNextCursor!==null?'Nenhum plano nesta página. Carregue mais inspeções para continuar a consulta.':'Nenhum plano registrado nas inspeções recebidas.';
  return `<section class="card"><h2>Ações das vistorias da equipe</h2>
    ${rows?`<div class="table-scroll"><table class="data-table"><thead><tr><th>POP</th><th>Vistoria</th><th>Técnico</th><th>Ações</th><th>Consulta</th></tr></thead><tbody>${rows}</tbody></table></div>`
      :`<p role="status">${empty}</p>`}
    ${googleNextCursor!==null?button('googleLoadMore','Carregar mais inspeções','tiny'):''}</section>`;
}

async function googleReprocessAssets(id){
  const session=googleSession,key=googleAccessKey;
  const {dialog,content}=openGoogleAssetDialog('Reprocessar ativos',id,'Enviando a solicitação…');
  const show=message=>{if(session===googleSession&&dialog.open)content.textContent=message;};
  try{
    const result=await googleRpc('reprocessAssets',{inspectionId:id},key);
    if(session!==googleSession)return;
    if(result.pending){
      show('Solicitação recebida. O cadastro central está sendo reprocessado.');
      const outcome=await googleRpc('process',{inspectionId:id},key);
      if(outcome.pending){show('O reprocessamento está na fila. Atualize a consulta em instantes.');return;}
    }
    show('Reprocessamento concluído.');
    if(session===googleSession)googleRefreshCentral();
  }catch(error){
    show(error.message);
  }
}
function closeGoogleAssetIssues(){
  document.getElementById('google-asset-issues')?.close();
}
function openGoogleAssetDialog(title,id,loading){
  closeGoogleAssetIssues();
  const record=googleCentralItems.find(item=>item.id===id);
  const dialog=document.createElement('dialog');
  dialog.id='google-asset-issues';
  dialog.className='asset-issues-dialog';
  dialog.setAttribute('aria-labelledby','asset-issues-title');
  dialog.innerHTML=`<header class="card-head">
    <div><h2 id="asset-issues-title">${title}</h2>
      ${record?`<p class="muted">${esc(record.station)} · ${esc(fmt(record.date))}</p>`:''}
    </div>
    <form method="dialog"><button class="btn tiny" autofocus>Fechar</button></form>
  </header><div data-asset-issues-content aria-live="polite"><p>${loading}</p></div>`;
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);
  dialog.showModal();
  return {dialog,content:dialog.querySelector('[data-asset-issues-content]')};
}
async function googleOpenActionPlan(id){
  if(googleUser?.role!=='GESTAO')return;
  const session=googleSession;
  const {dialog,content}=openGoogleAssetDialog('Plano de ação da vistoria',id,'Consultando ações da vistoria…');
  try{
    const {issues}=await googleRpc('inspectionActionPlan',{inspectionId:id});
    if(session!==googleSession||!dialog.open)return;
    if(!Array.isArray(issues))throw Error('A consulta não retornou as ações da vistoria.');
    content.innerHTML=issues.length?issues.map(issue=>`<section>
      <h3>${esc(issue.titulo||'Ação registrada')}</h3>
      <p style="white-space:pre-line">${esc(issue.acao||'—')}</p>
      <p class="small muted"><strong>Prioridade</strong> ${esc(issue.prioridade||'—')} · <strong>Situação</strong> ${esc(issue.status||'—')}</p>
      <p class="small muted"><strong>Responsável</strong> ${esc(issue.responsavel||'—')} · <strong>Prazo</strong> ${esc(fmt(issue.prazo))}</p>
      ${issue.evidencia?`<p class="small muted"><strong>Evidência</strong> ${esc(issue.evidencia)}</p>`:''}
    </section>`).join(''):'<p>Nenhuma ação registrada nessa vistoria.</p>';
  }catch(error){
    if(session!==googleSession||!dialog.open)return;
    if(/Operação desconhecida/i.test(error.message)){
      content.innerHTML=`<p role="alert">A implantação acessada pelo portal ainda não oferece a consulta de planos de ação. Confira a versão publicada para este endereço no Apps Script.</p>
        ${button('googlePdf:'+esc(id),'Baixar relatório arquivado','tiny')}`;
    }else content.innerHTML=`<p role="alert">${esc(error.message)}</p>`;
  }
}
function googleAssetValue(value){
  const text=String(value??'').trim();
  return text.replace(/(^|\s)#(?:ERROR!|ERRO!|REF!|DIV\/0!|VALUE!|N\/A|NUM!|NAME\?|NULL!)(?=\s|$)/gi,'$1Dado indisponível');
}
async function googleShowInventory(id,central=false){
  const session=googleSession;
  const title=central?'Cadastro central do POP':'Equipamentos da vistoria';
  const loading=central?'Consultando a planilha central…':'Consultando o inventário arquivado…';
  const {dialog,content}=openGoogleAssetDialog(title,id,loading);
  try{
    const result=await googleRpc(central?'centralAssetsForInspection':'inspectionAssets',{inspectionId:id});
    if(session!==googleSession||!dialog.open)return;
    if(!Array.isArray(result.groups))throw Error('O serviço não trouxe o inventário.');
    content.innerHTML=result.groups.length?result.groups.map(group=>`<section>
      <h3>${esc(group.label)}</h3><ul>${group.items.map(item=>`<li><strong>${esc(googleAssetValue(item.name))}</strong>
      ${esc([item.serial&&'Série '+item.serial,item.asset&&'Patrimônio '+item.asset,item.status].filter(Boolean).map(googleAssetValue).join(' · '))}
      ${item.observation?`<div class="small muted">${esc(googleAssetValue(item.observation))}</div>`:''}</li>`).join('')}</ul></section>`).join('')
      :central?'<p>Nenhum equipamento consta no cadastro central deste POP.</p>':'<p>Nenhum equipamento foi registrado nesta inspeção.</p>';
  }catch(error){if(session===googleSession&&dialog.open)content.innerHTML=`<p role="alert">${esc(error.message)}</p>`;}
}
function assetIssueGuidance(detail){
  const message=String(detail||'');
  if(/banco incompleto|banco com modelo/i.test(message)){
    return 'Na inspeção original, confira as baterias do banco uma a uma. Marque o cadastro como completo depois da conferência e reenvie a inspeção.';
  }
  if(/carga gás|carga de gás/i.test(message)){
    return 'Confira a carga na etiqueta do aparelho e a unidade. Se a implantação já foi atualizada e o valor informado está correto, use Reprocessar ativos.';
  }
  if(/data inválida/i.test(message)){
    const date=message.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if(date)return 'Se a data está correta, a implantação atual aceita esse formato. Reprocesse os ativos. Se precisar corrigir no formulário, use '+[date[3],date[2],date[1]].join('-')+'.';
    return 'Confira a data no equipamento ou na documentação e corrija o campo na inspeção antes de reenviar.';
  }
  if(/a série diverge/i.test(message)){
    return 'Compare etiqueta, patrimônio e cadastro central. Corrija um eventual erro de digitação na inspeção. Se o equipamento foi trocado, registre a substituição no cadastro de ativos com a Gestão.';
  }
  return '';
}
async function googleShowAssetIssues(id){
  const session=googleSession;
  const {dialog,content}=openGoogleAssetDialog('Pendências de conferência',id,'Carregando pendências…');
  try{
    const result=await googleRpc('assetIssues',{inspectionId:id});
    if(session!==googleSession||!dialog.open)return;
    if(!Array.isArray(result.issues))throw Error('A resposta do serviço não trouxe os detalhes das pendências.');
    const tabs=new Map();
    const names={Ativos:'Inventário de ativos',Climatização_Voanet:'Climatização',Controle_Baterias:'Baterias',Retificadores:'Retificadores'};
    for(const entry of result.issues){
      const title=names[entry.tab]||entry.tab||'Conferência de inventário';
      if(!tabs.has(title))tabs.set(title,[]);
      tabs.get(title).push(entry.detail);
    }
    content.innerHTML=tabs.size?[...tabs].map(([title,items])=>`<section><h3>${esc(title)}</h3><ul>${items.map(item=>{const guidance=assetIssueGuidance(item);return `<li>${esc(item)}${guidance?`<p class="asset-issue-guidance">${esc(guidance)}</p>`:''}</li>`;}).join('')}</ul></section>`).join(''):'<p>Sem pendências nesta versão.</p>';
    if(tabs.size&&googleUser?.role==='GESTAO'&&googleCapabilities.assetReconciliation){
      content.insertAdjacentHTML('beforeend',button('googleCompare:'+id,'Conferir com a base central','primary tiny'));
    }
  }catch(error){
    if(session===googleSession&&dialog.open)content.innerHTML=`<p role="alert">${esc(error.message)}</p>`;
  }
}
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;if(!googleUser)return;
  if(action==='googleLoadMore')googleLoadMore();if(action?.startsWith('googleAssets:'))googleReprocessAssets(action.slice(13));
  if(action?.startsWith('googleActionPlan:'))googleOpenActionPlan(action.slice('googleActionPlan:'.length));
  if(action?.startsWith('googleInventory:'))googleShowInventory(action.slice('googleInventory:'.length));
  if(action?.startsWith('googleIssues:'))googleShowAssetIssues(action.slice(13));
});
if(typeof window.setInterval==='function')window.setInterval(googlePollJobs,5000);

document.addEventListener('change',e=>{if(e.target.dataset.bankComplete&&googleUser){const bank=cur()?.invBatteryBanks?.find(b=>b.id===e.target.dataset.bankComplete);if(bank){bank.cadastroCompleto=e.target.checked;change();}}});

let googleBatteries={};
async function googleRefreshBatteries(){
  if(googleUser?.role!=='GESTAO'||!googleCapabilities.assetReconciliation)return;
  const session=googleSession;
  if(googleBatteries.session===session&&googleBatteries.busy)return;
  googleBatteries={session,busy:true};
  if(view==='assets')render();
  try{
    const result=await googleRpc('centralBatteryBanks');
    if(session===googleSession)googleBatteries={session,banks:result.banks};
  }catch(error){
    if(session===googleSession)googleBatteries={session,error:error.message};
  }
  if(session===googleSession&&view==='assets')render();
}

function renderCentralBatteries(){
  if(!isGoogleMode()||googleUser?.role!=='GESTAO'||!googleCapabilities.assetReconciliation)return '';
  const state=googleBatteries.session===googleSession?googleBatteries:{};
  const banks=state.banks;
  const rows=banks?.map(bank=>`<tr><td>${esc(bank.station)}</td><td>${esc([bank.name,bank.maker,bank.model].filter(Boolean).join(' · '))}</td>
    ${[bank.quantity,bank.installed,bank.age,bank.nextTest,bank.status].map(value=>`<td>${esc(value||'—')}</td>`).join('')}</tr>`).join('');
  return `<section class="card"><div class="card-head"><div><h2>Bancos de baterias na base central</h2>
    <p class="muted small">Instalação, tempo de uso e situação registrados na guia Controle_Baterias.</p></div>
    ${button('googleRefreshBatteries','Atualizar bancos','tiny')}</div>
    ${!banks?`<p role="status">${esc(state.error||'Consultando a planilha central…')}</p>`:`
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Estação</th><th>Banco</th><th>Quantidade</th>
    <th>Instalação</th><th>Uso (meses)</th><th>Próximo teste</th><th>Situação</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="7">Nenhum banco cadastrado na guia central.</td></tr>'}</tbody></table></div>`}</section>`;
}

function assetComparisonCells(item){
  const values=[item.station,[item.maker,item.model||item.name].filter(Boolean).join(' '),item.serial,item.patr,
    item.quantity,item.gas,item.installed&&fmt(item.installed)];
  return values.map(value=>`<td>${esc(value===''||value==null?'—':value)}</td>`).join('');
}

async function googleCompareAssets(id){
  const session=googleSession;
  const {dialog,content}=openGoogleAssetDialog('Conferir com a base central',id,'Cruzando a vistoria com a planilha…');
  dialog.classList.add('asset-comparison-dialog');
  const active=()=>session===googleSession&&dialog.open;
  try{
    const {items}=await googleRpc('compareInspectionAssets',{inspectionId:id});
    if(!active())return;
    content.innerHTML=items.length?items.map(item=>`<section>
      <h3>${esc(item.label)}</h3><p class="small muted">${esc(item.tab)}</p>
      <ul>${item.issues.map(detail=>`<li>${esc(detail)}</li>`).join('')}</ul>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Origem</th><th>Estação</th><th>Equipamento</th><th>Série</th><th>Patrimônio</th><th>Qtd.</th><th>Carga de gás</th><th>Instalação</th></tr></thead>
      <tbody><tr><th scope="row">Vistoria</th>${assetComparisonCells(item)}</tr>
      ${item.matches.map((match,index)=>`<tr><th scope="row">Cadastro ${index+1}</th>${assetComparisonCells(match)}</tr>`).join('')
        ||'<tr><td colspan="8">Nenhum cadastro semelhante encontrado.</td></tr>'}</tbody></table></div>
      ${item.matches.map((match,index)=>`<p><strong>Cadastro ${index+1}</strong> ·
        ${esc([...match.basis,match.serialDiff&&'Série divergente',match.patrDiff&&'Patrimônio divergente',match.otherStation&&'Outra estação'].filter(Boolean).join(' · '))}</p>
        ${match.operation?`<details class="archived-pdf"><summary>${match.operation==='replace'?'Confirmar substituição':'Vincular ao mesmo equipamento'}</summary>
        <form data-asset-decision="${esc(match.token)}">
          <p class="small muted">${match.operation==='replace'?'Confirme pela etiqueta ou ordem de serviço antes de atualizar a série. A identificação anterior fica no histórico.':'Confirme os dados de identificação antes de atualizar a linha indicada.'}</p>
          <label>Motivo da decisão <input name="reason" required minlength="5" maxlength="300"></label>
          <button class="btn primary tiny" type="submit">Salvar decisão</button><p role="status"></p>
        </form></details>`:''}`).join('')}</section>`).join(''):'<p>Nenhuma pendência com equipamento identificável para comparar nesta vistoria.</p>';
  }catch(error){
    if(active())content.innerHTML=`<p role="alert">${esc(error.message)}</p>`;
  }
  dialog.addEventListener('submit',async event=>{
    const form=event.target;
    if(!form.dataset.assetDecision)return;
    event.preventDefault();
    const button=form.querySelector('button'),status=form.querySelector('[role="status"]');
    if(button.disabled||!active())return;
    button.disabled=true;
    status.textContent='Salvando decisão…';
    try{
      const result=await googleRpc('applyAssetDecision',{inspectionId:id,decisionToken:form.dataset.assetDecision,reason:form.elements.reason.value});
      if(session!==googleSession)return;
      if(active())content.innerHTML=`<p role="status">${result.action==='SUBSTITUIDO'?'Substituição registrada.':'Vínculo confirmado.'} O cadastro central e o histórico foram atualizados.</p>`;
      googleRefreshCentral();
    }catch(error){
      if(active()){status.textContent=error.message;button.disabled=false;}
    }
  });
}
document.addEventListener('click',event=>{
  if(googleUser?.role!=='GESTAO'||!googleCapabilities.assetReconciliation)return;
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='googleRefreshBatteries')googleRefreshBatteries();
  if(action?.startsWith('googleCatalog:'))googleShowInventory(action.slice('googleCatalog:'.length),true);
  if(action?.startsWith('googleCompare:'))googleCompareAssets(action.slice('googleCompare:'.length));
});
