'use strict';

const FTTX_FIBERS=[6,12,24,36,48,72];
const FTTX_STEPS=[
  ['Lançamento','fttx-project-heading'],
  ['CTO','fttx-cto-heading'],
  ['CEO / CEP','fttx-box-heading'],
  ['Revisão e exportação','fttx-list-heading']
];
const FTTX_CABLE_FIELDS=[['meters','Cabo lançado (m)'],['cto','CTOs comuns'],['endCto','CTOs de ponta'],['ceo','CEOs']];
const FTTX_ROUTE_FIELDS=[
  ['poles','Postes no trajeto','Conte cada poste uma vez. O sistema inclui uma plaqueta de cabo por poste.'],
  ['asPoles','Postes com cabo AS','Conte os postes com cabo autossustentado (AS). O sistema inclui uma abraçadeira BAP por poste.']
];
const FTTX_ROUTE_DETAILS=[
  ['guidePoles','Postes com guia, sem CTO e sem BAP','Inclui 2 anéis guia e 1,5 m de fita de aço por poste informado.'],
  ['dielectricGroups','Grupos de três postes aptos para dielétrico','Informe um grupo por suporte, com olhal nas pontas e dielétrico no meio. Confira curvas, vegetação e vãos longos.'],
  ['extraEyelets','Olhais adicionais','Some os demais olhais nas curvas, cruzamentos, ancoragens e pontas dos grupos. O olhal básico de cada poste com CTO entra automaticamente.'],
  ['bolt','Parafusos','Informe quantos serão usados na montagem prevista.'],
  ['bapSupport','Suportes para BAP','Conte os suportes conforme os pontos de fixação do trajeto.'],
  ['loopSmall','Alças pré-formadas de 06 a 12 FO','Some as alças previstas para cabos de 6 a 12 fibras.'],
  ['loop24','Alças pré-formadas de 24 FO','Some as alças previstas para cabo de 24 fibras.'],
  ['loop36','Alças pré-formadas de 36 FO','Some as alças previstas para cabo de 36 fibras.'],
  ['loop48','Alças pré-formadas de 48 FO','Some as alças previstas para cabo de 48 fibras.'],
  ['loop72','Alças pré-formadas de 72 FO','Some as alças previstas para cabo de 72 fibras.']
];
const FTTX_CTO_MODELS=[
  ['cto8','CTO 1:8 (8 portas)',8,false],
  ['cto16','CTO 1:16 (16 portas)',16,false],
  ['cto24','CTO 1:24 (24 portas)',24,false],
  ['ctoPre8','CTO pré-conectorizada 1:8',8,true],
  ['ctoPre16','CTO pré-conectorizada 1:16',16,true]
];
const FTTX_CEO_MODELS=[
  ['ceo24','CEO 24 FO'],
  ['ceo48','CEO 48 FO'],
  ['ceo72','CEO 72 FO'],
  ['ceo144','CEO 144 FO']
];
const FTTX_SPLITTERS_CONNECTORIZED=[
  ['splitConn2','Splitter 1:2 conectorizado SC/APC',3],
  ['splitConn4','Splitter 1:4 conectorizado SC/APC',5],
  ['splitConn8','Splitter 1:8 conectorizado SC/APC',9],
  ['splitConn16','Splitter 1:16 conectorizado SC/APC',17],
  ['splitConn32','Splitter 1:32 conectorizado SC/APC',33]
];
const FTTX_SPLITTERS_BARE=[
  ['split2','Splitter 1:2 sem conector',3],
  ['split4','Splitter 1:4 sem conector',5],
  ['split8','Splitter 1:8 sem conector',9],
  ['split16','Splitter 1:16 sem conector',17],
  ['split32','Splitter 1:32 sem conector',33]
];
const FTTX_UNBALANCED_RATIOS=['5/95','10/90','15/85','20/80','30/70','40/60','50/50'];
const FTTX_SPLITTERS_UNBALANCED_BARE=FTTX_UNBALANCED_RATIOS.map(ratio=>[
  'splitUnb'+ratio.split('/')[0],`Splitter desbalanceado ${ratio} sem conector`,3
]);
const FTTX_SPLITTERS_UNBALANCED_CONN=FTTX_UNBALANCED_RATIOS.map(ratio=>[
  'splitUnbConn'+ratio.split('/')[0],`Splitter desbalanceado ${ratio} conectorizado SC/APC`,3
]);
const FTTX_BOX_FIELDS=[
  ['cep','CEPs','Informe as caixas de emenda de passagem previstas.'],
  ['tray','Bandejas de emenda','Some as bandejas previstas nas caixas.'],
  ['strand','Cordoalha medida no projeto (m)','Estime a metragem no traçado considerando os pontos previstos a cada 100 m.'],
  ['sleeve','Tubetes protetores de emenda','Conte os protetores das emendas previstas (ou use o atalho de estimativa).'],
  ['blanket','Mantas para CEO','Some as mantas previstas para as caixas de emenda.']
];
const fttxQuantityFormat=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const fttxCurrency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fttxUnitPrice=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:4});
let fttxDraft={},fttxDraftKey='',fttxSaveError=false;
let fttxReferences={},fttxReferenceStatus='Consultando referências públicas…';

function fttxQuantity(value,decimal=false){
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0)return 0;
  return decimal?Math.round((number+Number.EPSILON)*100)/100:Math.floor(number);
}

function fttxEstimatedSleeves(draft){
  const get=field=>fttxQuantity(draft[field]);
  const ceoTotal=FTTX_FIBERS.reduce((sum,fibers)=>sum+fttxQuantity(draft.cables?.[fibers]?.ceo),0);
  const ctoTotal=FTTX_FIBERS.reduce((sum,fibers)=>sum+fttxQuantity(draft.cables?.[fibers]?.cto)+fttxQuantity(draft.cables?.[fibers]?.endCto),0);
  const preCto=get('ctoPre8')+get('ctoPre16');
  const bareSplitSplices=[...FTTX_SPLITTERS_BARE,...FTTX_SPLITTERS_UNBALANCED_BARE]
    .reduce((sum,[field,,splices])=>sum+get(field)*splices,0);
  const conventionalCto=Math.max(0,ctoTotal-preCto);
  return bareSplitSplices+12*ceoTotal+2*conventionalCto;
}

