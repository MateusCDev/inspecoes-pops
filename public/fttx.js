'use strict';

const FTTX_FIBERS=[6,12,24,36];
const FTTX_CABLE_FIELDS=[['meters','Cabo lançado (m)'],['cto','CTOs comuns'],['endCto','CTOs de ponta'],['ceo','CEOs']];
const FTTX_ROUTE_FIELDS=[
  ['poles','Postes no trajeto'],
  ['asPoles','Postes com cabo AS'],
  ['ctoPoles','Postes com CTO'],
  ['guidePoles','Postes com guia, sem CTO e sem BAP'],
  ['dielectricGroups','Grupos de três postes aptos para dielétrico'],
  ['extraEyelets','Olhais adicionais'],
  ['bolt','Parafusos'],
  ['bapSupport','Suportes para BAP'],
  ['loopSmall','Alças pré-formadas de 06 a 12 FO'],
  ['loop24','Alças pré-formadas de 24 FO'],
  ['loop36','Alças pré-formadas de 36 FO']
];
const FTTX_BOX_FIELDS=[
  ['cep','CEPs'],['tray','Bandejas de emenda'],['split2','Splitters 1:2'],['split8','Splitters 1:8'],
  ['split16','Splitters 1:16'],['strand','Cordoalha medida no projeto (m)'],
  ['sleeve','Tubetes protetores de emenda'],['blanket','Mantas para CEO']
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
  const groups=[
    {title:'Lançamento',items:[
      ...cables.map(c=>['Cabo óptico '+String(c.fibers).padStart(2,'0')+' FO','m',c.total]),
      ['Olhal reto M12','un',ctoPoles+get('extraEyelets')],
      ['Parafuso','un',get('bolt')],
      ['Suporte para BAP','un',get('bapSupport')],
      ['Alça pré-formada para cabo de 06 a 12 FO','un',get('loopSmall')],
      ['Alça pré-formada para cabo de 24 FO','un',get('loop24')],
      ['Alça pré-formada para cabo de 36 FO','un',get('loop36')],
      ['Suporte dielétrico','un',get('dielectricGroups')],
      ['Plaqueta de identificação do cabo','un',poles],
      ['Anel guia AGFE para postes sem CTO e sem BAP','un',2*guidePoles],
      ['Fita de aço 3/4″ para postes sem CTO e sem BAP','m',1.5*guidePoles],
      ['Abraçadeira BAP','un',asPoles]
    ]},
    {title:'Montagem de CTO',items:[
      ['CTO','un',ctoTotal],
      ['Plaqueta de CTO','un',ctoTotal],
      ['Fita de aço 3/4″','m',3*ctoTotal],
      ['Fecho de aço 3/4″','un',2*ctoTotal],
      ['Anel guia AGFE','un',6*ctoTotal]
    ]},
    {title:'Montagem de CEO / CEP',items:[
      ['CEO','un',ceoTotal],['CEP','un',cep],['Bandeja de caixa de emenda','un',get('tray')],
      ['Splitter 1:2','un',get('split2')],['Splitter 1:8','un',get('split8')],['Splitter 1:16','un',get('split16')],
      ['Alça pré-formada para cordoalha','un',2*ceoTotal],
      ['Conjunto de reserva técnica para caixa de emenda','un',ceoTotal+cep],
      ['Cordoalha','m',get('strand',true)],['Plaqueta de caixa de emenda','un',ceoTotal+cep],
      ['Tubete protetor de emenda','un',get('sleeve')],['Manta para CEO','un',get('blanket')]
    ]},
    ...FTTX_CATALOG.map(([title,items])=>({title,items:items.map(([name,unit])=>[name,unit,getExtra(name,unit)])}))
  ].map(group=>({...group,items:group.items.filter(item=>item[2]>0)}));
  function getExtra(name,unit){return fttxQuantity(draft.extras?.[name],unit!=='un');}
  const alerts=[];
  if(Math.max(asPoles,ctoPoles,guidePoles)>poles||guidePoles+Math.max(asPoles,ctoPoles)>poles){
    alerts.push('Confira os totais de postes. Os postes classificados precisam caber no total do trajeto.');
  }
  if(ctoTotal&&(!ctoPoles||ctoPoles>ctoTotal)){
    alerts.push('Informe os postes distintos com CTO. A contagem precisa ser de pelo menos um poste e não pode exceder o número de CTOs.');
  }else if(ctoPoles&&!ctoTotal){
    alerts.push('Distribua as CTOs por bitola para calcular as reservas e os acessórios.');
  }
  if(get('dielectricGroups')&&poles<3){
    alerts.push('A configuração padrão de suporte dielétrico precisa de pelo menos três postes.');
  }
  return {cables,groups,cableTotal:fttxQuantity(cableTotal,true),reserveTotal,routeTotal:fttxQuantity(routeTotal,true),alerts};
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

function fttxEstimate(name,quantity){
  const key=fttxMaterialKey(name),manual=fttxDraft.prices?.[key],reference=fttxReferences[key];
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
      materials.set(key,{unit,qty:(previous?.qty??0)+qty});
    }
  }
  if(!materials.size)return '';
  let missing=0,cents=0;
  const rows=[...materials].map(([name,{unit,qty}])=>{
    const quote=fttxEstimate(name,qty);
    if(quote.cents===null)missing++;
    else cents+=quote.cents;
    const {reference}=quote;
    const source=reference&&/^https:\/\//.test(reference.url)
      ? `<a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">${esc(reference.store)}</a>
        <div class="small muted">${esc(reference.details||'')} · ${esc(fmt(reference.checkedOn))}</div>`
      : esc(quote.source);
    return `<tr><th scope="row">${name}</th><td>${fttxQuantityFormat.format(qty)} ${unit}</td>
      <td><input type="number" min="0" step="0.0001" inputmode="decimal" class="fttx-price-input"
        aria-label="Preço unitário de ${esc(name)}" data-fttx-price="${esc(name)}"
        value="${esc(fttxDraft.prices?.[name]??'')}" placeholder="${quote.unit===null?'—':fttxUnitPrice.format(quote.unit)}"></td>
      <td data-fttx-price-result><strong>${quote.cents===null?'—':fttxCurrency.format(quote.cents/100)}</strong></td><td data-fttx-price-result>${source}</td></tr>`;
  }).join('');
  return `<details class="fttx-prices" ${fttxPriceOpen?'open':''}><summary>Estimativa de materiais · ${cents||missing<materials.size?fttxCurrency.format(cents/100):'sem valores'}</summary>
    <p class="small muted">${fttxReferenceStatus} O valor digitado substitui a referência pública.</p>
    <div data-fttx-price-result>${missing?`<p class="fttx-alert">${missing} de ${materials.size} materiais sem preço. O subtotal cobre os itens com valor informado.</p>`:''}</div>
    <div class="table-scroll"><table class="data-table fttx-price-table">
      <thead><tr><th>Material</th><th>Quantidade</th><th>Preço unitário</th><th>Subtotal</th><th>Origem</th></tr></thead>
      <tbody>${rows}</tbody></table></div></details>`;
}

