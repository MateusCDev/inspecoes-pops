// Integração POPs — arquivo único para o Bd.gs do projeto existente.
// Substitui somente o conteúdo anterior de Bd.gs desta integração.
// Não é necessário criar schema.gs separado nesta alternativa.
// Antes de implantar, verificar se outro arquivo já declara doPost.
// Se existir, integrar o encaminhamento na função existente em vez de duplicá-la.
const BdInspecoesPOPs = (() => {
'use strict';
// Extraído da aplicação v2.2 fornecida pelo usuário.
const groups=[
 {key:'energia',title:'Energia elétrica e proteções',icon:'⚡',items:[['EL-01','Identificação dos quadros, circuitos e diagramas'],['EL-02','Conservação externa, tampas e acesso seguro'],['EL-03','Disjuntores, DPS e demais proteções: inspeção técnica'],['EL-04','Aterramento e equipotencialização: evidências / laudo'],['EL-05','Medições elétricas / termografia (quando autorizadas)']]},
 {key:'retificacao',title:'Retificadores e alimentação CC',icon:'🔌',items:[['CC-01','Fabricante, modelo, tensão nominal e módulos instalados'],['CC-02','Carga atual, capacidade e margem de expansão'],['CC-03','Alarmes, sinalizações e monitoramento remoto'],['CC-04','Redundância / módulos sobressalentes']]},
 {key:'baterias',title:'Banco de baterias',icon:'🔋',items:[['BT-01','Quantidade, modelo, Ah e datas de instalação'],['BT-02','Estado visual, bornes e conexões (sem manipulação)'],['BT-03','Arranjo elétrico e condição de proteção'],['BT-04','Tensões / ensaios / autonomia por equipe habilitada']]},
 {key:'clima',title:'Climatização e ambiente',icon:'❄️',items:[['CL-01','Fabricante, modelo, capacidade, idade e quantidade'],['CL-02','Filtragem, conservação, drenagem e condensadora'],['CL-03','Temperatura / umidade reais medidas na sala'],['CL-04','Redundância, alarmes e registros de manutenção']]},
 {key:'telecom',title:'Telecomunicações e fibras',icon:'🌐',items:[['TC-01','Modelo, patrimônio, número de série e função dos ativos'],['TC-02','Portas utilizadas, identificação e inventário lógico'],['TC-03','Alarmes e operação confirmados por sistema de gestão'],['TC-04','Organização, fixação e raio de curvatura dos cabos'],['TC-05','Rotas, redundância e documentação de enlaces']]},
 {key:'predial',title:'Infraestrutura física e segurança',icon:'🏢',items:[['IF-01','Paredes, teto, piso e sinais de umidade/infiltração'],['IF-02','Vedação de janelas, portas e passagens de cabos'],['IF-03','Rack, fixação, ventilação e limpeza técnica'],['IF-04','Controle de acesso e medidas contra incêndio'],['IF-05','Identificação e condições gerais da estação']]},
 {key:'torre',title:'Estrutura de torre',icon:'🗼',items:[
  ['TR-01','Condição visual externa da estrutura e da pintura/proteção anticorrosiva'],
  ['TR-02','Base aparente, fundação e indícios visuais de fissuras ou movimentação'],
  ['TR-03','Estais, fixações e ancoragens: evidências visuais disponíveis'],
  ['TR-04','Acesso restrito, sinalização e impedimentos de segurança'],
  ['TR-05','Sistema de aterramento e proteção contra descargas: registros de inspeção/laudo'],
  ['TR-06','Iluminação de obstáculo, quando exigida, confirmada por responsável'],
  ['TR-07','Relatório estrutural / manutenção vigente, se aplicável']
 ]},
 {key:'cftv',title:'Monitoramento por câmeras (CFTV)',icon:'📹',items:[
  ['CV-01','Existência e identificação do sistema de câmeras'],
  ['CV-02','Estado visual dos dispositivos e acessórios acessíveis'],
  ['CV-03','Câmeras apresentam imagem quando verificado em sistema autorizado'],
  ['CV-04','Gravação efetivamente confirmada em teste autorizado'],
  ['CV-05','Consulta de gravação anterior validada, se autorizada'],
  ['CV-06','Alertas de indisponibilidade e suporte documentados'],
  ['CV-07','Requisitos de privacidade e acesso restrito verificados']
 ]},
 {key:'monitoramento',title:'Monitoramento e histórico',icon:'📡',items:[['MO-01','Sensores ambientais e monitoração remota'],['MO-02','Alarmes ativos, registro de eventos e escalonamento'],['MO-03','Existência de procedimentos de contingência'],['MO-04','Falhas repetidas, manutenções e pendências anteriores']]}
];

const fields=[['nome','Estação / código'],['municipio','Município / endereço'],['ocupacao','Tipo de ocupação'],['parceiroOcupacao','Proprietário / parceiro'],['contatoOcupacao','Contato para acesso'],['horarioAcesso','Horário / condição de acesso'],['restricoesAcesso','Restrições de acesso'],['latitude','Latitude'],['longitude','Longitude'],['data','Data da vistoria'],['inicio','Horário de início'],['fim','Horário de término'],['inspetor','Técnico 01'],['inspetorAux','Técnico 02'],['equipe','Equipe'],['os','OS / SIGA+'],['tipo','Tipo de inspeção'],['acesso','Condições de acesso'],['funcao','Função da estação / serviços'],['impacto','Clientes / serviços impactados'],['enlaces','Enlaces / dependências'],['redundancia','Redundância de energia / rede'],['historico','Histórico de falhas e OS'],['observacoes','Observações gerais'],['classificacao','Criticidade operacional'],['sintese','Síntese técnica'],['investimentos','Investimentos e recomendações']];
const readings=[['tensaoAC','Tensão CA (V)'],['correnteCA','Corrente CA (A)'],['tensaoCC','Tensão CC (V)'],['cargaCC','Carga CC (A)'],['modulos','Módulos retificadores (ativos/total)'],['qtdBaterias','Quantidade de baterias'],['capBaterias','Capacidade nominal do banco (Ah)'],['autonomia','Autonomia verificada (min)'],['temp','Temperatura ambiente (°C)'],['umid','Umidade relativa (%)'],['arBTU','Capacidade de climatização (BTU/h)'],['ultimaPrev','Última preventiva (data)']];

// Executar como proprietário. Autorização por chaves individuais revogáveis.
const DESTINATION_SHEET = 'Inspecoes_POPs';
const CONFIG_DEFAULTS = {
  SPREADSHEET_ID: '1WArVbYwKaiWkhgNxeNXdbPx4OK5tNqyJcDRbFp91Gf8',
  PDF_FOLDER_ID: '1onSSKBtDs46OXBLaHZCOkh7rXKUFROHc',
  ACCESS_SPREADSHEET_ID: '1IRXgtRt8_oS1I5MuKD29MUrWv9xUNRibbuT_szs34j4'
};
function config_() {return Object.assign({}, CONFIG_DEFAULTS, PropertiesService.getScriptProperties().getProperties());}
function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(b => ((b+256)%256).toString(16).padStart(2,'0')).join('');
}
function createOperatorKey() {
  return issueAccessKeys_();
}
function headers_() {
  return ['id_inspecao','codigo_pop', ...fields.map(([k])=>k), 'created','updated','finalizedAt','schedulePeriod','scheduleBaseDate','scheduleDueDate',
    'itens_conformes','itens_nao_conformes','itens_nao_aplicaveis','itens_nao_verificados','itens_status_desconhecido','total_itens','qtd_pendencias','qtd_fotos',
    ...readings.map(([k])=>'leitura_'+k),
    ...groups.flatMap(g=>g.items.flatMap(([id])=>[id+'_status',id+'_observacao'])),
    'interligacoes_status','interligacoes_observacoes','pendencias_json','inventario_json','pdf_url','backup_url','recebido_em','operador_envio','hash_versao'];
}
function sheet_() {
  const book = SpreadsheetApp.openById(config_().SPREADSHEET_ID);
  const expected = headers_();
  let sheet = book.getSheetByName(DESTINATION_SHEET);
  if (!sheet) sheet = book.insertSheet(DESTINATION_SHEET);
  if (sheet.getMaxColumns() < expected.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), expected.length-sheet.getMaxColumns());
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,expected.length).setValues([expected]).setFontWeight('bold').setBackground('#ebebeb').setFontColor('#000000');
    sheet.setFrozenRows(1); sheet.setColumnWidths(1,expected.length,160);
    sheet.getRange(1,1,1,expected.length).createFilter();
  }
  if (JSON.stringify(sheet.getRange(1,1,1,expected.length).getValues()[0]) !== JSON.stringify(expected)) throw Error('Cabeçalho incompatível. Não foi gravado nenhum registro.');
  return sheet;
}
function setup() {
  requirePrivateData_();
  accessUsers_();
  const sheet = sheet_();
  DriveApp.getFolderById(config_().PDF_FOLDER_ID).getName();
  console.log('Aba preparada: ' + sheet.getName());
}
function text_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (text.length > 45000) throw Error('Um campo excede o limite da planilha. Divida ou reduza o conteúdo.');
  // Dados enviados pela equipe nunca viram fórmulas.
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
function row_(r, result, operator, hash) {
  const checks = groups.flatMap(g=>g.items.map(([id])=>r.checks?.[id]?.status || 'NV')).concat([r.interligacoes?.status || 'NV']);
  const counts = Object.fromEntries(['C','NC','NA','NV'].map(s=>[s,checks.filter(x=>x===s).length]));
  const values = [r.id,r.codigoPop || '',...fields.map(([k])=>r[k]),r.created,r.updated,r.finalizedAt,r.schedulePeriod,r.scheduleBaseDate,r.scheduleDueDate,
    counts.C,counts.NC,counts.NA,counts.NV,checks.filter(x=>!['C','NC','NA','NV'].includes(x)).length,checks.length,(r.issues||[]).length,(r.photos||[]).length,
    ...readings.map(([k])=>r.readings?.[k]),
    ...groups.flatMap(g=>g.items.flatMap(([id])=>[r.checks?.[id]?.status||'NV',r.checks?.[id]?.note||''])),
    r.interligacoes?.status||'NV',r.interligacoes?.observacoes,
    JSON.stringify(r.issues||[]),JSON.stringify({inventory:r.inventory,equipamentos:r.equipamentos,transceivers:r.invTransceivers,bancos:r.invBatteryBanks}),
    result.pdfUrl,result.backupUrl,result.receivedAt,operator,hash];
  return values.map(text_);
}
function validate_(r) {
  if (!r || !/^INSP-[A-Za-z0-9-]+$/.test(r.id||'') || !r.nome?.trim() || !r.inspetor?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(r.data||'') || !r.finalizedAt || !r.updated) throw Error('Inspeção incompleta.');
  if (!Number.isFinite(Date.parse(r.updated)) || !Number.isFinite(Date.parse(r.finalizedAt))) throw Error('Datas de atualização/finalização inválidas.');
  if (!Array.isArray(r.photos) || !Array.isArray(r.photoFiles) || r.photos.length !== r.photoFiles.length || r.photos.length > 100) throw Error('Fotografias incompletas ou limite de 100 fotos excedido.');
  const ids = new Set();
  r.photoFiles.forEach(p => {
    if (!r.photos.some(meta=>meta.id===p.id) || ids.has(p.id) || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data||'')) throw Error('Fotografia inválida.');
    ids.add(p.id);
  });
}
function addObject_(body, heading, value) {
  if (!value || (typeof value === 'object' && !Object.keys(value).length)) return;
  body.appendParagraph(heading).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  if (typeof value !== 'object') {body.appendParagraph(String(value)); return;}
  if (Array.isArray(value)) {value.forEach((item,i)=>addObject_(body,heading+' — '+(i+1),item)); return;}
  const scalar = Object.entries(value).filter(([,v])=>v === null || typeof v !== 'object').map(([k,v])=>[k,String(v??'')]);
  if (scalar.length) body.appendTable(scalar);
  Object.entries(value).filter(([,v])=>v && typeof v === 'object').forEach(([k,v])=>addObject_(body,k,v));
}
function createPdf_(r, folder, name) {
  const doc = DocumentApp.create(name);
  const temporary = DriveApp.getFileById(doc.getId());
  try {
    // O documento temporário recebe as permissões da pasta de destino.
    temporary.moveTo(folder);
    const body = doc.getBody();
    body.appendParagraph('VOANET — Inspeção de infraestrutura').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph(r.id);
    body.appendTable(fields.map(([k,label])=>[label,String(r[k]??'')]));
    addObject_(body,'Programação',{periodicidade:r.schedulePeriod,dataBase:r.scheduleBaseDate,proxima:r.scheduleDueDate});
    groups.forEach(g=>{
      body.appendParagraph(g.title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendTable([['Item','Situação','Observação'],...g.items.map(([id,title])=>[id+' — '+title,String(r.checks?.[id]?.status||'NV'),String(r.checks?.[id]?.note||'')])]);
    });
    body.appendParagraph('C = Conforme · NC = Não conforme · NA = Não se aplica · NV = Não verificado');
    addObject_(body,'Interligações',r.interligacoes);
    body.appendParagraph('Leituras').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendTable(readings.map(([k,label])=>[label,String(r.readings?.[k]??'')]));
    // Todos os demais campos são preservados no PDF, inclusive inventários e conferências.
    const skip = new Set([...fields.map(([k])=>k),'checks','readings','interligacoes','photos','photoFiles','id']);
    Object.keys(r).filter(k=>!skip.has(k)).forEach(k=>addObject_(body,k,r[k]));
    body.appendParagraph('Evidências fotográficas').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    r.photos.forEach((p,index)=>{
      const photo = r.photoFiles.find(f=>f.id===p.id);
      const mime = photo.data.slice(5,photo.data.indexOf(';'));
      body.appendParagraph((index+1)+'. '+String(p.name||p.id));
      body.appendParagraph(JSON.stringify(p));
      const image = body.appendImage(Utilities.newBlob(Utilities.base64Decode(photo.data.split(',')[1]),mime));
      const scale = Math.min(1,450/image.getWidth(),500/image.getHeight());
      image.setWidth(Math.round(image.getWidth()*scale)).setHeight(Math.round(image.getHeight()*scale));
    });
    doc.saveAndClose();
    return folder.createFile(temporary.getAs(MimeType.PDF).setName(name+'.pdf'));
  } finally { temporary.setTrashed(true); }
}
function reply_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e) {
  let lock = null;
  const created = [];
  let committed = false;
  try {
    if (!e?.postData?.contents || e.postData.contents.length > 15*1024*1024) throw Error('Requisição vazia ou maior que 15 MB.');
    const input = JSON.parse(e.postData.contents);
    const user = authenticate_(input);
    if (!user) return reply_({ok:false,code:'AUTH',error:'Chave inválida, revogada ou ainda não vinculada a uma pessoa ativa.'});
    requirePrivateData_();
    if (input.version !== 1) throw Error('Versão incompatível.');
    if (input.action === 'session') return reply_({ok:true,user});
    if (input.action === 'stations') return reply_({ok:true,stations:stations_()});
    if (input.action === 'list') return reply_(listInspections_(input,user));
    if (input.action === 'pdf') return reply_(downloadPdf_(input,user));
    if (input.action && input.action !== 'submit') throw Error('Operação desconhecida.');
    const r = input.record;
    validate_(r);
    const schedule = applyScheduling_(r);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw Error('Outro envio está em andamento. Tente novamente.');
    const sheet = sheet_(), headers = headers_();
    const matches = sheet.getLastRow()>1 ? sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(r.id).matchEntireCell(true).findAll() : [];
    if (matches.length > 1) throw Error('ID duplicado na planilha. Contate o responsável.');
    const existing = matches.length ? matches[0].getRow() : null;
    let operator = recordOwner_(r.id) || user.email, previous = null;
    if (operator !== user.email && user.role !== 'GESTAO') throw Error('Registro indisponível.');
    if (existing) {
      previous = sheet.getRange(existing,1,1,headers.length).getValues()[0];
      if (!canReadRow_(previous,headers,user)) throw Error('Registro indisponível.');
    }
    // Autoria é definida pelo servidor, nunca pelo inspetor/e-mail/perfil do formulário.
    r.ownerEmail = operator;
    const hash = hash_(JSON.stringify(r));
    row_(r,{},operator,hash);
    const revision = recordRevision_(r.id);
    if (previous) {
      if (revision?.hash === hash) {
        const pdfId=PropertiesService.getScriptProperties().getProperty('PDF_'+hash_(r.id));
        if(pdfId)return reply_({ok:true,inspectionId:r.id,pdfUrl:DriveApp.getFileById(pdfId).getUrl(),receivedAt:revision.receivedAt,schedule});
      }
    }
    if (revision && revision.hash !== hash && revision.updated >= r.updated) throw Error('Existe uma versão mais recente ou conflitante desta inspeção. Contate o responsável.');
    // Reservar a autoria antes de gravar. Uma falha não transfere o ID a outra pessoa.
    PropertiesService.getScriptProperties().setProperty('OWNER_'+hash_(r.id),operator);
    const folder = DriveApp.getFolderById(config_().PDF_FOLDER_ID);
    const name = r.id+'_'+hash.slice(0,12);
    // Nome determinístico permite recuperar arquivos criados antes de uma falha/timeout.
    function artifact(fileName, create) {
      const files = folder.getFilesByName(fileName);
      if (files.hasNext()) return files.next();
      const f = create(); created.push(f); return f;
    }
    const pdf = artifact(name+'.pdf',()=>createPdf_(r,folder,name));
    const clean = JSON.parse(JSON.stringify(r)); delete clean.photoFiles;
    const backup = artifact(name+'.json',()=>folder.createFile(name+'.json',JSON.stringify(clean),MimeType.PLAIN_TEXT));
    const result = {ok:true,inspectionId:r.id,pdfUrl:pdf.getUrl(),backupUrl:backup.getUrl(),receivedAt:new Date().toISOString(),schedule};
    const target = existing || sheet.getLastRow()+1;
    if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),100);
    // Autoria privada: a coluna pública não é usada para conceder acesso.
    sheet.getRange(target,1,1,headers.length).setValues([row_(r,result,operator,hash)]);
    // Após setValues, preservar arquivos mesmo se flush falhar: a escrita pode já ter persistido.
    committed = true;
    PropertiesService.getScriptProperties().setProperty('PDF_'+hash_(r.id),pdf.getId());
    PropertiesService.getScriptProperties().setProperty('REVISION_'+hash_(r.id),JSON.stringify({hash,updated:r.updated,receivedAt:result.receivedAt}));
    SpreadsheetApp.flush();
    return reply_(result);
  } catch (error) {
    if (!committed) created.forEach(file=>{try{file.setTrashed(true);}catch(_){}});
    return reply_({ok:false,error:'Envio não concluído: '+error.message});
  } finally {if(lock?.hasLock()) lock.releaseLock();}
}
function doGet() {return reply_({ok:true,service:'VOANET — recebimento de inspeções',version:1});}

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
  const book = SpreadsheetApp.openById(config_().ACCESS_SPREADSHEET_ID);
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
function recordOwner_(id) {return PropertiesService.getScriptProperties().getProperty('OWNER_'+hash_(String(id)))||'';}
function recordRevision_(id) {return JSON.parse(PropertiesService.getScriptProperties().getProperty('REVISION_'+hash_(String(id)))||'null');}
function listInspections_(input,user) {
  const sheet=sheet_(),headers=headers_(),limit=50;
  let cursor=input.cursor===undefined?sheet.getLastRow():Number(input.cursor);
  if (!Number.isInteger(cursor)||cursor<1||cursor>sheet.getLastRow()) throw Error('Página inválida.');
  const items=[];
  while(cursor>1&&items.length<limit){
    const start=Math.max(2,cursor-99);
    const block=sheet.getRange(start,1,cursor-start+1,headers.length).getValues();
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
  const pdfId=PropertiesService.getScriptProperties().getProperty('PDF_'+hash_(input.inspectionId));
  if(!pdfId)throw Error('PDF ainda não vinculado pelo serviço.');
  const file=DriveApp.getFileById(pdfId);
  if(file.getSize()>15*1024*1024)throw Error('PDF maior que 15 MB. Solicite o arquivo à gestão.');
  return {ok:true,fileName:input.inspectionId+'.pdf',base64:Utilities.base64Encode(file.getBlob().getBytes())};
}

function schedulingDays_(criticality){
  const normalized=String(criticality||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  if(['ALTA','CRITICA','CRITICO'].includes(normalized))return 45;
  if(normalized==='MEDIA')return 90;
  return null;
}
function stations_(){
  const sheet=SpreadsheetApp.openById(config_().SPREADSHEET_ID).getSheetByName('POPs');
  if(!sheet||sheet.getLastRow()<1)throw Error('Cadastro de POPs indisponível.');
  const data=sheet.getRange(1,1,sheet.getLastRow(),10).getValues(),header=data.shift();
  if(header[0]!=='Código'||header[1]!=='Nome da Estação'||header[8]!=='Criticidade')throw Error('Cabeçalho do cadastro de POPs incompatível.');
  const stations=data.flatMap(row=>{
    const code=String(row[0]??'').trim(),name=String(row[1]??'').trim();
    if(!code||!name)return [];
    const criticality=String(row[8]||'').trim();
    const inactive=code==='PCAM.021'&&name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()==='POP CORDEBRAS';
    return [{code,name,city:String(row[3]||''),criticality,days:schedulingDays_(criticality),inactive}];
  });
  const counts=Object.create(null);stations.filter(s=>!s.inactive).forEach(s=>counts[s.code]=(counts[s.code]||0)+1);
  return stations.map(s=>({...s,duplicate:!s.inactive&&counts[s.code]>1}));
}
function addInspectionDays_(date,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Data de vistoria inválida.');
  const d=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Data de vistoria inválida.');
  d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function applyScheduling_(record){
  const code=String(record.codigoPop??'').trim(),catalog=stations_();
  if(catalog.some(s=>s.inactive&&s.code===code&&s.name===record.nome))throw Error('Este POP foi retirado da programação de inspeções.');
  const station=catalog.find(s=>s.code===code&&!s.inactive);
  if(!station)throw Error('Selecione um código do cadastro de POPs.');
  if(station.duplicate)throw Error('O código deste POP está duplicado no cadastro. Solicite a correção à gestão.');
  if(!station.days)throw Error('A criticidade deste POP ainda não tem periodicidade definida.');
  record.codigoPop=station.code;record.nome=station.name;record.popCriticality=station.criticality;
  record.schedulePeriod=station.days;record.scheduleBaseDate=record.data;
  record.scheduleDueDate=addInspectionDays_(record.data,station.days);
  return {days:station.days,baseDate:record.data,dueDate:record.scheduleDueDate,criticality:station.criticality};
}

return { setup, createOperatorKey, doPost };
})();

function prepararInspecoesPOPs() {
  return BdInspecoesPOPs.setup();
}

function criarChaveInspecoesPOPs() {
  return BdInspecoesPOPs.createOperatorKey();
}

function receberInspecoesPOPs(e) {
  return BdInspecoesPOPs.doPost(e);
}

// Este é o ponto de entrada do aplicativo Web. O projeto deve ter somente um doPost.
function doPost(e) {
  return receberInspecoesPOPs(e);
}
