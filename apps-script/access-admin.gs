function requireManager_(user){if(!user||user.role!=='GESTAO')throw Error('Acesso restrito à gestão.');}
function listAccess_(user){requireManager_(user);return {ok:true,users:accessUsers_().map(u=>({email:u.email,role:u.role,active:u.active}))};}
function logAccessChange_(manager,email,action){
  const book=book_(config_().ACCESS_SPREADSHEET_ID);let sheet=book.getSheetByName('Historico_Acessos_POPs');
  if(!sheet){sheet=book.insertSheet('Historico_Acessos_POPs');sheet.getRange(1,1,1,4).setValues([['Momento','Gestor','Operador','Acao']]);sheet.setFrozenRows(1);}
  if(sheet.getLastRow()+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
  sheet.getRange(sheet.getLastRow()+1,1,1,4).setValues([[new Date(),text_(manager),text_(email),action]]);
}
function manageOperator_(input,user){
  requireManager_(user);
  const email=String(input.email||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))throw Error('Informe um e-mail válido.');
  if(!['issue','deactivate'].includes(input.operation))throw Error('Operação de acesso inválida.');
  if(input.role&&input.role!=='OPERACAO')throw Error('Esta tela cadastra somente operadores.');
  return withWriteLock_(()=>{
    const users=accessUsers_(),manager=users.find(u=>u.email===user.email&&u.active&&u.role==='GESTAO');if(!manager)throw Error('Acesso gerencial não confirmado.');
    const existing=users.find(u=>u.email===email);
    if(existing?.role==='GESTAO')throw Error('Os acessos da Gestão são administrados pelo responsável pela configuração.');
    if(input.operation==='deactivate'&&!existing)throw Error('Operador não encontrado.');
    const keys=JSON.parse(privateValue_('TOKEN_HASHES')||'{}');Object.keys(keys).forEach(k=>{if(keys[k]?.email===email)delete keys[k];});
    let token=null;if(input.operation==='issue'){token=Utilities.getUuid()+Utilities.getUuid();keys[hash_(token)]={email};}
    // Nenhuma chave é gravada na planilha ou no histórico. Reemissão revoga a anterior.
    setPrivate_('TOKEN_HASHES',JSON.stringify(keys));
    const sheet=accessSheet_();let row=existing?.row;
    if(!row){row=Math.max(2,sheet.getLastRow());sheet.insertRowsBefore(row,1);const source=sheet.getRange(row+1,1,1,4),destination=sheet.getRange(row,1,1,4);source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);}
    sheet.getRange(row,1,1,4).setValues([[email,'OPERACAO',input.operation==='issue',false]]);
    logAccessChange_(user.email,email,input.operation==='deactivate'?'DESATIVADO':existing?'CHAVE_REEMITIDA':'OPERADOR_CADASTRADO');
    return {ok:true,email,token,active:input.operation==='issue'};
  });
}