function calculateFttx(draft){
  let ctoTotal=0,ceoTotal=0,cableTotal=0,reserveTotal=0,routeTotal=0;
  const cables=FTTX_FIBERS.map(fibers=>{
    const row=draft.cables?.[fibers]||{};
    const meters=fttxQuantity(row.meters,true),cto=fttxQuantity(row.cto),endCto=fttxQuantity(row.endCto),ceo=fttxQuantity(row.ceo);
    const ctoReserve=22*cto+12.5*endCto,ceoReserve=20*ceo,routeReserve=50*Math.floor(meters/500);
    const reserve=ctoReserve+ceoReserve+routeReserve;
    const total=fttxQuantity(meters+reserve,true);
    ctoTotal+=cto+endCto;
    ceoTotal+=ceo;
    routeTotal+=meters;
    reserveTotal+=reserve;
    cableTotal+=total;
    return {fibers,meters,ctoReserve,ceoReserve,routeReserve,reserve,total};
  });
  const get=(field,decimal)=>fttxQuantity(draft[field],decimal);
  const cep=get('cep'),guidePoles=get('guidePoles'),poles=get('poles'),ctoPoles=get('ctoPoles'),asPoles=get('asPoles');

  const ctoBreakdown=FTTX_CTO_MODELS.map(([field,label,ports,pre])=>({field,label,ports,pre,qty:get(field)}));
  const ctoTypedTotal=ctoBreakdown.reduce((sum,entry)=>sum+entry.qty,0);
  const ctoPorts=ctoBreakdown.reduce((sum,entry)=>sum+entry.qty*entry.ports,0);
  const ctoAssembly=draft.ctoAssembly==='vazia'?'vazia':'montada';
  const ctoItems=[];
  if(ctoTypedTotal>0){
    for(const entry of ctoBreakdown)ctoItems.push([entry.label,'un',entry.qty]);
    if(ctoAssembly==='vazia'){
      const cto8Qty=get('cto8'),cto16Qty=get('cto16'),cto24Qty=get('cto24');
      if(cto8Qty>0)ctoItems.push(['Splitter 1:8 conectorizado SC/APC','un',cto8Qty]);
      if(cto16Qty>0)ctoItems.push(['Splitter 1:16 conectorizado SC/APC','un',cto16Qty]);
      const adapters=8*cto8Qty+16*cto16Qty+24*cto24Qty;
      if(adapters>0)ctoItems.push(['Adaptador SC/APC','un',adapters]);
    }
  }else{
    ctoItems.push(['CTO','un',ctoTotal]);
  }

  const ceoBreakdown=FTTX_CEO_MODELS.map(([field,label])=>({field,label,qty:get(field)}));
  const ceoTypedTotal=ceoBreakdown.reduce((sum,entry)=>sum+entry.qty,0);
  const ceoItems=ceoTypedTotal>0
    ? ceoBreakdown.map(entry=>[entry.label,'un',entry.qty])
    : [['CEO','un',ceoTotal]];

  const splitterItems=[
    ...FTTX_SPLITTERS_CONNECTORIZED.map(([field,label])=>[label,'un',get(field)]),
    ...FTTX_SPLITTERS_BARE.map(([field,label])=>[label,'un',get(field)]),
    ...FTTX_SPLITTERS_UNBALANCED_CONN.map(([field,label])=>[label,'un',get(field)]),
    ...FTTX_SPLITTERS_UNBALANCED_BARE.map(([field,label])=>[label,'un',get(field)])
  ];

  const groups=[
    {title:'Lançamento',items:[
      ...cables.map(c=>['Cabo óptico '+String(c.fibers).padStart(2,'0')+' FO','m',c.total]),
      ['Olhal reto M12','un',ctoPoles+get('extraEyelets')],
      ['Parafuso','un',get('bolt')],
      ['Suporte para BAP','un',get('bapSupport')],
      ['Alça pré-formada para cabo de 06 a 12 FO','un',get('loopSmall')],
      ['Alça pré-formada para cabo de 24 FO','un',get('loop24')],
      ['Alça pré-formada para cabo de 36 FO','un',get('loop36')],
      ['Alça pré-formada para cabo de 48 FO','un',get('loop48')],
      ['Alça pré-formada para cabo de 72 FO','un',get('loop72')],
      ['Suporte dielétrico','un',get('dielectricGroups')],
      ['Plaqueta de identificação do cabo','un',poles],
      ['Anel guia AGFE para postes sem CTO e sem BAP','un',2*guidePoles],
      ['Fita de aço 3/4″ para postes sem CTO e sem BAP','m',1.5*guidePoles],
      ['Abraçadeira BAP','un',asPoles]
    ]},
    {title:'Montagem de CTO',items:[
      ...ctoItems,
      ['Plaqueta de CTO','un',ctoTotal],
      ['Fita de aço 3/4″','m',3*ctoTotal],
      ['Fecho de aço 3/4″','un',2*ctoTotal],
      ['Anel guia AGFE','un',6*ctoTotal]
    ]},
    {title:'Montagem de CEO / CEP e Splitters',items:[
      ...ceoItems,['CEP','un',cep],['Bandeja de caixa de emenda','un',get('tray')],
      ...splitterItems,
      ['Alça pré-formada para cordoalha','un',2*ceoTotal],
      ['Conjunto de reserva técnica para caixa de emenda','un',ceoTotal+cep],
      ['Cordoalha','m',get('strand',true)],['Plaqueta de caixa de emenda','un',ceoTotal+cep],
      ['Tubete protetor de emenda','un',get('sleeve')],['Manta para CEO','un',get('blanket')]
    ]},
    ...FTTX_CATALOG.map(([title,items])=>({title,items:items.map(([name,unit])=>[name,unit,getExtra(name,unit)])}))
  ].map(group=>({...group,items:group.items.filter(item=>item[2]>0)}));
  function getExtra(name,unit){return fttxQuantity(draft.extras?.[name],unit!=='un');}
  const issues=[];
  if(Math.max(asPoles,ctoPoles,guidePoles)>poles||guidePoles+Math.max(asPoles,ctoPoles)>poles){
    issues.push({step:1,text:'Confira os totais. Os postes com CTO, cabo AS ou guia precisam caber no total de postes do trajeto.'});
  }
  if(ctoTotal&&(!ctoPoles||ctoPoles>ctoTotal)){
    issues.push({step:2,text:'Informe de 1 a '+ctoTotal+' postes com CTO. Se for uma caixa por poste, use o atalho na etapa CTO.'});
  }else if(ctoPoles&&!ctoTotal){
    issues.push({step:2,text:'Informe quantas CTOs comuns e de ponta há em cada bitola.'});
  }
  if(ctoTypedTotal>0&&ctoTypedTotal!==ctoTotal){
    issues.push({step:2,text:`A soma das CTOs por capacidade (${ctoTypedTotal}) precisa coincidir com o total de CTOs do trajeto (${ctoTotal}).`});
  }
  if(ceoTypedTotal>0&&ceoTypedTotal!==ceoTotal){
    issues.push({step:3,text:`A soma das CEOs por capacidade (${ceoTypedTotal}) precisa coincidir com o total de CEOs do trajeto (${ceoTotal}).`});
  }
  if(get('dielectricGroups')&&poles<3){
    issues.push({step:1,text:'Confira os suportes dielétricos. Cada grupo informado precisa de pelo menos três postes no trajeto.'});
  }
  return {
    cables,groups,ctoTotal,ceoTotal,ctoPorts,
    cableTotal:fttxQuantity(cableTotal,true),reserveTotal,routeTotal:fttxQuantity(routeTotal,true),
    issues,alerts:issues.map(issue=>issue.text)
  };
}

