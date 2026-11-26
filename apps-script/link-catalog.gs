// Catálogo privado da gestão. O arquivo é criado no Drive do proprietário,
// sem compartilhamento direto; os dados são entregues somente após autenticação.
const LINK_CATALOG_KEY = 'LINK_CATALOG_FILE_ID';
const LINK_CATALOG_CATEGORIES = ['Portais','Sistemas','Planilhas','Dashboards','Documentos','Administração'];
function catalogUrl_(value) {
  const text=String(value||'').trim();
  if(text.length>2048||!/^https?:\/\/[^\s/?#@]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(text))throw Error('Informe um link http ou https válido, sem usuário ou senha no endereço.');
  return text;
}
function catalogIcon_(value) {
  const text=String(value||'');
  if(!text)return '';
  if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(text)&&text.length<=65536)return text;
  if(text.length<=2048&&/^https:\/\/[^\s/?#@]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(text))return text;
  throw Error('Ícone inválido. Use uma imagem PNG, JPEG ou WebP de até 64 KB.');
}
function catalogItems_(items) {
  if(!Array.isArray(items)||items.length>200)throw Error('O catálogo aceita até 200 links, incluindo os arquivados.');
  const ids=new Set();
  return items.map(item=>{
    const id=String(item?.id||''),name=String(item?.name||'').trim(),description=String(item?.description||'').trim(),category=String(item?.category||'');
    if(!/^LINK-[A-Za-z0-9-]{8,80}$/.test(id)||ids.has(id))throw Error('Identificador de link inválido ou duplicado.');
    ids.add(id);
    if(!name||name.length>100||description.length>240||!LINK_CATALOG_CATEGORIES.includes(category))throw Error('Revise o nome, a descrição e a categoria do link.');
    return {id,name,description,category,url:catalogUrl_(item.url),icon:catalogIcon_(item.icon),archived:item.archived===true,darkIcon:item.darkIcon===true};
  });
}
function catalogFile_() {
  const id=privateValue_(LINK_CATALOG_KEY);
  if(!id)return null;
  const file=DriveApp.getFileById(id);
  // Não permitir que um convite direto no Drive contorne a autorização do serviço.
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getViewers().length||file.getEditors().length)throw Error('O arquivo do catálogo precisa permanecer restrito ao proprietário, sem convites diretos.');
  return file;
}
function readCatalog_() {
  const file=catalogFile_();
  if(!file)return {schema:1,revision:0,items:[]};
  const data=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  if(data.schema!==1||!Number.isInteger(data.revision)||data.revision<0)throw Error('Catálogo incompatível.');
  return {schema:1,revision:data.revision,items:catalogItems_(data.items),updatedAt:String(data.updatedAt||'')};
}
function linkCatalogRequest_(input,user) {
  if(user?.role!=='GESTAO')throw Error('O catálogo de links é exclusivo da Gestão.');
  if(input.action==='linkCatalogLoad')return Object.assign({ok:true},readCatalog_());
  if(input.action!=='linkCatalogSave')throw Error('Operação de catálogo desconhecida.');
  const items=catalogItems_(input.items);
  if(!Number.isInteger(input.revision)||input.revision<0)throw Error('Versão do catálogo inválida.');
  return withWriteLock_(()=>{
    const currentUser=authenticate_(input);
    if(currentUser?.role!=='GESTAO')throw Error('O catálogo de links é exclusivo da Gestão.');
    requirePrivateData_();
    const current=readCatalog_();
    // Uma resposta interrompida pode ser reenviada sem repetir a gravação.
    if(JSON.stringify(items)===JSON.stringify(current.items))return Object.assign({ok:true},current);
    if(input.revision!==current.revision)return {ok:false,code:'CONFLICT',error:'Outra pessoa atualizou o catálogo. Atualize a lista antes de salvar novamente.'};
    const data={schema:1,revision:current.revision+1,items,updatedAt:new Date().toISOString()},serialized=JSON.stringify(data);
    if(serialized.length>3*1024*1024)throw Error('O catálogo excede 3 MB. Reduza os ícones.');
    let file=catalogFile_();
    if(file)file.setContent(serialized);
    else{
      file=DriveApp.createFile(Utilities.newBlob(serialized,'application/json','Central do Setor - links da gestão.json'));
      if(file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getViewers().length||file.getEditors().length)throw Error('Não foi possível criar um catálogo privado.');
      setPrivate_(LINK_CATALOG_KEY,file.getId());
    }
    return Object.assign({ok:true},data);
  });
}