let fttxPriceOpen=true;
function updateFttxPrices(){
  const current=document.querySelector('.fttx-prices');
  if(!current)return;
  const next=document.createElement('template');
  next.innerHTML=fttxPriceTable(calculateFttx(fttxDraft).groups);
  const selector='summary,[data-fttx-price-result]';
  const fresh=next.content.querySelectorAll(selector);
  current.querySelectorAll(selector).forEach((node,index)=>node.replaceChildren(...fresh[index].childNodes));
  const inputs=next.content.querySelectorAll('[data-fttx-price]');
  current.querySelectorAll('[data-fttx-price]').forEach((node,index)=>{node.placeholder=inputs[index].placeholder;});
}

function updateFttxResults(){
  const result=calculateFttx(fttxDraft);
  const target=document.getElementById('fttx-results');
  if(!target)return;
  fttxPriceOpen=target.querySelector('.fttx-prices')?.open??fttxPriceOpen;
  target.innerHTML=fttxResults(result);
  document.querySelector('[data-action="exportFttx"]').disabled=Boolean(result.alerts.length)||!result.groups.some(group=>group.items.length);
}

function fttxInput(field,label,decimal=false){
  return `<label class="fttx-field"><span>${label}</span><input type="number" min="0" step="${decimal?'0.01':'1'}"
    inputmode="${decimal?'decimal':'numeric'}" value="${esc(fttxDraft[field]??'')}" data-fttx-field="${field}" placeholder="0"></label>`;
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

function fttxResults({cables,groups,cableTotal,reserveTotal,routeTotal,alerts}){
  const f=value=>fttxQuantityFormat.format(value);
  const shown=cables.filter(c=>c.total>0);
  return `<div class="grid3 fttx-totals">
    <div class="stat"><strong>${f(routeTotal)} m</strong><span>Cabo lançado</span></div>
    <div class="stat"><strong>${f(reserveTotal)} m</strong><span>Reserva técnica</span></div>
    <div class="stat"><strong>${f(cableTotal)} m</strong><span>Total de cabo</span></div>
  </div>
  ${alerts.length?`<ul class="fttx-alert" role="status">${alerts.map(alert=>`<li>${alert}</li>`).join('')}</ul>`:''}
  ${shown.length?`<h3>Reserva por bitola</h3><div class="table-scroll"><table class="data-table">
    <thead><tr><th>Bitola</th><th>CTOs</th><th>CEOs</th><th>A cada 500 m</th><th>Reserva</th><th>Cabo total</th></tr></thead>
    <tbody>${shown.map(c=>`<tr><th scope="row">${String(c.fibers).padStart(2,'0')} FO</th>
      ${[c.ctoReserve,c.ceoReserve,c.routeReserve,c.reserve,c.total].map(v=>`<td>${f(v)} m</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`:''}
  ${groups.some(group=>group.items.length)?groups.filter(group=>group.items.length).map(group=>`<section class="fttx-materials">
    <h3>${group.title}</h3><div class="table-scroll"><table class="data-table">
    <thead><tr><th>Material</th><th>Unidade</th><th>Quantidade</th></tr></thead>
    <tbody>${group.items.map(([name,unit,qty])=>`<tr><td>${name}</td><td>${unit}</td><td><strong>${f(qty)}</strong></td></tr>`).join('')}</tbody>
    </table></div></section>`).join(''):'<p class="muted">Preencha os dados do projeto para gerar a lista de materiais.</p>'}
  ${fttxPriceTable(groups)}`;
}

function renderFttx(){
  const result=calculateFttx(fttxDraft);
  return `<main class="shell fttx-shell">
    <div class="home-hero"><div><h1>Levantamento FTTx</h1>
      <p>Calcule os materiais do projeto e exporte a lista para o almoxarifado.</p></div>${isGoogleMode()?'':button('home','Voltar à Gestão','primary')}</div>
    <section class="card">
      <div class="card-head"><h2>Projeto e trechos de cabo</h2><p class="small muted" id="fttx-save" role="status">${fttxSaveError?'Armazenamento local indisponível.':'Rascunho neste dispositivo'}</p></div>
      <label class="fttx-field fttx-project"><span>Nome do projeto</span><input maxlength="100" data-fttx-field="name" value="${esc(fttxDraft.name??'')}"></label>
      <p class="small muted">Distribua as caixas pela bitola em que entra a reserva. O cálculo usa 22 m por CTO comum, 12,5 m por CTO de ponta, 20 m por CEO e 50 m por bloco completo de 500 m lançados em cada bitola.</p>
      <div class="table-scroll"><table class="data-table fttx-cable-table">
        <thead><tr><th>Bitola</th>${FTTX_CABLE_FIELDS.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead>
        <tbody>${FTTX_FIBERS.map(fibers=>{
          const label=String(fibers).padStart(2,'0')+' FO';
          return `<tr><th scope="row">${label}</th>${FTTX_CABLE_FIELDS.map(([field,title])=>`<td><input type="number"
              min="0" step="${field==='meters'?'0.01':'1'}" inputmode="${field==='meters'?'decimal':'numeric'}"
              aria-label="${title} · ${label}" data-fttx-fiber="${fibers}" data-fttx-field="${field}"
              value="${esc(fttxDraft.cables?.[fibers]?.[field]??'')}" placeholder="0"></td>`).join('')}</tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>
    <section class="card">
      <h2>Postes, ferragens e lançamento</h2>
      <p class="small muted">Conte cada poste uma vez. Cada poste com CTO recebe um olhal e cada poste com AS recebe uma BAP. Conte como adicionais os demais olhais, inclusive os das extremidades dos grupos de três postes, curvas e cruzamentos.</p>
      <p class="small muted">Considere para dielétrico apenas grupos com olhal nas duas extremidades e suporte no meio, após conferir vegetação, curvas e vãos longos.</p>
      <div class="fttx-fields">${FTTX_ROUTE_FIELDS.map(([field,label])=>fttxInput(field,label)).join('')}</div>
    </section>
    <section class="card">
      <h2>Caixas de emenda e acessórios</h2>
      <p class="small muted">Informe a metragem de cordoalha conferida no traçado, considerando os pontos previstos a cada 100 m.</p>
      <div class="fttx-fields">${FTTX_BOX_FIELDS.map(([field,label])=>fttxInput(field,label,field==='strand')).join('')}</div>
    </section>
    <section class="card">
      <h2>Catálogo de materiais complementares</h2>
      <form id="fttx-catalog-form" class="fttx-fields">
        <label class="fttx-field"><span>Buscar no catálogo</span><input type="search" id="fttx-search" placeholder="Ex.: DIO, OLT ou microduto"></label>
        <label class="fttx-field"><span id="fttx-material-label">Material</span><select id="fttx-catalog-item" aria-labelledby="fttx-material-label" required>${fttxCatalogOptions()}</select></label>
        <label class="fttx-field"><span>Quantidade</span><input id="fttx-catalog-quantity" type="number" min="0" step="0.01" inputmode="decimal" required></label>
        <button class="btn" type="submit">Aplicar quantidade</button>
      </form>
      <p class="small muted" id="fttx-catalog-status" role="status">Informe zero para retirar um material complementar da lista.</p>
    </section>
    <section class="card">
      <div class="card-head"><div><h2>Lista para o almoxarifado</h2><p class="small muted">Exportação em CSV compatível com Excel.</p></div>
        <button type="button" class="btn primary" data-action="exportFttx" ${result.alerts.length||!result.groups.some(group=>group.items.length)?'disabled':''}>Exportar materiais</button></div>
      <div id="fttx-results">${fttxResults(result)}</div>
    </section>
  </main>`;
}

function persistFttx(){
  try{
    localStorage.setItem(fttxDraftKey,JSON.stringify(fttxDraft));
    fttxSaveError=false;
  }catch(_){fttxSaveError=true;}
  document.getElementById('fttx-save').textContent=fttxSaveError?'Não foi possível salvar o rascunho neste dispositivo.':'Rascunho salvo neste dispositivo';
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

function exportFttx(){
  const {groups,alerts}=calculateFttx(fttxDraft);
  if(alerts.length||!groups.some(group=>group.items.length))return;
  const project=fttxDraft.name?.trim()||'Projeto FTTx';
  const number=value=>value==null?'':String(value).replace('.',',');
  const rows=[['Projeto','Etapa','Material','Unidade','Quantidade','Preço unitário estimado (R$)','Subtotal estimado (R$)','Origem','Data da referência','URL da referência'],
    ...groups.flatMap(group=>group.items.map(([name,unit,qty])=>{
      const quote=fttxEstimate(name,qty);
      return [project,group.title,name,unit,number(qty),number(quote.unit),number(quote.cents===null?null:quote.cents/100),
        quote.source,quote.reference?.checkedOn||'',quote.reference?.url||''];
    }))];
  const quote=value=>{
    const safe=/^[\s]*[=+\-@]/.test(value)?"'"+value:value;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  const contents='\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  const filename=project.replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').trim()||'Projeto FTTx';
  download(contents,filename+' - Lista de materiais.csv','text/csv;charset=utf-8');
}

document.addEventListener('input',saveFttx);
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