function loadFttxDraft(){
  const key='voanet_fttx_draft_'+encodeURIComponent(googleUser?.email||'local');
  if(key!==fttxDraftKey){
    fttxDraftKey=key;
    fttxSaveError=false;
    try{fttxDraft=JSON.parse(localStorage.getItem(key)||'{}')||{};}
    catch(_){fttxDraft={};fttxSaveError=true;}
  }
}

function openFttx(){
  if(!managementRoles.has(effectiveHomeRole()))return;
  loadFttxDraft();
  navigate('fttx');
  loadFttxReferences();
}

function mountFttx(pane){
  loadFttxDraft();
  pane.innerHTML=renderFttx();
  loadFttxReferences();
}

function fttxActive(){
  return isGoogleMode()
    ? googleUser?.role==='GESTAO'&&document.getElementById('portal-fttx-pane')?.hidden===false
    : view==='fttx';
}

async function loadFttxReferences(){
  try{
    const response=await fetch('./fttx-prices.json',{cache:'no-cache'});
    if(!response.ok)throw Error('Referências indisponíveis.');
    const {references}=await response.json();
    fttxReferences=references||{};
    fttxReferenceStatus='Referências públicas consultadas automaticamente. O almoxarifado confirma os preços de compra.';
  }catch(_){
    fttxReferenceStatus='Referências públicas indisponíveis nesta consulta. Você pode informar preços estimados.';
  }
  if(fttxActive())updateFttxResults();
}

function fttxMaterialKey(name){
  return name.replace(' para postes sem CTO e sem BAP','');
}

function fttxLookupReference(key){
  if(fttxReferences[key])return fttxReferences[key];
  const bareSplitter=key.match(/^(Splitter 1:(?:2|8|16)) sem conector$/);
  if(bareSplitter&&fttxReferences[bareSplitter[1]])return fttxReferences[bareSplitter[1]];
  if(key==='CEO 24 FO'&&fttxReferences['CEO'])return fttxReferences['CEO'];
  if(key==='CTO 1:16 (16 portas)'&&fttxDraft.ctoAssembly==='vazia'&&fttxReferences['CTO'])return fttxReferences['CTO'];
  return null;
}

function fttxEstimate(name,quantity){
  const key=fttxMaterialKey(name),manual=fttxDraft.prices?.[key],reference=fttxLookupReference(key);
  if(manual!==undefined&&manual!==''&&Number.isFinite(Number(manual))&&Number(manual)>=0){
    const unit=Number(manual);
    return {unit,cents:Math.round(quantity*unit*100),source:'Estimativa manual'};
  }
  if(reference&&Number.isFinite(reference.price)&&reference.price>0){
    return {unit:reference.price,cents:Math.round(quantity*reference.price*100),source:reference.store,reference};
  }
  return {unit:null,cents:null,source:'Sem referência'};
}

function fttxPriceTable(groups){
  const materials=new Map();
  for(const {items} of groups){
    for(const [name,unit,qty] of items){
      const key=fttxMaterialKey(name),previous=materials.get(key);
      const {cents}=fttxEstimate(name,qty);
      materials.set(key,{unit,qty:(previous?.qty??0)+qty,cents:cents===null?null:(previous?.cents??0)+cents});
    }
  }
  if(!materials.size)return '';
  let missing=0,cents=0;
  const rows=[...materials].map(([name,{unit,qty,cents:lineCents}])=>{
    const quote=fttxEstimate(name,qty);
    quote.cents=lineCents;
    if(quote.cents===null)missing++;
    else cents+=quote.cents;
    const {reference}=quote;
    const source=reference&&/^https:\/\//.test(reference.url)
      ? `<a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">${esc(reference.store)}</a>
        <div class="small muted">${esc(reference.details||'')} · ${esc(fmt(reference.checkedOn))}</div>`
      : `<span>${esc(quote.source)}</span>`;
    return `<tr role="row"><th role="rowheader" scope="row">${esc(name)}</th><td role="cell">${fttxCellLabel('Quantidade')}${fttxQuantityFormat.format(qty)} ${unit}</td>
      <td role="cell">${fttxCellLabel('Preço unitário')}<input type="number" min="0" step="0.0001" inputmode="decimal" class="fttx-price-input"
        aria-label="Preço unitário de ${esc(name)}" data-fttx-price="${esc(name)}"
        value="${esc(fttxDraft.prices?.[name]??'')}" placeholder="${quote.unit===null?'—':fttxUnitPrice.format(quote.unit)}"></td>
      <td role="cell" data-fttx-price-result>${fttxCellLabel('Subtotal')}<strong>${quote.cents===null?'—':fttxCurrency.format(quote.cents/100)}</strong></td>
      <td role="cell" data-fttx-price-result>${fttxCellLabel('Origem')}${source}</td></tr>`;
  }).join('');
  return `<details class="fttx-prices" ${fttxPriceOpen?'open':''}><summary id="fttx-prices-editor">Estimativa de materiais · ${cents||missing<materials.size?fttxCurrency.format(cents/100):'sem valores'}</summary>
    <p class="small muted">${fttxReferenceStatus} O valor digitado substitui a referência pública.</p>
    <div data-fttx-price-result>${missing?`<p class="fttx-alert">${missing} de ${materials.size} materiais sem preço. O subtotal cobre os itens com valor informado.</p>`:''}</div>
    <div class="table-scroll fttx-review-table"><table class="data-table fttx-price-table" role="table" aria-label="Preços de materiais">
      <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Material</th><th role="columnheader" scope="col">Quantidade</th><th role="columnheader" scope="col">Preço unitário</th><th role="columnheader" scope="col">Subtotal</th><th role="columnheader" scope="col">Origem</th></tr></thead>
      <tbody role="rowgroup">${rows}</tbody></table></div></details>`;
}

