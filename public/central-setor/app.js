'use strict';
const baseAccesses=[
  {
    "name": "Central de Infraestrutura",
    "category": "Portais",
    "description": "Inspeções POPs, Frota, FTTx e Fibra Import.",
    "icon": "../icon-192.png",
    "url": "../"
  },
  {
    "name": "ERP · Operações",
    "category": "Sistemas",
    "description": "Acesso à página de operações no ERP Elleven.",
    "icon": "assets/erp.png",
    "url": "https://erp.voanet.com.br/ui/legacy/operations/539969eb-ff8c-b6cd-0c09-38e853f2b4fd"
  },
  {
    "name": "INT6 · AutoISP",
    "category": "Sistemas",
    "description": "Consulta do serviço no AutoISP com o acesso de cada usuário.",
    "icon": "assets/int6.png",
    "url": "https://autoisp.voanet.com.br/contracted_services/1003230"
  },
  {
    "name": "NetBox",
    "category": "Sistemas",
    "description": "Consulta e documentação da infraestrutura de rede.",
    "icon": "assets/netbox.png",
    "url": "https://netbox.voanet.com.br/"
  },
  {
    "name": "OZmap",
    "category": "Sistemas",
    "description": "Documentação e consulta da rede óptica.",
    "icon": "assets/ozmap.png",
    "url": "https://voanet.ozmap.com.br:9994/"
  },
  {
    "name": "SIGA+ · Monitoramento FSM",
    "category": "Sistemas",
    "description": "Monitoramento das atividades de campo.",
    "icon": "assets/siga.png",
    "url": "https://sigaplus.voanet.com.br/private/fsm/monitoring"
  },
  {
    "name": "SYDLE ONE",
    "category": "Sistemas",
    "description": "Acesso à plataforma SYDLE ONE da Voanet.",
    "icon": "assets/sydle.png",
    "url": "https://voanet.sydle.one/"
  },
  {
    "name": "Ocupação Rede FTTH",
    "category": "Dashboards",
    "description": "Dashboard do Setor de Projetos no Looker Studio.",
    "icon": "assets/looker.png",
    "url": "https://datastudio.google.com/reporting/81114519-4466-4a93-8918-0ade78f9ce43/page/0HPCE"
  },
  {
    "name": "Dashboard do setor",
    "category": "Dashboards",
    "description": "Indicadores no Looker Studio. Use sua própria conta Google.",
    "icon": "assets/looker.png",
    "url": "https://datastudio.google.com/reporting/2e96f462-af5e-47cd-a8fe-bfa78dad287d/page/SaG7F"
  },
  {
    "name": "Dados centralizados · Projetos",
    "category": "Planilhas",
    "description": "Dados centralizados da equipe de projetos.",
    "icon": "assets/sheets.ico",
    "url": "https://docs.google.com/spreadsheets/d/1ECl74D0TwYXkjTl3kWGT50cjSTlOddXGiox9h-FAd8M/edit"
  },
  {
    "name": "Dados centralizados · Infra",
    "category": "Planilhas",
    "description": "Dados centralizados da infraestrutura.",
    "icon": "assets/sheets.ico",
    "url": "https://docs.google.com/spreadsheets/d/1WArVbYwKaiWkhgNxeNXdbPx4OK5tNqyJcDRbFp91Gf8/edit"
  },
  {
    "name": "Meu controle de atividades",
    "category": "Planilhas",
    "description": "Abra o seu controle de atividades. Configure seu link uma vez neste navegador.",
    "icon": "assets/sheets.ico",
    "personal": true
  },
  {
    "name": "Documentação · Planilhas no Drive",
    "category": "Documentos",
    "description": "Pasta Documentação_Planilhas do setor.",
    "icon": "assets/drive.png",
    "url": "https://drive.google.com/drive/folders/12vB5YpXR1pUM0pibLJvL827UU5moO1bM"
  },
  {
    "name": "Controle de Estações · SharePoint",
    "category": "Documentos",
    "description": "Documentos de infraestrutura e controle de estações.",
    "icon": "assets/sharepoint.png",
    "url": "https://voanetcom.sharepoint.com/sites/InfraVoanet/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FInfraVoanet%2FShared%20Documents%2FInfraestrutura%2FControle%20de%20Esta%C3%A7%C3%B5es&viewid=5ec0301a%2Dca67%2D482d%2D93b6%2D89663180c469"
  },
  {
    "name": "Acessos · Inspeções POPs",
    "category": "Administração",
    "description": "Planilha privada de administração de acessos. Requer permissão de gestão.",
    "icon": "assets/sheets.ico",
    "url": "https://docs.google.com/spreadsheets/d/1IRXgtRt8_oS1I5MuKD29MUrWv9xUNRibbuT_szs34j4/edit?gid=888598780#gid=888598780"
  }
];
const categories=['Todos','Portais','Sistemas','Planilhas','Dashboards','Documentos','Administração'];
const CONTROL_KEY='voanet_central_personal_activity_v1';
const $=id=>document.getElementById(id);
let active='Todos',managerToken='',managerUser=null,managerEpoch=0,catalogRevision=0,privateLinks=[],editingId=null,iconData='',iconEpoch=0;
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;}
function normalizeControlUrl(value){
  const url=new URL(String(value).trim());
  if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.username||url.password||!/^\/spreadsheets\/(?:u\/\d+\/)?d\/[A-Za-z0-9_-]+(?:\/.*)?$/.test(url.pathname))throw Error('Cole o link de uma planilha do Google Planilhas.');
  url.pathname=url.pathname.replace(/\/spreadsheets\/u\/\d+\//,'/spreadsheets/');url.searchParams.delete('authuser');return url.href;
}
function personalControl(){try{const value=localStorage.getItem(CONTROL_KEY);return value?normalizeControlUrl(value):'';}catch(_){return '';}}
function safeLink(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Informe um endereço http ou https sem usuário ou senha.');return url.href;}
function openControlSettings(){ $('control-error').hidden=true;$('control-url').value=personalControl();$('control-dialog').showModal();}
function render(){
  const query=$('search').value.trim().toLocaleLowerCase('pt-BR'),personal=personalControl();
  const all=baseAccesses.concat(managerUser?privateLinks.filter(x=>!x.archived).map(x=>({...x,private:true})):[]);
  const visible=all.filter(x=>(active==='Todos'||x.category===active)&&`${x.name} ${x.description} ${x.category}`.toLocaleLowerCase('pt-BR').includes(query));
  $('count').textContent=`${visible.length} ${visible.length===1?'acesso encontrado':'acessos encontrados'}`;
  $('control-settings').textContent=personal?'Alterar meu controle':'Configurar meu controle';
  $('manage-exit').hidden=!managerUser;$('manage-open').textContent=managerUser?'Gerenciar links':'Gestão de links';
  $('filters').replaceChildren(...categories.map(category=>{const b=element('button',category===active?'active':'',category);b.type='button';b.setAttribute('aria-pressed',String(category===active));b.onclick=()=>{active=category;render();};return b;}));
  $('grid').replaceChildren();
  if(!visible.length){$('grid').append(element('div','empty','Nenhum acesso encontrado.'));return;}
  visible.forEach(item=>{
    const href=item.personal?personal:item.url,card=element(href?'a':'button','card');
    if(href){card.href=href;card.target='_blank';card.rel='noopener noreferrer';}else{card.type='button';card.onclick=openControlSettings;}
    const icon=element('span','icon'),img=element('img');
    img.src=item.icon||new URL('/favicon.ico',item.url).href;img.alt='';img.width=32;img.height=32;img.loading='lazy';
    img.addEventListener('error',()=>icon.replaceChildren(element('span','fallback-icon','🔗')),{once:true});icon.append(img);
    if(item.darkIcon||item.icon?.endsWith('/siga.png'))icon.classList.add('icon-dark');
    const body=element('span'),description=item.personal?(personal?'Abrir o controle configurado neste navegador.':'Configure uma vez o link da sua própria planilha.'):item.description;
    body.append(element('strong','',item.name),element('span','desc',description),element('span','kind',item.category+(item.private?' · Gestão':'')));
    card.append(icon,body);$('grid').append(card);
  });
}
function managerMessage(text,error=false){$('manager-message').textContent=text;$('manager-message').classList.toggle('ui-error',error);}
function resetEditor(){editingId=null;iconData='';iconEpoch++;$('link-form').reset();$('icon-preview').hidden=true;$('link-form-title').textContent='Adicionar link';$('link-save').textContent='Adicionar link';}
function managerPanel(){
  $('manager-login').hidden=Boolean(managerUser);$('manager-panel').hidden=!managerUser;
  if(managerUser){$('manager-user').textContent='Gestão · '+managerUser.email;renderManaged();}
}
function renderManaged(){
  const items=privateLinks.filter(x=>$('show-archived').checked||!x.archived);
  $('managed-list').replaceChildren();
  if(!items.length){$('managed-list').append(element('p','empty-note','Nenhum link cadastrado neste catálogo.'));return;}
  items.forEach(item=>{
    const row=element('div','managed-row'),text=element('div');text.append(element('strong','',item.name),element('small','',item.category+(item.archived?' · Arquivado':'')));
    const actions=element('div','row-actions'),edit=element('button','ui-button','Editar'),archive=element('button','ui-button',item.archived?'Restaurar':'Arquivar');edit.type=archive.type='button';
    edit.onclick=()=>{editingId=item.id;iconData=item.icon?.startsWith('data:')?item.icon:'';iconEpoch++;$('link-name').value=item.name;$('link-url').value=item.url;$('link-category').value=item.category;$('link-description').value=item.description;$('link-icon-file').value='';$('link-icon-dark').checked=Boolean(item.darkIcon);$('icon-preview').hidden=!iconData;if(iconData)$('icon-preview').src=iconData;$('link-form-title').textContent='Editar link';$('link-save').textContent='Salvar alteração';$('link-name').focus();};
    archive.onclick=async()=>{if(!confirm((item.archived?'Restaurar ':'Arquivar ')+item.name+'?'))return;archive.disabled=true;await saveCatalog(privateLinks.map(x=>x.id===item.id?{...x,archived:!x.archived}:x));if(archive.isConnected)archive.disabled=false;};
    actions.append(edit,archive);row.append(text,actions);$('managed-list').append(row);
  });
}
async function catalogRpc(action,data={},key=managerToken){
  const endpoint=window.VOANET_SYNC_CONFIG?.google?.endpoint;
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint||''))throw Error('O serviço de links ainda não está configurado.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
  try{
    const response=await fetch(endpoint,{method:'POST',redirect:'follow',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({version:1,action,...data,token:key}),signal:controller.signal});
    if(!response.ok)throw Error('Serviço indisponível. Tente novamente.');
    const result=await response.json();if(!result?.ok){const error=Error(result?.error||'Operação não confirmada.');error.code=result?.code;throw error;}return result;
  }finally{clearTimeout(timer);}
}
async function loadCatalog(){const epoch=managerEpoch;const result=await catalogRpc('linkCatalogLoad');if(epoch!==managerEpoch||!managerUser)return;privateLinks=result.items;catalogRevision=result.revision;render();renderManaged();}
async function saveCatalog(items){
  if(!managerUser)return false;
  const epoch=managerEpoch;managerMessage('Salvando…');$('link-save').disabled=true;
  try{
    const result=await catalogRpc('linkCatalogSave',{revision:catalogRevision,items});
    if(epoch!==managerEpoch||!managerUser)return false;
    privateLinks=result.items;catalogRevision=result.revision;resetEditor();render();renderManaged();managerMessage('Catálogo salvo. Os links estão disponíveis para a Gestão conectada.');return true;
  }catch(error){if(epoch===managerEpoch)managerMessage(error.name==='AbortError'?'A resposta demorou. Atualize a lista para conferir se a alteração foi salva.':error.message,true);return false;}
  finally{if(epoch===managerEpoch)$('link-save').disabled=false;}
}
function managerLogout(){managerEpoch++;managerToken='';managerUser=null;privateLinks=[];catalogRevision=0;$('manager-key').value='';resetEditor();managerMessage('');managerPanel();render();}
$('control-form').onsubmit=event=>{
  event.preventDefault();
  try{const url=normalizeControlUrl($('control-url').value);localStorage.setItem(CONTROL_KEY,url);$('control-dialog').close();render();window.open(url,'_blank','noopener,noreferrer');}
  catch(error){$('control-error').textContent=error instanceof TypeError?'Cole um link válido do Google Planilhas.':error.message;$('control-error').hidden=false;}
};
$('control-settings').onclick=openControlSettings;
$('manage-open').onclick=()=>{managerPanel();$('manage-dialog').showModal();};$('manage-exit').onclick=managerLogout;
$('manager-login').onsubmit=async event=>{
  event.preventDefault();const key=$('manager-key').value.trim(),button=event.target.querySelector('button'),epoch=++managerEpoch;button.disabled=true;managerMessage('Validando acesso…');
  try{
    const result=await catalogRpc('session',{},key);if(epoch!==managerEpoch)return;
    if(result.user?.role!=='GESTAO')throw Error('Este gerenciador é exclusivo do perfil Gestão.');
    if(!result.capabilities?.linkCatalog)throw Error('O serviço de links da Gestão ainda precisa ser atualizado.');
    const catalog=await catalogRpc('linkCatalogLoad',{},key);if(epoch!==managerEpoch)return;
    managerToken=key;managerUser=result.user;privateLinks=catalog.items;catalogRevision=catalog.revision;managerPanel();render();managerMessage('Acesso de gestão confirmado.');
  }catch(error){if(epoch===managerEpoch)managerMessage(error.message,true);}
  finally{$('manager-key').value='';button.disabled=false;}
};
$('manager-refresh').onclick=async()=>{const epoch=managerEpoch;managerMessage('Atualizando…');try{await loadCatalog();if(epoch===managerEpoch)managerMessage('Lista atualizada.');}catch(error){if(epoch===managerEpoch)managerMessage(error.message,true);}};
$('link-form').onsubmit=async event=>{
  event.preventDefault();if(!managerUser)return;
  try{
    const url=safeLink($('link-url').value),existing=privateLinks.find(x=>x.id===editingId);
    const item={id:editingId||'LINK-'+crypto.randomUUID(),name:$('link-name').value.trim(),description:$('link-description').value.trim(),category:$('link-category').value,url,icon:iconData,archived:existing?.archived||false,darkIcon:$('link-icon-dark').checked};
    if(!item.name)throw Error('Informe o nome do link.');
    await saveCatalog(existing?privateLinks.map(x=>x.id===editingId?item:x):privateLinks.concat(item));
  }catch(error){managerMessage(error.message,true);}
};
$('link-icon-file').onchange=async event=>{
  const file=event.target.files[0],epoch=++iconEpoch;if(!file)return;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('Escolha PNG, JPG ou WebP de até 2 MB.');
    const bitmap=await createImageBitmap(file);if(epoch!==iconEpoch){bitmap.close();return;}
    const ratio=Math.min(1,96/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL('image/png');if(data.length>65536)throw Error('O ícone ficou muito grande. Escolha uma imagem menor.');iconData=data;$('icon-preview').src=data;$('icon-preview').hidden=false;managerMessage('');
  }catch(error){if(epoch===iconEpoch){event.target.value='';managerMessage(error.message,true);}}
};
$('icon-clear').onclick=()=>{iconEpoch++;iconData='';$('link-icon-file').value='';$('icon-preview').hidden=true;};
$('link-cancel').onclick=resetEditor;$('show-archived').onchange=renderManaged;
for(const category of categories.slice(1))$('link-category').append(new Option(category,category));
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
$('manage-dialog').addEventListener('close',()=>{$('manager-key').value='';});
$('search').addEventListener('input',render);
window.addEventListener('storage',event=>{if(event.key===CONTROL_KEY)render();});
managerPanel();render();
