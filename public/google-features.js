// Recursos v2 negociados com o serviço; clientes continuam funcionando antes da atualização do Apps Script.
function googleProgress(r,text){if(r.googleProgress===text)return;r.googleProgress=text;const el=document.getElementById('google-progress-'+r.id);if(el)el.textContent=text;}
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
  if(!googleUser)return false;
  if(!navigator.onLine)return googleInspectionOffline(r);
  googleSending=true;const session=googleSession,version=r.updated,key=googleAccessKey;
  r.syncState='enviando';r.googleError='';r.googleProgress='Preparando o envio…';saveAll();render();
  // O serviço reaproveita a mesma foto ou revisão quando a resposta se perde.
  const uploadOptions=message=>({retry:true,timeout:45000,onRetry:()=>googleProgress(r,message)});
  try{
    const snapshot=googleInspectionSnapshot(r);
    const files=await googlePreparePhotoFiles(r,snapshot,session);
    if(!files||session!==googleSession)return false;
    r.googlePhotoRefs||={};
    for(let i=0;i<files.length;i++){
      if(session!==googleSession)return false;
      const {photo,blob}=files[i];googleProgress(r,`Enviando foto ${i+1} de ${files.length}…`);
      const data=await googlePhotoData(photo,blob),digest=await googleDigest(data),cached=r.googlePhotoRefs[photo.id];
      if(session!==googleSession)return false;
      const reference=digest&&cached?.digest===digest?cached:
        (await googleRpc('photo',{inspectionId:r.id,photoId:photo.id,data},key,
          uploadOptions(`Reconectando para enviar a foto ${i+1} de ${files.length}…`))).photo;
      if(session!==googleSession)return false;
      if(!reference?.fileId||!reference.signature)throw Error('Foto não confirmada.');
      r.googlePhotoRefs[photo.id]=reference;snapshot.photoFiles.push(reference);
    }
    if(session!==googleSession)return false;
    googleProgress(r,'Registrando envio…');
    const result=await googleRpc('submit',{record:snapshot,queue:true},key,uploadOptions('Reconectando para confirmar o recebimento…'));
    if(session!==googleSession)return false;
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
        const previous=await googleRpc('status',{inspectionId:r.id},key,uploadOptions('Reconectando para consultar a versão anterior…'));
        if(session!==googleSession)return false;
        const submittedVersion=previous.hash&&previous.hash===r.googleJobHash ? (r.googleSubmittedVersion??null) : null;
        googleApplyReceipt(r,previous,submittedVersion,session);
        return true;
      }catch(statusError){error=statusError;}
    }
    if(session===googleSession)googleInspectionSendFailure(r,error);
    return false;
  }
  finally{googleSending=false;}
}
async function googlePollJobs(current){
  if(googleJobsPolling||!googleUser)return;
  if(!navigator.onLine){
    if(current?.syncState==='processando')googleProgress(current,'Inspeção recebida. Reconecte-se para consultar o PDF.');
    return;
  }
  googleJobsPolling=true;const session=googleSession;
  try{
    const inspections=current?[current]:records.filter(record=>record.syncState==='processando');
    for(const record of inspections){
      if(session!==googleSession)break;
      if(record.syncState!=='processando')continue;
      if(current)googleProgress(record,'Consultando o processamento…');
      try{
        const result=await googleRpc('status',{inspectionId:record.id},googleAccessKey,{timeout:45000});
        if(session!==googleSession)break;
        googleApplyReceipt(record,result,record.googleSubmittedVersion??null,session);
      }catch(error){
        if(session!==googleSession)break;
        if(error instanceof GoogleTransportError){
          googleProgress(record,'Inspeção recebida. A consulta ao PDF será retomada quando o serviço estiver disponível.');
          continue;
        }
        googleInspectionSendFailure(record,error);
      }
    }
  }finally{googleJobsPolling=false;}
}
async function googleRefreshSummary(){
  if(googleCentralBusy||googlePageBusy||!googleUser)return;
  googleCentralBusy=true;googleCentralError='';googlePageError='';const session=googleSession;googleRenderCentralData();
  try{
    const result=await googleRpc('dashboard');if(session!==googleSession)return;
    if(!Array.isArray(result.items)||!result.summary||
      (result.nextCursor!==null&&!Number.isInteger(result.nextCursor)))throw Error('Resumo central inválido.');
    googleCentralItems=result.items;googleSummary=result.summary;googleNextCursor=result.nextCursor;googleCentralUpdated=new Date().toLocaleString('pt-BR');
  }catch(error){if(session===googleSession)googleCentralError=error.message;}
  finally{if(session===googleSession){googleCentralBusy=false;googleRenderCentralData();}}
}
async function googleLoadMore(){
  if(googleCentralBusy||googlePageBusy||googleNextCursor===null||!googleUser)return;
  const session=googleSession,cursor=googleNextCursor;
  googlePageBusy=true;
  googlePageError='';
  googleRenderCentralData();
  try{
    const page=await googleRpc('list',{cursor});
    if(session!==googleSession)return;
    if(!Array.isArray(page.items)||(page.nextCursor!==null&&
      (!Number.isInteger(page.nextCursor)||page.nextCursor>=cursor)))throw Error('A página recebida é inválida.');
    const items=new Map(googleCentralItems.map(record=>[record.id,record]));
    for(const record of page.items)if(!items.has(record.id))items.set(record.id,record);
    googleCentralItems=[...items.values()];
    googleNextCursor=page.nextCursor;
  }catch(error){if(session===googleSession)googlePageError=error.message;}
  finally{if(session===googleSession){googlePageBusy=false;googleRenderCentralData();}}
}
function googleMoreButton(){
  return `<div class="central-pagination">
    ${googleNextCursor!==null?`<button type="button" data-action="googleLoadMore" class="btn tiny"
      aria-disabled="${googlePageBusy||googleCentralBusy}">${googlePageBusy?'Carregando…':'Carregar mais inspeções'}</button>`:''}
    <p class="small" role="status">${esc(googlePageError)}</p></div>`;
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
    ${googleMoreButton()}</section>`;
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
  if(/última medição (corrente|temperatura)/i.test(message)){
    return 'Se a medição não aconteceu, deixe o campo em branco. Se houve medição, informe o número. Na inspeção arquivada, use Reprocessar ativos após atualizar o Apps Script.';
  }
  if(/modelo divergente/i.test(message)){
    return 'Compare o modelo registrado com a etiqueta. Se houve troca de equipamento, encaminhe a divergência à Gestão.';
  }
  if(/fabricante divergente/i.test(message)){
    return 'Abra a comparação. Confira modelo, série ou patrimônio com a etiqueta. Se a identidade for única, a Gestão pode manter o fabricante cadastrado ao confirmar o vínculo.';
  }
  if(/mais de um equipamento|informe número de série ou patrimônio/i.test(message)){
    return 'Compare as linhas do POP pela série ou pelo patrimônio. O mesmo modelo pode constar em vários equipamentos.';
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
function assetAdjustmentForm(adjustment){
  if(!adjustment||googleUser?.role!=='GESTAO'||!googleCapabilities.assetAdjustments)return '';
  const identity=adjustment.type==='identity';
  return `<details class="asset-adjustment"><summary>Ajustar pendência</summary>
    <form data-asset-adjustment="${esc(adjustment.token)}">
      <p class="small muted">${esc(adjustment.asset)} · O ajuste fica no histórico da vistoria.</p>
      ${identity?`<div class="asset-adjustment-fields">
        <label>Número de série <input name="serial" value="${esc(adjustment.serial)}" maxlength="80"></label>
        <label>Patrimônio <input name="patr" value="${esc(adjustment.patr)}" maxlength="80"></label></div>
        <p class="small muted">Use a etiqueta para identificar uma unidade já cadastrada neste POP.</p>`
      :`<label>${esc(adjustment.field)} <input name="value" value="${esc(adjustment.value)}" maxlength="60" required></label>
        ${adjustment.optional?'<label class="asset-adjustment-choice"><input type="checkbox" name="notMeasured"> Medição não realizada</label>':''}`}
      <label>Motivo do ajuste <input name="reason" required minlength="5" maxlength="300"></label>
      <button class="btn primary tiny" type="submit">Salvar ajuste</button><p class="small" role="status"></p>
    </form></details>`;
}

async function googleShowAssetIssues(id){
  const session=googleSession;
  const {dialog,content}=openGoogleAssetDialog('Pendências de conferência',id,'Carregando pendências…');
  dialog.classList.add('asset-review-dialog','inspection-review-panel');
  content.removeAttribute('aria-live');
  const active=()=>session===googleSession&&dialog.open;
  async function refresh(saved=false){
    const result=await googleRpc('assetIssues',{inspectionId:id});
    if(!active())return;
    if(!Array.isArray(result.issues))throw Error('A resposta do serviço não trouxe os detalhes das pendências.');
    const tabs=new Map();
    const names={Ativos:'Inventário de ativos',Climatização_Voanet:'Climatização',Controle_Baterias:'Baterias',Retificadores:'Retificadores'};
    for(const entry of result.issues){
      const title=names[entry.tab]||entry.tab||'Conferência de inventário';
      if(!tabs.has(title))tabs.set(title,[]);
      tabs.get(title).push(entry);
    }
    const actions=tabs.size&&googleUser?.role==='GESTAO'&&googleCapabilities.assetReconciliation
      ? button('googleCompare:'+id,'Conferir com a base central','primary tiny'):'';
    const update=tabs.size&&googleUser?.role==='GESTAO'&&!googleCapabilities.assetAdjustments
      ? '<p class="small muted">O ajuste nesta tela fica disponível após atualizar a implantação do Apps Script.</p>':'';
    const sections=[...tabs].map(([title,items])=>`<section class="asset-review-group"><div class="asset-review-group-title"><h3>${esc(title)}</h3><span aria-hidden="true">${items.length}</span></div>
      <ul>${items.map(({detail,adjustment})=>{
        const guidance=assetIssueGuidance(detail);
        return `<li><p class="asset-review-detail">${esc(detail)}</p>${assetAdjustmentForm(adjustment)||
          (guidance?`<p class="asset-issue-guidance">${esc(guidance)}</p>`:'')}</li>`;
      }).join('')}</ul></section>`).join('');
    const count=result.issues.length;
    const actionable=googleUser?.role==='GESTAO'&&googleCapabilities.assetAdjustments?
      result.issues.filter(entry=>entry.adjustment).length:0;
    const outcome=saved?'Ajuste salvo. ':'';
    content.innerHTML=`<div class="asset-review-summary"><div><p tabindex="-1" id="asset-remaining" role="status">${outcome}${count
      ? count+(count===1?' pendência para revisar.':' pendências para revisar.'):'Sem pendências nesta versão.'}</p>
      ${actionable>0?`<p class="inspection-review-actionable">${actionable===1?'1 pendência com ajuste disponível':actionable+' pendências com ajuste disponível'}</p>`:''}</div>${actions}</div>
      ${update}${sections}`;
    if(saved)content.querySelector('#asset-remaining').focus();
  }

  dialog.addEventListener('change',event=>{
    if(event.target.name!=='notMeasured')return;
    const value=event.target.form.elements.value;
    value.disabled=event.target.checked;
    value.required=!event.target.checked;
  });
  dialog.addEventListener('submit',async event=>{
    const form=event.target;
    if(!form.dataset.assetAdjustment)return;
    event.preventDefault();
    const submit=form.querySelector('button'),status=form.querySelector('[role="status"]'),fields=new FormData(form);
    if(submit.disabled||!active())return;
    submit.disabled=true;
    status.textContent='Salvando ajuste…';
    try{
      await googleRpc('applyAssetAdjustment',{inspectionId:id,adjustmentToken:form.dataset.assetAdjustment,
        reason:fields.get('reason'),value:fields.get('value'),serial:fields.get('serial'),patr:fields.get('patr'),
        notMeasured:fields.has('notMeasured')});
    }catch(error){
      if(active()){status.textContent=error.message;submit.disabled=false;}
      return;
    }
    if(session!==googleSession)return;
    googleRefreshCentral();
    if(!active())return;
    try{await refresh(true);}
    catch(_){if(active())status.textContent='Ajuste salvo. Reabra a lista para consultar as outras pendências.';}
  });
  try{await refresh();}
  catch(error){if(active())content.innerHTML=`<p role="alert">${esc(error.message)}</p>`;}
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
  const values=[item.station,item.equipment||item.name,item.maker,item.model,item.serial,item.patr,
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
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Origem</th><th>Estação</th><th>Equipamento</th><th>Fabricante</th><th>Modelo</th><th>Série</th><th>Patrimônio</th><th>Qtd.</th><th>Carga de gás</th><th>Instalação</th></tr></thead>
      <tbody><tr><th scope="row">Vistoria</th>${assetComparisonCells(item)}</tr>
      ${item.matches.map((match,index)=>`<tr><th scope="row">${match.rowNumber?'Linha '+esc(match.rowNumber):'Cadastro '+(index+1)}</th>${assetComparisonCells(match)}</tr>`).join('')
        ||'<tr><td colspan="10">Nenhum cadastro semelhante encontrado.</td></tr>'}</tbody></table></div>
      ${item.matchCount>item.matches.length?`<p class="small muted">Exibindo ${item.matches.length} de ${item.matchCount} cadastros, priorizados pela identificação.</p>`:''}
      ${item.matches.map((match,index)=>`<p><strong>${match.rowNumber?'Linha '+esc(match.rowNumber):'Cadastro '+(index+1)}</strong> ·
        ${esc([...match.basis,match.makerDiff&&'Fabricante divergente',match.categoryDiff&&'Categoria divergente',match.serialDiff&&'Série divergente',match.patrDiff&&'Patrimônio divergente',match.otherStation&&'Outra estação'].filter(Boolean).join(' · '))}</p>
        ${match.operation?`<details class="archived-pdf"><summary>${match.operation==='replace'?'Confirmar substituição':match.operation==='keepMaker'?'Vincular e manter fabricante da base':'Vincular ao mesmo equipamento'}</summary>
        <form data-asset-decision="${esc(match.token)}">
          <p class="small muted">${match.operation==='replace'?'Confirme pela etiqueta ou ordem de serviço antes de atualizar a série. A identificação anterior fica no histórico.':match.operation==='keepMaker'?'Confira a identidade pela etiqueta. A decisão preserva o fabricante cadastrado e fica no histórico.':'Confirme os dados de identificação antes de atualizar a linha indicada.'}</p>
          <label>Motivo da decisão <input name="reason" required minlength="5" maxlength="300"></label>
          <button class="btn primary tiny" type="submit">Salvar decisão</button><p role="status"></p>
        </form></details>`:''}`).join('')}</section>`).join(''):'<p>Nenhuma pendência com equipamento identificável para comparar nesta vistoria.</p>';
    if(!googleCapabilities.assetComparisonV2){
      content.insertAdjacentHTML('afterbegin','<p class="notice">A comparação por modelos semelhantes e fabricante divergente fica disponível após atualizar o Apps Script.</p>');
    }
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