let fttxPriceOpen=true;
function updateFttxPrices(){
  const current=document.querySelector('.fttx-prices');
  if(!current)return;
  const next=document.createElement('template');
  const result=calculateFttx(fttxDraft);
  next.innerHTML=fttxResults(result);
  const selector='summary,[data-fttx-price-result]';
  const fresh=next.content.querySelector('.fttx-prices').querySelectorAll(selector);
  current.querySelectorAll(selector).forEach((node,index)=>node.replaceChildren(...fresh[index].childNodes));
  const inputs=next.content.querySelectorAll('[data-fttx-price]');
  current.querySelectorAll('[data-fttx-price]').forEach((node,index)=>{node.placeholder=inputs[index].placeholder;});
  updateFttxOverview(result);
  for(const selector of ['#fttx-cost-summary','.fttx-materials']){
    const fresh=next.content.querySelectorAll(selector);
    document.querySelectorAll(selector).forEach((node,index)=>node.replaceWith(fresh[index]));
  }
}

function currentFttxStep(){
  return [1,2,3,4].includes(fttxDraft.step)?fttxDraft.step:1;
}

function fttxOverview(result){
  const {items,missing,subtotal}=fttxCostRows(result.groups);
  const meters=value=>fttxQuantityFormat.format(value)+' m';
  return `<dl class="fttx-overview">
    <div><dt>Trajeto</dt><dd>${meters(result.routeTotal)}</dd>${result.ctoPorts>0?`<small>${fttxQuantityFormat.format(result.ctoPorts)} portas CTO</small>`:''}</div>
    <div><dt>Cabo com reserva</dt><dd>${meters(result.cableTotal)}</dd></div>
    <div><dt>Estimativa de materiais</dt><dd>${subtotal===null?'—':fttxCurrency.format(subtotal)}</dd>
    ${items.length&&missing?`<small>${missing} de ${items.length} linhas sem preço</small>`:''}</div>
  </dl>`;
}

function updateFttxOverview(result){
  const overview=document.getElementById('fttx-overview');
  if(overview)overview.innerHTML=fttxOverview(result);
  const portsBadge=document.getElementById('fttx-cto-ports-badge');
  if(portsBadge){
    portsBadge.hidden=result.ctoPorts<=0;
    portsBadge.textContent=`Capacidade planejada: ${fttxQuantityFormat.format(result.ctoPorts)} portas de atendimento`;
  }
}

function fttxIssues(result,step){
  const issues=step===4?result.issues:result.issues.filter(issue=>issue.step===step);
  if(!issues.length)return '';
  return `<div class="fttx-alert"><strong>${step===4?'Ajuste os campos indicados para exportar':'Confira nesta etapa'}</strong>
    <ul>${issues.map(({text,step:target})=>`<li>${text}
    ${step===4?`<button type="button" class="btn tiny" data-fttx-step="${target}">Revisar ${FTTX_STEPS[target-1][0]}</button>`:''}
    </li>`).join('')}</ul></div>`;
}

function fttxExtrasListHtml(){
  const entries=Object.entries(fttxDraft.extras||{}).filter(([,qty])=>Number(qty)>0);
  if(!entries.length)return '';
  const unitMap=new Map(FTTX_CATALOG.flatMap(([,items])=>items));
  return `<ul class="fttx-extras-list" aria-label="Materiais complementares adicionados">${entries.map(([name,qty])=>`<li>
    <span><strong>${esc(name)}</strong> · ${fttxQuantityFormat.format(Number(qty))} ${unitMap.get(name)||'un'}</span>
    <button type="button" class="btn danger tiny" data-fttx-remove-extra="${esc(name)}">Remover</button>
  </li>`).join('')}</ul>`;
}

function updateFttxResults(){
  const result=calculateFttx(fttxDraft);
  updateFttxOverview(result);
  document.querySelectorAll('[data-fttx-issues]').forEach(target=>{
    const message=fttxIssues(result,Number(target.dataset.fttxIssues));
    if(target.innerHTML!==message)target.innerHTML=message;
  });
  const extrasNode=document.getElementById('fttx-extras-list');
  if(extrasNode)extrasNode.innerHTML=fttxExtrasListHtml();
  if(currentFttxStep()!==4)return;
  const target=document.getElementById('fttx-results');
  if(!target)return;
  fttxPriceOpen=target.querySelector('.fttx-prices')?.open??fttxPriceOpen;
  target.innerHTML=fttxResults(result);
  const disabled=result.alerts.length>0||!result.groups.some(group=>group.items.length);
  document.querySelectorAll('[data-fttx-export]').forEach(button=>{button.disabled=disabled;});
}

function goFttxStep(step){
  const [label,headingId]=FTTX_STEPS[step-1];
  const heading=document.getElementById(headingId);
  fttxDraft.step=step;
  document.querySelectorAll('[data-fttx-panel]').forEach(panel=>{
    panel.hidden=Number(panel.dataset.fttxPanel)!==step;
  });
  document.querySelectorAll('.fttx-navigation [data-fttx-step]').forEach(button=>{
    if(Number(button.dataset.fttxStep)===step)button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  });
  document.getElementById('fttx-step-status').textContent=`Etapa ${step} de ${FTTX_STEPS.length} · ${label}`;
  if((step===2||step===3)&&FTTX_FIBERS.some(fibers=>fibers!==12&&fttxQuantity(fttxDraft.cables?.[fibers]?.meters,true)>0)){
    heading.closest('[data-fttx-panel]').querySelector('[data-fttx-other-cables]').open=true;
  }
  persistFttx();
  updateFttxResults();
  heading.focus({preventScroll:true});
  document.getElementById('fttx-overview').scrollIntoView({block:'start'});
}

function fttxStepActions(step){
  const next=['','Continuar para CTO','Continuar para CEO / CEP','Revisar lista'];
  return `<div class="fttx-step-actions">
    ${step>1?`<button type="button" class="btn" data-fttx-step="${step-1}">Voltar</button>`:''}
    ${step<4?`<button type="button" class="btn primary" data-fttx-step="${step+1}">${next[step]} →</button>`:''}
  </div>`;
}

function fttxInput(field,label,help='',decimal=false){
  return `<div class="fttx-field"><label for="fttx-${field}">${label}</label><input id="fttx-${field}" type="number"
    min="0" step="${decimal?'0.01':'1'}" inputmode="${decimal?'decimal':'numeric'}"
    ${help?`aria-describedby="fttx-help-${field}"`:''} value="${esc(fttxDraft[field]??'')}" data-fttx-field="${field}" placeholder="0">
    ${help?`<small id="fttx-help-${field}">${help}</small>`:''}</div>`;
}

