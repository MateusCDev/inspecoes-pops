// A lista de e-mails e perfis permanece na planilha privada, fora do site público.
const ACCESS_SHEET = 'Acessos_Inspecoes_POPs';
const ACCESS_HEADERS = ['email','perfil','ativo','emitir_chave'];
function requirePrivateData_() {
  if (DriveApp.getFileById(config_().ACCESS_SPREADSHEET_ID).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw Error('A lista de acessos precisa ter acesso geral Restrito no Drive.');
  }
  if (DriveApp.getFolderById(config_().PDF_FOLDER_ID).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw Error('A pasta de relatórios precisa ter acesso geral Restrito no Drive.');
  }
}
function accessSheet_() {
  const book = book_(config_().ACCESS_SPREADSHEET_ID);
  const sheet = book.getSheetByName(ACCESS_SHEET);
  if (!sheet || JSON.stringify(sheet.getRange(1,1,1,4).getValues()[0]) !== JSON.stringify(ACCESS_HEADERS)) {
    throw Error('Prepare a aba Acessos_Inspecoes_POPs com email, perfil, ativo e emitir_chave.');
  }
  return sheet;
}
function accessUsers_() {
  const sheet = accessSheet_(), seen = new Set();
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().flatMap((r,i)=>{
    if (!String(r[0]||'').trim()) return [];
    const email=String(r[0]).trim().toLowerCase(),role=String(r[1]).trim().toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['GESTAO','OPERACAO'].includes(role) || seen.has(email)) throw Error('E-mail/perfil inválido ou duplicado na aba de acessos.');
    seen.add(email);
    return [{email,role,active:r[2]===true,issue:r[3]===true,row:i+2}];
  });
}
function issueAccessKeys_() {
  beginRequest_();
  requirePrivateData_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw Error('Outro processo está em andamento.');
  try {
    const selected=accessUsers_().filter(u=>u.active&&u.issue);
    if (!selected.length) throw Error('Marque emitir_chave para as pessoas que receberão uma nova chave.');
    const props=PropertiesService.getScriptProperties();
    const keys=JSON.parse(props.getProperty('TOKEN_HASHES')||'{}');
    const issued=selected.map(u=>{
      Object.keys(keys).forEach(hash=>{if(keys[hash]?.email===u.email)delete keys[hash];});
      const token=Utilities.getUuid()+Utilities.getUuid();
      keys[hash_(token)]={email:u.email};
      return {user:u,token};
    });
    props.setProperty('TOKEN_HASHES',JSON.stringify(keys));
    const sheet=accessSheet_();
    issued.forEach(({user,token})=>{
      sheet.getRange(user.row,4).setValue(false);
      console.log('E-mail: '+user.email+' | Perfil: '+user.role+'\nChave individual: '+token);
    });
    console.log('Entregue cada chave somente à pessoa correspondente. Não publique as chaves na planilha.');
  } finally {lock.releaseLock();}
}
function authenticate_(input) {
  const keys=JSON.parse(config_().TOKEN_HASHES||'{}');
  const binding=typeof input.token==='string'&&keys[hash_(input.token)];
  // Chaves antigas anônimas não podem acessar dados ou escolher um perfil.
  const user=binding?.email&&accessUsers_().find(u=>u.active&&u.email===binding.email);
  if (!user) return null;
  return {email:user.email,role:user.role};
}
function canReadRow_(row,headers,user) {
  return user.role==='GESTAO'||recordOwner_(row[0])===user.email;
}
function recordOwner_(id) {return privateValue_('OWNER_'+hash_(String(id)))||'';}
function recordRevision_(id) {return JSON.parse(privateValue_('REVISION_'+hash_(String(id)))||'null');}
function listInspections_(input,user) {
  const sheet=sheet_(),headers=headers_(),limit=50;
  let cursor=input.cursor===undefined?sheet.getLastRow():Number(input.cursor);
  if (!Number.isInteger(cursor)||cursor<1||cursor>sheet.getLastRow()) throw Error('Página inválida.');
  const items=[];
  while(cursor>1&&items.length<limit){
    const start=Math.max(2,cursor-99);
    const block=sheet.getRange(start,1,cursor-start+1,43).getValues();
    for(let i=block.length-1;i>=0;i--){
      cursor=start+i-1;
      const row=block[i];
      if(!row[0]||!canReadRow_(row,headers,user))continue;
      const get=k=>row[headers.indexOf(k)];
      items.push({id:row[0],stationCode:get('codigo_pop'),station:get('nome'),date:get('data'),updated:get('updated'),technician:get('inspetor'),owner:recordOwner_(row[0])||'Autoria não vinculada',criticality:get('classificacao'),nc:get('itens_nao_conformes'),conform:get('itens_conformes'),unverified:get('itens_nao_verificados'),due:get('scheduleDueDate'),period:get('schedulePeriod'),issues:get('qtd_pendencias')});
      if(items.length===limit)break;
    }
  }
  return {ok:true,items,nextCursor:cursor>1?cursor:null};
}
function downloadPdf_(input,user) {
  if(!/^INSP-[A-Za-z0-9-]+$/.test(input.inspectionId||''))throw Error('Registro indisponível.');
  const sheet=sheet_(),headers=headers_();
  const matches=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(input.inspectionId).matchEntireCell(true).findAll():[];
  if(matches.length!==1)throw Error('Registro indisponível.');
  const row=sheet.getRange(matches[0].getRow(),1,1,headers.length).getValues()[0];
  if(!canReadRow_(row,headers,user))throw Error('Registro indisponível.');
  // Não usar o link da planilha como autorização para ler arquivos privados do Drive.
  const pdfId=privateValue_('PDF_'+hash_(input.inspectionId));
  if(!pdfId)throw Error('PDF ainda não vinculado pelo serviço.');
  const file=DriveApp.getFileById(pdfId);
  if(file.getSize()>15*1024*1024)throw Error('PDF maior que 15 MB. Solicite o arquivo à gestão.');
  return {ok:true,fileName:input.inspectionId+'.pdf',base64:Utilities.base64Encode(file.getBlob().getBytes())};
}
