let googleAccessUsers=[],googleAccessBusy=false,googleIssuedKey=null;
function googleClearAccessState(){googleAccessUsers=[];googleAccessBusy=false;googleIssuedKey=null;}
function googleAccessView(){
  if(googleUser?.role!=='GESTAO')return '<div class="card">Acesso restrito à gestão.</div>';
  return `<div class="shell" style="display:block;max-width:1000px">${googleProfilePanel()}<div class="card"><div class="card-head"><h1>Gerenciar acessos</h1>${button('home','Voltar','tiny')}</div><p>Cadastre um operador pelo e-mail e entregue sua chave individual. Os perfis de Gestão são mantidos pelo responsável pela configuração.</p><form id="googleCreateOperator" class="grid"><div class="field"><label for="operator-email">E-mail do novo operador</label><input id="operator-email" name="email" type="email" required autocomplete="off" placeholder="colaborador@empresa.com.br"></div><button class="btn primary" type="submit" ${googleAccessBusy?'disabled':''}>Cadastrar e gerar chave</button></form><p id="access-message" role="status">${googleAccessBusy?'Carregando…':''}</p></div>${googleIssuedKey?`<div class="card"><h2>Chave gerada para ${esc(googleIssuedKey.email)}</h2><p>Copie e entregue somente a esse colaborador. A chave será ocultada ao sair desta tela.</p><div class="field"><label for="issued-access-key">Chave individual</label><input id="issued-access-key" type="password" readonly value="${esc(googleIssuedKey.token)}" autocomplete="off"></div><div class="btnrow">${button('googleCopyKey','Copiar chave','primary')}${button('googleShowKey','Mostrar / ocultar','tiny')}</div></div>`:''}<div class="card"><h2>Equipe cadastrada</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${googleAccessUsers.map(u=>`<tr><td>${esc(u.email)}</td><td>${u.role==='GESTAO'?'Gestão':'Operação'}</td><td>${u.active?'Ativo':'Desativado'}</td><td>${u.role==='OPERACAO'?button('googleIssueAccess:'+encodeURIComponent(u.email),u.active?'Reemitir chave':'Gerar chave e ativar','tiny')+(u.active?button('googleDisableAccess:'+encodeURIComponent(u.email),'Desativar','danger tiny'):''):'Administrado pelo responsável'}</td></tr>`).join('')||'<tr><td colspan="4">Aguardando consulta da equipe.</td></tr>'}</tbody></table></div><p class="small muted">Reemitir uma chave invalida a anterior. Desativar impede novos acessos, preservando o histórico das inspeções.</p></div></div>`;
}
async function googleLoadAccess(){
  if(!googleUser||googleUser.role!=='GESTAO'||googleAccessBusy)return;googleAccessBusy=true;const session=googleSession;render();
  try{const result=await googleRpc('users');if(session===googleSession)googleAccessUsers=result.users;}
  catch(error){if(session===googleSession)alert(error.message);}
  finally{if(session===googleSession){googleAccessBusy=false;if(view==='googleAccess')render();}}
}
async function googleManageAccess(email,operation){
  if(!googleUser||googleUser.role!=='GESTAO'||googleAccessBusy)return;
  const existing=googleAccessUsers.find(u=>u.email===email);
  if(operation==='deactivate'&&!confirm('Desativar o acesso de '+email+'? O histórico será mantido.'))return;
  if(operation==='issue'&&existing&&!confirm('Gerar uma nova chave para '+email+'? A chave anterior deixará de funcionar.'))return;
  googleAccessBusy=true;googleIssuedKey=null;const session=googleSession,key=googleAccessKey;render();
  try{
    const result=await googleRpc('manageOperator',{email,operation,role:'OPERACAO'},key);if(session!==googleSession)return;
    if(operation==='issue')googleIssuedKey={email:result.email,token:result.token};
    const list=await googleRpc('users',{},key);if(session===googleSession)googleAccessUsers=list.users;
  }catch(error){if(session===googleSession)alert(error.message);}
  finally{if(session===googleSession){googleAccessBusy=false;if(view==='googleAccess')render();}}
}
document.addEventListener('submit',e=>{if(e.target.id==='googleCreateOperator'){e.preventDefault();googleManageAccess(e.target.elements.email.value.trim().toLowerCase(),'issue');}});
document.addEventListener('click',async e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='home'||action==='googleExit'||action==='googleCentral')googleIssuedKey=null;
  if(googleUser?.role!=='GESTAO')return;
  if(action==='googleAccess'){googleIssuedKey=null;view='googleAccess';render();googleLoadAccess();}
  if(action?.startsWith('googleIssueAccess:'))googleManageAccess(decodeURIComponent(action.split(':')[1]),'issue');
  if(action?.startsWith('googleDisableAccess:'))googleManageAccess(decodeURIComponent(action.split(':')[1]),'deactivate');
  if(action==='googleShowKey'){const field=document.getElementById('issued-access-key');if(field)field.type=field.type==='password'?'text':'password';}
  if(action==='googleCopyKey'&&googleIssuedKey){
    try{await navigator.clipboard.writeText(googleIssuedKey.token);const message=document.getElementById('access-message');if(message)message.textContent='Chave copiada. Entregue individualmente ao colaborador.';}
    catch(_){const field=document.getElementById('issued-access-key');if(field){field.focus();field.select();alert('Chave selecionada. Use Ctrl+C para copiar.');}}
  }
});