function fttxCableInputs(fields){
  const inputGroup=fibers=>{
    const bitola=String(fibers).padStart(2,'0')+' FO';
    return `<fieldset class="fttx-cable-group"><legend>${bitola}</legend><div class="fttx-cable-inputs">${fields.map(field=>{
      const label=FTTX_CABLE_FIELDS.find(([key])=>key===field)[1],decimal=field==='meters';
      return `<label class="fttx-field"><span>${label}</span><input type="number" min="0" step="${decimal?'0.01':'1'}"
        inputmode="${decimal?'decimal':'numeric'}" aria-label="${label} · ${bitola}" data-fttx-fiber="${fibers}"
        data-fttx-field="${field}" value="${esc(fttxDraft.cables?.[fibers]?.[field]??'')}" placeholder="0"></label>`;
    }).join('')}</div></fieldset>`;
  };
  const otherFibers=FTTX_FIBERS.filter(fibers=>fibers!==12);
  const expanded=otherFibers.some(fibers=>[...fields,'meters'].some(field=>fttxQuantity(fttxDraft.cables?.[fibers]?.[field],true)>0));
  return `${inputGroup(12)}<details class="fttx-options" data-fttx-other-cables ${expanded?'open':''}><summary>Outras bitolas · 06, 24, 36, 48 e 72 FO</summary>
    <div class="fttx-other-cables">${otherFibers.map(inputGroup).join('')}</div></details>`;
}

function fttxStep(number,id,title){
  return `<h2 id="${id}" tabindex="-1" class="fttx-step"><span aria-hidden="true">${number}</span>${title}</h2>`;
}

function fttxCatalogOptions(query=''){
  const search=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=search(query.trim());
  const options=FTTX_CATALOG.map(([group,items])=>{
    const matches=items.filter(([name])=>search(group+' '+name).includes(term));
    return matches.length?`<optgroup label="${group}">${matches.map(([name,unit])=>
      `<option value="${esc(name)}" data-unit="${unit}">${name} · ${unit}</option>`).join('')}</optgroup>`:'';
  }).join('');
  return `<option value="">${options?'Selecione um material':'Nenhum material encontrado'}</option>${options}`;
}

function fttxCellLabel(label){
  return `<span class="fttx-cell-label" aria-hidden="true">${label}</span>`;
}

function fttxResults({cables,groups}){
  const f=value=>fttxQuantityFormat.format(value);
  const shown=cables.filter(c=>c.total>0);
  const {items}=fttxCostRows(groups);
  const money=value=>value===null?'—':fttxCurrency.format(value);
  return `<div id="fttx-cost-summary" class="fttx-cost-summary">${fttxCostSummary(groups)}</div>
  ${shown.length?`<section class="fttx-reservation"><h3>Reserva por bitola</h3><div class="table-scroll fttx-review-table"><table class="data-table fttx-reserve-table" role="table" aria-label="Reserva por bitola">
    <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Bitola</th><th role="columnheader" scope="col">CTOs</th><th role="columnheader" scope="col">CEOs</th><th role="columnheader" scope="col">A cada 500 m</th><th role="columnheader" scope="col">Reserva</th><th role="columnheader" scope="col">Cabo total</th></tr></thead>
    <tbody role="rowgroup">${shown.map(c=>`<tr role="row"><th role="rowheader" scope="row">${String(c.fibers).padStart(2,'0')} FO</th>
      ${[['CTOs',c.ctoReserve],['CEOs',c.ceoReserve],['A cada 500 m',c.routeReserve],['Reserva',c.reserve],['Cabo total',c.total]]
        .map(([label,value])=>`<td role="cell">${fttxCellLabel(label)}${f(value)} m</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></section>`:''}
  ${items.length?groups.filter(group=>group.items.length).map(group=>{
    const rows=items.filter(item=>item.group===group.title);
    const priced=rows.filter(item=>item.subtotal!==null);
    const subtotal=priced.length?priced.reduce((sum,item)=>sum+Math.round(item.subtotal*100),0)/100:null;
    return `<section class="fttx-materials"><div class="fttx-stage-total"><h3>${group.title}</h3>
      <span>Subtotal estimado <strong>${money(subtotal)}</strong></span></div>
      <div class="table-scroll fttx-review-table"><table class="data-table fttx-budget-table" role="table" aria-label="${esc(group.title)}">
      <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Material</th><th role="columnheader" scope="col">Quantidade</th><th role="columnheader" scope="col">Preço unitário</th><th role="columnheader" scope="col">Subtotal</th></tr></thead>
      <tbody role="rowgroup">${rows.map(({name,unit,quantity,price,subtotal})=>`<tr role="row"><th role="rowheader" scope="row">${esc(name)}</th>
        <td role="cell">${fttxCellLabel('Quantidade')}<strong>${f(quantity)} ${unit}</strong></td>
        <td role="cell">${fttxCellLabel('Preço unitário')}${price===null?'—':fttxUnitPrice.format(price)}</td>
        <td role="cell">${fttxCellLabel('Subtotal')}${money(subtotal)}</td></tr>`).join('')}</tbody>
      </table></div></section>`;
  }).join(''):'<p class="muted">Preencha os dados do projeto para gerar a lista de materiais.</p>'}
  ${fttxPriceTable(groups)}`;
}

function renderFttx(){
  const result=calculateFttx(fttxDraft),step=currentFttxStep();
  const panel=number=>`class="card fttx-panel" data-fttx-panel="${number}" ${step!==number?'hidden':''}`;
  const issues=number=>`<div data-fttx-issues="${number}" role="status">${fttxIssues(result,number)}</div>`;
  const hasUnbalanced=[...FTTX_SPLITTERS_UNBALANCED_CONN,...FTTX_SPLITTERS_UNBALANCED_BARE].some(([field])=>fttxQuantity(fttxDraft[field])>0);
  const hasCeoModels=FTTX_CEO_MODELS.some(([field])=>fttxQuantity(fttxDraft[field])>0);
  return `<main class="shell fttx-shell">
    <header class="fttx-page-heading"><div><h1>Levantamento FTTx</h1>
      <p>Calcule a metragem, especifique CTOs, CEOs e splitters e prepare o levantamento para o almoxarifado.</p></div>
      <div class="btnrow"><button type="button" class="btn tiny danger" data-fttx-reset>Limpar levantamento</button>${isGoogleMode()?'':button('home','Voltar à Gestão','tiny')}</div></header>
    <div id="fttx-overview">${fttxOverview(result)}</div>
    <div class="fttx-workspace">
      <aside class="fttx-wizard" aria-label="Progresso do levantamento">
        <div class="fttx-wizard-head">
          <p id="fttx-step-status">Etapa ${step} de ${FTTX_STEPS.length} · ${FTTX_STEPS[step-1][0]}</p>
          <p class="small muted" id="fttx-save" role="status">${fttxSaveError?'Armazenamento local indisponível.':'Rascunho neste dispositivo'}</p>
        </div>
        <nav class="fttx-navigation" aria-label="Etapas do levantamento">
          ${FTTX_STEPS.map(([label],index)=>`<button type="button" class="btn tiny" data-fttx-step="${index+1}" aria-label="${label}"
            ${index+1===step?'aria-current="step"':''}><span aria-hidden="true">${index+1}</span>
            <b>${label}</b>${index===3?'<b class="fttx-short-name" aria-hidden="true">Revisão</b>':''}</button>`).join('')}
        </nav>
      </aside>
      <div class="fttx-step-content">
        <section ${panel(1)} aria-labelledby="fttx-project-heading">
          ${fttxStep(1,'fttx-project-heading','Lançamento de cabo e postes')}
          ${issues(1)}
          <p class="fttx-panel-description">Use as quantidades previstas no mapa ou no projeto. Deixe em branco as que ainda precisa confirmar.</p>
          <label class="fttx-field fttx-project"><span>Nome do projeto</span><input maxlength="100" data-fttx-field="name" placeholder="Ex.: Expansão Curralinho" value="${esc(fttxDraft.name??'')}"></label>
          <h3>Cabo por número de fibras (FO)</h3>
          <p class="small muted">Informe a metragem por bitola. O sistema calcula a reserva.</p>
          ${fttxCableInputs(['meters'])}
          <h3>Postes e abraçadeiras</h3>
          <div class="fttx-fields">${FTTX_ROUTE_FIELDS.map(([field,label,help])=>fttxInput(field,label,help)).join('')}</div>
          <button type="button" class="btn tiny fttx-suggestion" data-fttx-suggestion="asPoles">Usar todos os postes para cabo AS</button>
          <p class="small muted">Use esse atalho se o cabo AS passar em todos os postes do trecho. Você pode ajustar a quantidade depois.</p>
          <details class="fttx-options" ${FTTX_ROUTE_DETAILS.some(([key])=>fttxQuantity(fttxDraft[key])>0)?'open':''}>
            <summary>Detalhar ferragens e ancoragem</summary>
            <p class="small muted">Preencha os itens que já consegue estimar pelo traçado. Deixe os demais para a conferência de campo.</p>
            <div class="fttx-fields">${FTTX_ROUTE_DETAILS.map(([field,label,help])=>fttxInput(field,label,help)).join('')}</div>
          </details>
          ${fttxStepActions(1)}
        </section>
        <section ${panel(2)} aria-labelledby="fttx-cto-heading">
          ${fttxStep(2,'fttx-cto-heading','Montagem de CTO')}
          ${issues(2)}
          <p class="fttx-panel-description">Separe as caixas de atendimento comuns das de ponta na bitola do cabo que terá a reserva, e escolha os modelos de CTO abaixo.</p>
          ${fttxCableInputs(['cto','endCto'])}
          <div class="fttx-fields">${fttxInput('ctoPoles','Postes com CTO','Conte os postes distintos. Se duas caixas estiverem no mesmo poste, conte apenas um poste.')}</div>
          <button type="button" class="btn tiny fttx-suggestion" data-fttx-suggestion="ctoPoles">Estimar uma CTO por poste</button>
          <div class="fttx-subsection">
            <h3>Capacidade e modelo das CTOs</h3>
            <p class="small muted">Opcional: especifique quantas CTOs serão 1:8, 1:16, 1:24 ou pré-conectorizadas. A soma deve igualar o total de CTOs informadas acima.</p>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-cto-fill="cto8">Todas 1:8</button>
              <button type="button" class="btn tiny" data-fttx-cto-fill="cto16">Todas 1:16</button>
              <button type="button" class="btn tiny" data-fttx-cto-fill="ctoPre16">Todas pré-conectorizada 1:16</button>
              <span id="fttx-cto-ports-badge" class="fttx-ports-pill" ${result.ctoPorts>0?'':'hidden'}>Capacidade planejada: ${fttxQuantityFormat.format(result.ctoPorts)} portas de atendimento</span>
            </div>
            <div class="fttx-fields">
              ${FTTX_CTO_MODELS.map(([field,label])=>fttxInput(field,label)).join('')}
              <div class="fttx-field">
                <label for="fttx-ctoAssembly">Fornecimento das CTOs convencionais</label>
                <select id="fttx-ctoAssembly" data-fttx-field="ctoAssembly">
                  <option value="montada" ${fttxDraft.ctoAssembly!=='vazia'?'selected':''}>CTO já montada / equipada</option>
                  <option value="vazia" ${fttxDraft.ctoAssembly==='vazia'?'selected':''}>CTO vazia (incluir splitter SC/APC e adaptadores)</option>
                </select>
                <small>No modo vazia, CTO 1:8 e 1:16 somam automaticamente splitter conectorizado SC/APC e adaptadores SC/APC. Para CTO 1:24 vazia, informe os splitters desejados na etapa 3.</small>
              </div>
            </div>
          </div>
          <p class="small muted">Por caixa, o sistema inclui 1 plaqueta, 3 m de fita de aço, 2 fechos e 6 anéis guia. Também inclui 1 olhal básico por poste com CTO. A reserva é de 22 m por CTO comum e 12,5 m por CTO de ponta.</p>
          ${fttxStepActions(2)}
        </section>
        <section ${panel(3)} aria-labelledby="fttx-box-heading">
          ${fttxStep(3,'fttx-box-heading','Montagem de CEO / CEP e Splitters')}
          ${issues(3)}
          <p class="fttx-panel-description">Cada CEO soma 20 m de cabo na bitola indicada e 2 alças de cordoalha. Cada CEO ou CEP inclui 1 conjunto de reserva e 1 plaqueta.</p>
          ${fttxCableInputs(['ceo'])}
          <div class="fttx-fields">${fttxInput(...FTTX_BOX_FIELDS[0])}</div>
          <details class="fttx-options" ${hasCeoModels?'open':''}>
            <summary>Detalhar capacidade das CEOs (24, 48, 72 ou 144 FO)</summary>
            <p class="small muted">Opcional: distribua as CEOs por capacidade. Se deixar zerado, o levantamento lista como CEO padrão.</p>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-ceo-fill="ceo24">Todas 24 FO</button>
              <button type="button" class="btn tiny" data-fttx-ceo-fill="ceo48">Todas 48 FO</button>
            </div>
            <div class="fttx-fields">${FTTX_CEO_MODELS.map(([field,label])=>fttxInput(field,label)).join('')}</div>
          </details>
          <div class="fttx-subsection">
            <h3>Splitters de rede</h3>
            <p class="small muted">Informe os divisores ópticos necessários na distribuição (CEOs, DIOs ou CTOs sem inclusão automática).</p>
            <h4>Balanceados conectorizados SC/APC</h4>
            <div class="fttx-fields">${FTTX_SPLITTERS_CONNECTORIZED.map(([field,label])=>fttxInput(field,label)).join('')}</div>
            <h4>Balanceados sem conector (fusão)</h4>
            <div class="fttx-fields">${FTTX_SPLITTERS_BARE.map(([field,label])=>fttxInput(field,label)).join('')}</div>
            <details class="fttx-options" ${hasUnbalanced?'open':''}>
              <summary>Splitters desbalanceados (rede em cascata · 5/95 a 50/50)</summary>
              <h4>Desbalanceados conectorizados SC/APC</h4>
              <div class="fttx-fields">${FTTX_SPLITTERS_UNBALANCED_CONN.map(([field,label])=>fttxInput(field,label)).join('')}</div>
              <h4>Desbalanceados sem conector (fusão)</h4>
              <div class="fttx-fields">${FTTX_SPLITTERS_UNBALANCED_BARE.map(([field,label])=>fttxInput(field,label)).join('')}</div>
            </details>
          </div>
          <details class="fttx-options" ${FTTX_BOX_FIELDS.slice(1).some(([key])=>fttxQuantity(fttxDraft[key],true)>0)?'open':''}>
            <summary>Detalhar bandejas, cordoalha, tubetes e mantas</summary>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-suggestion="sleeve">Estimar tubetes pelas fusões</button>
            </div>
            <div class="fttx-fields">${FTTX_BOX_FIELDS.slice(1).map(([field,label,help])=>fttxInput(field,label,help,field==='strand')).join('')}</div>
          </details>
          ${fttxStepActions(3)}
        </section>
        <section ${panel(4)} aria-labelledby="fttx-list-heading">
          ${fttxStep(4,'fttx-list-heading','Lista para o almoxarifado')}
          <p class="fttx-panel-description">Revise as quantidades por etapa e ajuste os preços para baixar o levantamento preliminar.</p>
          <div class="fttx-export-bar">
            <div class="btnrow" aria-label="Exportar materiais">${[['pdf','Baixar PDF','primary'],['xlsx','Baixar Excel',''],['csv','Baixar CSV','']]
              .map(([format,label,style])=>`<button type="button" class="btn ${style}" data-fttx-export="${format}"
              ${result.alerts.length||!result.groups.some(group=>group.items.length)?'disabled':''}>${label}</button>`).join('')}</div>
            <p id="fttx-export-status" class="small muted fttx-export-status" role="status"></p>
          </div>
          ${issues(4)}
          <details class="fttx-options fttx-catalog" ${Object.keys(fttxDraft.extras||{}).length?'open':''}>
            <summary>Adicionar outros materiais do catálogo</summary>
            <form id="fttx-catalog-form" class="fttx-fields">
              <label class="fttx-field"><span>Buscar no catálogo</span><input type="search" id="fttx-search" placeholder="Ex.: DIO, OLT, drop ou microduto"></label>
              <label class="fttx-field"><span id="fttx-material-label">Material</span><select id="fttx-catalog-item" aria-labelledby="fttx-material-label" required>${fttxCatalogOptions()}</select></label>
              <label class="fttx-field"><span>Quantidade</span><input id="fttx-catalog-quantity" type="number" min="0" step="0.01" inputmode="decimal" required></label>
              <button class="btn" type="submit">Aplicar quantidade</button>
            </form>
            <p class="small muted" id="fttx-catalog-status" role="status">Informe zero ou clique em Remover para retirar um material complementar da lista.</p>
            <div id="fttx-extras-list">${fttxExtrasListHtml()}</div>
          </details>
          <details class="fttx-options">
            <summary>Ver um exemplo de cálculo da reserva</summary>
            <p class="small muted">Para 1.000 m de cabo de 12 FO, 2 CTOs comuns, 1 CTO de ponta e 1 CEO na mesma bitola, a reserva é de 176,5 m. São 100 m pelo trajeto, 44 m pelas CTOs comuns, 12,5 m pela CTO de ponta e 20 m pela CEO. O cabo previsto fica em 1.176,5 m.</p>
          </details>
          <div id="fttx-results">${step===4?fttxResults(result):''}</div>
          ${fttxStepActions(4)}
        </section>
      </div>
    </div>
  </main>`;
}

function persistFttx(){
  try{
    localStorage.setItem(fttxDraftKey,JSON.stringify(fttxDraft));
    fttxSaveError=false;
  }catch(_){fttxSaveError=true;}
  const status=document.getElementById('fttx-save');
  const message=fttxSaveError?'Não foi possível salvar o rascunho neste dispositivo.':'Rascunho salvo neste dispositivo';
  if(status&&status.textContent!==message)status.textContent=message;
}

function saveFttx(event){
  const input=event.target,field=input.dataset.fttxField;
  if(!field||!fttxActive())return;
  if(input.dataset.fttxFiber){
    fttxDraft.cables??={};
    (fttxDraft.cables[input.dataset.fttxFiber]??={})[field]=input.value;
  }else fttxDraft[field]=input.value;
  persistFttx();
  if(field==='name')return;
  updateFttxResults();
}

function fttxCostRows(groups){
  let cents=0,missing=0;
  const items=groups.flatMap(group=>group.items.map(([name,unit,quantity])=>{
    const quote=fttxEstimate(name,quantity);
    if(quote.cents===null)missing++;
    else cents+=quote.cents;
    const url=quote.reference?.url||'';
    return {group:group.title,name,unit,quantity,price:quote.unit,subtotal:quote.cents===null?null:quote.cents/100,
      source:quote.source,checkedOn:quote.reference?.checkedOn||'',url:/^https:\/\//.test(url)?url:''};
  }));
  return {items,missing,subtotal:items.length===missing?null:cents/100};
}

function fttxCostSummary(groups){
  const {items,missing,subtotal}=fttxCostRows(groups);
  if(!items.length)return '';
  return `<div><h3>Estimativa de materiais</h3><strong>${subtotal===null?'Sem preços informados':fttxCurrency.format(subtotal)}</strong></div>
    <button type="button" class="btn tiny" data-fttx-jump="fttx-prices-editor">Ajustar preços em R$</button>
    <p>${missing?`${missing} de ${items.length} linhas sem preço. O subtotal cobre os itens com valor informado. `:''}Mão de obra e frete ficam fora da estimativa.</p>`;
}

function buildFttxCsv(report){
  const number=value=>value==null?'':String(value).replace('.',',');
  const rows=[FTTX_EXPORT_HEADERS,...report.items.map(item=>[
    report.project,item.group,item.name,item.unit,number(item.quantity),number(item.price),number(item.subtotal),
    item.source,item.checkedOn,item.url])];
  const quote=value=>{
    const safe=/^[\s]*[=+\-@]/.test(value)?"'"+value:value;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
}

let fttxExportRequest;
async function exportFttx(format){
  const {groups,alerts,routeTotal,reserveTotal,cableTotal,ctoPorts}=calculateFttx(fttxDraft);
  const costs=fttxCostRows(groups);
  if(alerts.length||!costs.items.length||fttxExportRequest?.session===googleSession)return;
  const status=document.getElementById('fttx-export-status');
  const request={session:googleSession};
  fttxExportRequest=request;
  const project=fttxDraft.name?.trim()||'Projeto FTTx';
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format();
  const report={...costs,project,date,routeTotal,reserveTotal,cableTotal,ctoPorts};
  const filename=project.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ').trim()||'Projeto FTTx';
  const exports={
    pdf:[buildFttxPdf,'application/pdf'],
    xlsx:[buildFttxWorkbook,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    csv:[buildFttxCsv,'text/csv;charset=utf-8']
  };
  try{
    status.textContent='Preparando o arquivo…';
    const [build,mime]=exports[format];
    const contents=await build(report);
    if(googleSession!==request.session)return;
    download(contents,filename+' - Lista de materiais.'+format,mime);
    status.textContent='Arquivo gerado.';
  }catch(error){
    if(googleSession===request.session)status.textContent='Falha ao gerar o arquivo. '+error.message;
  }finally{
    if(fttxExportRequest===request)fttxExportRequest=null;
  }
}

document.addEventListener('click',event=>{
  const exportButton=event.target.closest('[data-fttx-export]');
  if(exportButton&&fttxActive())exportFttx(exportButton.dataset.fttxExport);
});

document.addEventListener('input',saveFttx);
document.addEventListener('change',event=>{
  if(event.target.matches('select[data-fttx-field]'))saveFttx(event);
});
document.addEventListener('click',event=>{
  if(!fttxActive())return;
  const step=event.target.closest('[data-fttx-step]');
  if(step)return goFttxStep(Number(step.dataset.fttxStep));
  const reset=event.target.closest('[data-fttx-reset]');
  if(reset){
    if(!confirm('Limpar todos os campos deste levantamento FTTx para iniciar um novo projeto?'))return;
    fttxDraft={step:1};
    persistFttx();
    const pane=isGoogleMode()?document.getElementById('portal-fttx-pane'):document.getElementById('app');
    if(pane)pane.innerHTML=renderFttx();
    return;
  }
  const removeExtra=event.target.closest('[data-fttx-remove-extra]');
  if(removeExtra){
    const itemName=removeExtra.dataset.fttxRemoveExtra;
    if(fttxDraft.extras&&Object.hasOwn(fttxDraft.extras,itemName)){
      delete fttxDraft.extras[itemName];
      persistFttx();
      updateFttxResults();
      const status=document.getElementById('fttx-catalog-status');
      if(status)status.textContent=itemName+' retirado da lista.';
    }
    return;
  }
  const ctoFill=event.target.closest('[data-fttx-cto-fill]');
  if(ctoFill){
    const target=ctoFill.dataset.fttxCtoFill;
    const total=calculateFttx(fttxDraft).ctoTotal;
    if(!total){document.querySelector('[data-fttx-fiber="12"][data-fttx-field="cto"]')?.focus();return;}
    for(const [field] of FTTX_CTO_MODELS){
      const val=field===target?String(total):'';
      fttxDraft[field]=val;
      const input=document.getElementById('fttx-'+field);
      if(input)input.value=val;
    }
    persistFttx();
    updateFttxResults();
    document.getElementById('fttx-'+target)?.focus();
    return;
  }
  const ceoFill=event.target.closest('[data-fttx-ceo-fill]');
  if(ceoFill){
    const target=ceoFill.dataset.fttxCeoFill;
    const total=calculateFttx(fttxDraft).ceoTotal;
    if(!total){document.querySelector('[data-fttx-fiber="12"][data-fttx-field="ceo"]')?.focus();return;}
    for(const [field] of FTTX_CEO_MODELS){
      const val=field===target?String(total):'';
      fttxDraft[field]=val;
      const input=document.getElementById('fttx-'+field);
      if(input)input.value=val;
    }
    persistFttx();
    updateFttxResults();
    document.getElementById('fttx-'+target)?.focus();
    return;
  }
  const suggestion=event.target.closest('[data-fttx-suggestion]');
  if(suggestion){
    const field=suggestion.dataset.fttxSuggestion;
    const input=document.getElementById('fttx-'+field);
    let value=0;
    if(field==='asPoles')value=fttxQuantity(fttxDraft.poles);
    else if(field==='sleeve')value=fttxEstimatedSleeves(fttxDraft);
    else value=calculateFttx(fttxDraft).ctoTotal;
    if(value){
      input.value=value;
      saveFttx({target:input});
      input.focus();
    }else{
      const fallback=field==='asPoles'?'#fttx-poles':field==='sleeve'?'#fttx-sleeve':'[data-fttx-fiber="12"][data-fttx-field="cto"]';
      document.querySelector(fallback)?.focus();
    }
    return;
  }
  const jump=event.target.closest('[data-fttx-jump]');
  if(!jump)return;
  const heading=document.getElementById(jump.dataset.fttxJump);
  const details=heading.closest('details');
  if(details)details.open=true;
  heading.focus({preventScroll:true});
  heading.scrollIntoView({block:'start'});
});
document.addEventListener('input',event=>{
  if(event.target.id==='fttx-search'){
    document.getElementById('fttx-catalog-item').innerHTML=fttxCatalogOptions(event.target.value);
    document.getElementById('fttx-catalog-quantity').value='';
  }
});
document.addEventListener('change',event=>{
  if(!fttxActive())return;
  const field=event.target;
  if(field.id==='fttx-catalog-item'){
    const quantity=document.getElementById('fttx-catalog-quantity');
    quantity.value=fttxDraft.extras?.[field.value]??'';
    quantity.step=field.selectedOptions[0]?.dataset.unit==='un'?'1':'0.01';
  }
  if(field.dataset.fttxPrice){
    if(!field.validity.valid){field.reportValidity();return;}
    fttxDraft.prices??={};
    fttxDraft.prices[field.dataset.fttxPrice]=field.value;
    persistFttx();
    updateFttxPrices();
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='fttx-catalog-form')return;
  event.preventDefault();
  const item=document.getElementById('fttx-catalog-item'),quantity=document.getElementById('fttx-catalog-quantity');
  const amount=fttxQuantity(quantity.value,item.selectedOptions[0]?.dataset.unit!=='un');
  fttxDraft.extras??={};
  if(amount)fttxDraft.extras[item.value]=amount;
  else delete fttxDraft.extras[item.value];
  persistFttx();
  updateFttxResults();
  document.getElementById('fttx-catalog-status').textContent=amount?item.value+' atualizado na lista.':item.value+' retirado da lista.';
});
