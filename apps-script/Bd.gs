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
function config_() {return Object.assign({}, CONFIG_DEFAULTS, context_().values);}
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
  const book = book_(config_().SPREADSHEET_ID);
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
  beginRequest_();
  requirePrivateData_();
  accessUsers_();
  const sheet = sheet_();
  DriveApp.getFolderById(config_().PDF_FOLDER_ID).getName();
  ensureUploadSecret_();prepareAssetSheets_();installQueueTrigger_();
  console.log('Aba preparada: ' + sheet.getName() + ' · fila automática instalada.');
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
    if (!r.photos.some(meta=>meta.id===p.id) || ids.has(p.id) || (!p.fileId&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data||''))) throw Error('Fotografia inválida.');
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
      body.appendParagraph((index+1)+'. '+String(p.name||p.id));
      body.appendParagraph(JSON.stringify(p));
      const image = body.appendImage(photoBlob_(photo));
      const scale = Math.min(1,450/image.getWidth(),500/image.getHeight());
      image.setWidth(Math.round(image.getWidth()*scale)).setHeight(Math.round(image.getHeight()*scale));
    });
    doc.saveAndClose();
    return folder.createFile(temporary.getAs(MimeType.PDF).setName(name+'.pdf'));
  } finally { temporary.setTrashed(true); }
}
function reply_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e) {
  try {
    beginRequest_();
    if(!e?.postData?.contents||e.postData.contents.length>15*1024*1024)throw Error('Requisição vazia ou maior que 15 MB.');
    const input=JSON.parse(e.postData.contents),user=authenticate_(input);
    if(!user)return reply_({ok:false,code:'AUTH',error:'Chave inválida, revogada ou ainda não vinculada a uma pessoa ativa.'});
    requirePrivateData_();
    if(input.version!==1)throw Error('Versão incompatível.');
    if(input.action==='session')return reply_({ok:true,user,capabilities:{apiVersion:2,stagedPhotos:true,summary:true,assetsSync:true,accessAdmin:true}});
    if(input.action==='users')return reply_(listAccess_(user));
    if(input.action==='manageOperator')return reply_(manageOperator_(input,user));
    if(input.action==='stations')return reply_({ok:true,stations:stations_()});
    if(input.action==='list')return reply_(listInspections_(input,user));
    if(input.action==='dashboard')return reply_(dashboard_(input,user));
    if(input.action==='photo')return reply_(stagePhoto_(input,user));
    if(input.action==='pdf')return reply_(downloadPdf_(input,user));
    if(input.action==='assetIssues')return reply_(assetIssues_(input,user));
    if(input.action==='status')return reply_(inspectionStatus_(input,user));
    if(input.action==='process'){
      inspectionStatus_(input,user); // Verifica a autoria antes de qualquer processamento.
      return reply_(processJob_(input.inspectionId)||inspectionStatus_(input,user));
    }
    if(input.action==='reprocessAssets'){
      inspectionStatus_(input,user);
      const revision=recordRevision_(input.inspectionId);if(!revision?.payloadId)throw Error('Registro antigo sem cópia de processamento.');
      return reply_(enqueueInspection_(readJsonFile_(revision.payloadId),user,true));
    }
    if(input.action&&input.action!=='submit')throw Error('Operação desconhecida.');
    const result=enqueueInspection_(input.record,user);
    // Compatibilidade: clientes anteriores ainda aguardam a confirmação completa.
    if(result.pending&&!input.queue)return reply_(processJob_(input.record.id)||result);
    return reply_(result);
  }catch(error){return reply_({ok:false,error:'Envio não concluído: '+error.message});}
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

function schedulingDays_(criticality){
  const normalized=String(criticality||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  if(['ALTA','CRITICA','CRITICO'].includes(normalized))return 45;
  if(normalized==='MEDIA')return 90;
  return null;
}
function stations_(){
  const sheet=book_(config_().SPREADSHEET_ID).getSheetByName('POPs');
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

// Somente valores privados são mantidos durante uma execução, nunca credenciais no cliente.
let requestContext_ = null;
function beginRequest_(){
  const store=PropertiesService.getScriptProperties();
  requestContext_={store,values:Object.assign({},store.getProperties()),books:{}};
}
function context_(){if(!requestContext_)beginRequest_();return requestContext_;}
function privateValue_(key){return context_().values[key];}
function setPrivate_(key,value){context_().store.setProperty(key,value);context_().values[key]=value;}
function deletePrivate_(key){context_().store.deleteProperty(key);delete context_().values[key];}
function book_(id){return context_().books[id]||(context_().books[id]=SpreadsheetApp.openById(id));}
function withWriteLock_(fn){
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('Outro registro está sendo gravado. Tente novamente.');
  try{beginRequest_();return fn();}finally{lock.releaseLock();}
}
function artifact_(folder,name,create){const files=folder.getFilesByName(name);return files.hasNext()?files.next():create();}
function readJsonFile_(id){return JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));}
function storedResult_(id,revision){
  const pdfId=privateValue_('PDF_'+hash_(id));
  return pdfId?{ok:true,inspectionId:id,hash:revision.hash,pdfUrl:DriveApp.getFileById(pdfId).getUrl(),receivedAt:revision.receivedAt,schedule:revision.schedule,assets:revision.assets}:null;
}

function ensureUploadSecret_(){
  if(!privateValue_('UPLOAD_SECRET'))setPrivate_('UPLOAD_SECRET',Utilities.getUuid()+Utilities.getUuid());
}
function photoSignature_(owner,inspectionId,photo){
  const secret=privateValue_('UPLOAD_SECRET');if(!secret)throw Error('Execute prepararInspecoesPOPs para habilitar o envio de fotos.');
  return Utilities.computeHmacSha256Signature(JSON.stringify([owner,inspectionId,photo.id,photo.fileId,photo.digest,photo.byteLength]),secret,Utilities.Charset.UTF_8).map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('');
}
function stagePhoto_(input,user){
  if(!/^INSP-[A-Za-z0-9-]+$/.test(input.inspectionId||'')||!/^[A-Za-z0-9_-]+$/.test(input.photoId||''))throw Error('Identificação de foto inválida.');
  const owner=recordOwner_(input.inspectionId);
  if(owner&&owner!==user.email&&user.role!=='GESTAO')throw Error('Registro indisponível.');
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.data||''))throw Error('Imagem inválida.');
  const digest=hash_(input.data),folder=DriveApp.getFolderById(config_().PDF_FOLDER_ID);
  const name='foto_'+hash_(user.email+'|'+input.inspectionId+'|'+input.photoId+'|'+digest)+'.img';
  const mime=input.data.slice(5,input.data.indexOf(';'));
  const bytes=Utilities.base64Decode(input.data.split(',')[1]);
  const file=artifact_(folder,name,()=>folder.createFile(Utilities.newBlob(bytes,mime,name)));
  const photo={id:input.photoId,fileId:file.getId(),digest,byteLength:bytes.length};
  photo.signature=photoSignature_(user.email,input.inspectionId,photo);
  return {ok:true,photo};
}
function validatePhotoRefs_(r,actor){
  let total=JSON.stringify({...r,photoFiles:[]}).length;
  for(const photo of r.photoFiles){
    if(photo.data){total+=photo.data.length;continue;}
    if(!photo.fileId||!photo.digest||photo.signature!==photoSignature_(actor,r.id,photo))throw Error('Vínculo da fotografia inválido.');
    total+=Math.ceil(photo.byteLength*4/3)+128;
  }
  if(total>15*1024*1024)throw Error('O conjunto de fotos e dados excede 15 MB.');
}
function photoBlob_(photo){
  if(photo.data){const mime=photo.data.slice(5,photo.data.indexOf(';'));return Utilities.newBlob(Utilities.base64Decode(photo.data.split(',')[1]),mime);}
  return DriveApp.getFileById(photo.fileId).getBlob();
}

const JOB_LEASE_MS=7*60*1000;
function jobKey_(id){return 'JOB_'+hash_(id);}
function pendingResult_(job){return {ok:true,pending:true,inspectionId:job.id,hash:job.hash,state:job.state,schedule:job.schedule};}
function enqueueInspection_(record,user,reprocess=false){
  validate_(record);const schedule=reprocess?{days:record.schedulePeriod,baseDate:record.scheduleBaseDate,dueDate:record.scheduleDueDate,criticality:record.popCriticality}:applyScheduling_(record);if(!reprocess)validatePhotoRefs_(record,user.email);
  const job=withWriteLock_(()=>{
    const owner=recordOwner_(record.id)||user.email;
    if(owner!==user.email&&user.role!=='GESTAO')throw Error('Registro indisponível.');
    record.ownerEmail=owner;const hash=hash_(JSON.stringify(record));row_(record,{},owner,hash);
    const revision=recordRevision_(record.id);
    if(!reprocess&&revision?.hash===hash){const result=storedResult_(record.id,revision);if(result)return {result};}
    if(revision&&revision.hash!==hash&&revision.updated>=record.updated)throw Error('Existe uma versão mais recente ou conflitante.');
    const previous=JSON.parse(privateValue_(jobKey_(record.id))||'null');
    if(previous&&previous.state!=='erro'&&previous.leaseUntil>Date.now()){
      if(previous.hash!==hash)throw Error('A versão anterior ainda está em processamento. Aguarde sua conclusão.');
      return previous;
    }
    const current={id:record.id,hash,actor:user.email,owner,updated:record.updated,state:'recebendo',createdAt:new Date().toISOString(),leaseUntil:Date.now()+JOB_LEASE_MS,schedule,reprocess};
    setPrivate_('OWNER_'+hash_(record.id),owner);setPrivate_(jobKey_(record.id),JSON.stringify(current));return current;
  });
  if(job.result)return job.result;
  if(job.payloadId)return pendingResult_(job);
  try{
    const folder=DriveApp.getFolderById(config_().PDF_FOLDER_ID),name='envio_'+record.id+'_'+job.hash+'.json';
    const file=artifact_(folder,name,()=>folder.createFile(name,JSON.stringify(record),MimeType.PLAIN_TEXT));
    return withWriteLock_(()=>{
      const current=JSON.parse(privateValue_(jobKey_(record.id))||'null');
      if(!current||current.hash!==job.hash)throw Error('O envio foi substituído por outra versão.');
      if(current.state==='recebendo'){current.payloadId=file.getId();current.state='na_fila';setPrivate_(jobKey_(record.id),JSON.stringify(current));}
      return pendingResult_(current);
    });
  }catch(error){withWriteLock_(()=>{const current=JSON.parse(privateValue_(jobKey_(record.id))||'null');if(current?.hash===job.hash){current.state='erro';current.error=error.message;setPrivate_(jobKey_(record.id),JSON.stringify(current));}});throw error;}
}
function inspectionStatus_(input,user){
  const owner=recordOwner_(input.inspectionId);if(!owner||(owner!==user.email&&user.role!=='GESTAO'))throw Error('Registro indisponível.');
  const job=JSON.parse(privateValue_(jobKey_(input.inspectionId))||'null');
  if(job){if(job.state==='erro')return {ok:false,error:job.error||'Falha no processamento. Reenvie a inspeção.'};return pendingResult_(job);}
  const revision=recordRevision_(input.inspectionId);if(!revision)throw Error('Registro ainda não recebido.');
  return storedResult_(input.inspectionId,revision);
}
function processJob_(id){
  let job;
  try{
    job=withWriteLock_(()=>{
      const current=JSON.parse(privateValue_(jobKey_(id))||'null');
      if(!current||!current.payloadId||current.state==='erro')return null;
      if(current.state==='processando'&&current.leaseUntil>Date.now())return null;
      current.state='processando';current.leaseUntil=Date.now()+JOB_LEASE_MS;setPrivate_(jobKey_(id),JSON.stringify(current));return current;
    });
    if(!job)return null;
    const actor=accessUsers_().find(u=>u.active&&u.email===job.actor);if(!actor)throw Error('O acesso do autor do envio foi revogado.');
    const record=readJsonFile_(job.payloadId);validate_(record);if(!job.reprocess)validatePhotoRefs_(record,job.actor);
    const folder=DriveApp.getFolderById(config_().PDF_FOLDER_ID),name=id+'_'+job.hash.slice(0,12);
    // Conversão e imagens ficam fora do bloqueio de gravação compartilhado.
    const pdf=artifact_(folder,name+'.pdf',()=>createPdf_(record,folder,name));
    const clean=JSON.parse(JSON.stringify(record));delete clean.photoFiles;
    const backup=artifact_(folder,name+'.json',()=>folder.createFile(name+'.json',JSON.stringify(clean),MimeType.PLAIN_TEXT));
    return withWriteLock_(()=>{
      const current=JSON.parse(privateValue_(jobKey_(id))||'null');if(current?.hash!==job.hash)throw Error('Versão do envio alterada durante processamento.');
      const active=accessUsers_().find(u=>u.active&&u.email===job.actor);if(!active)throw Error('Acesso revogado.');
      const owner=recordOwner_(id);if(owner!==job.owner||(owner!==active.email&&active.role!=='GESTAO'))throw Error('Registro indisponível.');
      const sheet=sheet_(),headers=headers_();
      const matches=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findAll():[];
      if(matches.length>1)throw Error('ID duplicado na planilha.');
      const revision=recordRevision_(id);if(revision&&revision.hash!==job.hash&&revision.updated>=record.updated)throw Error('Versão mais recente já gravada.');
      const assets=syncAssets_(record,job.hash);
      const result={ok:true,inspectionId:id,pdfUrl:pdf.getUrl(),backupUrl:backup.getUrl(),receivedAt:revision?.hash===job.hash?revision.receivedAt:new Date().toISOString(),schedule:job.schedule,assets};
      const target=matches.length?matches[0].getRow():sheet.getLastRow()+1;if(target>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
      if(!job.reprocess||!matches.length)sheet.getRange(target,1,1,headers.length).setValues([row_(record,result,owner,job.hash)]);
      setPrivate_('PDF_'+hash_(id),pdf.getId());
      const compactAssets={created:assets.created,updated:assets.updated,unchanged:assets.unchanged,pending:assets.pending};
      setPrivate_('REVISION_'+hash_(id),JSON.stringify({hash:job.hash,updated:record.updated,receivedAt:result.receivedAt,schedule:job.schedule,assets:compactAssets,payloadId:job.payloadId}));
      setPrivate_('DATA_VERSION',Utilities.getUuid());deletePrivate_(jobKey_(id));SpreadsheetApp.flush();return result;
    });
  }catch(error){
    if(job){try{withWriteLock_(()=>{const current=JSON.parse(privateValue_(jobKey_(id))||'null');if(current?.hash===job.hash){current.state='erro';current.error=error.message;setPrivate_(jobKey_(id),JSON.stringify(current));}});}catch(_){}}
    return {ok:false,error:'Processamento pendente: '+error.message};
  }
}
function processQueue(){
  beginRequest_();requirePrivateData_();const start=Date.now();
  const jobs=Object.keys(context_().values).filter(k=>k.startsWith('JOB_')).map(k=>JSON.parse(privateValue_(k))).filter(j=>j.payloadId&&j.state!=='erro'&&(j.state!=='processando'||j.leaseUntil<Date.now())).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(const job of jobs){if(Date.now()-start>240000)break;processJob_(job.id);}
}
function installQueueTrigger_(){
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='processarFilaInspecoesPOPs'))ScriptApp.newTrigger('processarFilaInspecoesPOPs').timeBased().everyMinutes(1).create();
}

function summaryItem_(row,headers){
  const get=k=>row[headers.indexOf(k)],revision=recordRevision_(row[0]);
  return {id:row[0],stationCode:get('codigo_pop'),station:get('nome'),date:get('data'),updated:get('updated'),technician:get('inspetor'),owner:recordOwner_(row[0])||'Autoria não vinculada',criticality:get('classificacao'),nc:Number(get('itens_nao_conformes'))||0,conform:Number(get('itens_conformes'))||0,unverified:Number(get('itens_nao_verificados'))||0,due:get('scheduleDueDate'),period:get('schedulePeriod'),issues:Number(get('qtd_pendencias'))||0,assets:revision?.assets||null};
}
function dashboard_(input,user){
  const scope=user.role==='GESTAO'?'GESTAO':user.email+'|OPERACAO';
  const key='dash_'+hash_(scope+'|'+(privateValue_('DATA_VERSION')||'0'));
  const cache=CacheService.getScriptCache(),cached=cache.get(key);if(cached)return JSON.parse(cached);
  const sheet=sheet_(),headers=headers_(),last=sheet.getLastRow();
  const rows=last>1?sheet.getRange(2,1,last-1,43).getValues():[];
  let total=0,c=0,nc=0;const byPOP=Object.create(null),latest=new Map(),items=[];let nextCursor=null;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];if(!row[0]||!canReadRow_(row,headers,user))continue;
    const item=summaryItem_(row,headers);total++;c+=item.conform;nc+=item.nc;byPOP[item.station]=(byPOP[item.station]||0)+item.nc;
    const stationKey=String(item.stationCode||'')+'|'+item.station,old=latest.get(stationKey);
    if(!old||String(item.date)+String(item.updated)>String(old.date)+String(old.updated))latest.set(stationKey,item);
    if(items.length<50){items.push(item);if(items.length===50&&i>0)nextCursor=i+1;}
  }
  const result={ok:true,items,nextCursor,summary:{total,conform:c,nc,ranking:Object.entries(byPOP).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,8),latest:[...latest.values()]},refreshedAt:new Date().toISOString()};
  const serialized=JSON.stringify(result);if(serialized.length<90000)cache.put(key,serialized,45);return result;
}

const ASSET_TABS={
  Ativos:{station:'Local',width:7},
  'Climatização_Voanet':{station:'Estação',width:15},
  Controle_Baterias:{station:'Estação',width:18},
  Retificadores:{station:'Estação',width:18,date:'Data de Verficação'}
};
const ASSET_META=['ID_Ativo','Codigo_POP','ID_Ultima_Inspecao','Versao_Inspecao'];
const ASSET_AUDIT='Historico_Ativos_POPs';
const AUDIT_HEADERS=['ID_Evento','Momento','ID_Inspecao','Codigo_POP','Aba','ID_Ativo','Acao','Detalhe','Antes_JSON','Depois_JSON','Versao_Processamento'];
function assertAssetHeaders_(headers,name){
  if(name==='Retificadores'&&headers.includes('Data_Ultima_Inspecao')&&headers.includes('Data de Verficação'))throw Error('Datas de verificação redundantes em Retificadores.');
  const seen=new Set();
  for(const header of headers){let key=normalizeAsset_(header).replace(/[^A-Z0-9]/g,'');if(['NSERIE','NUMEROSERIE','SERIE'].includes(key))key='SERIE';if(['PATRIMONIO','PATRIMONIOREFERENCIA'].includes(key))key='PATRIMONIO';if(!key)continue;if(seen.has(key))throw Error('Colunas redundantes ou ambíguas em '+name+': '+header);seen.add(key);}
  const required=[...ASSET_META,'Nº Série','Patrimônio',ASSET_TABS[name].date||'Data_Ultima_Inspecao',ASSET_TABS[name].station,'Fabricante','Modelo'];
  if(!required.every(h=>headers.includes(h)))throw Error('Colunas de integração ainda não preparadas em '+name+'.');
}
function normalizeAsset_(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');}
function stationAssetKey_(value){return normalizeAsset_(value).replace(/^\w+[.-]\d+\s*[: -]\s*/,'').replace(/\bVOANET\b/g,'').replace(/[^A-Z0-9]/g,'');}
function identityTokens_(value,prefix){return String(value||'').split(/[,;\n]+/).map(x=>normalizeAsset_(x)).filter(x=>x&&!['N/A','NA','NAO IDENTIFICADO','SEM SERIE','SEM PATRIMONIO','-'].includes(x)).map(x=>prefix+x);}
function reviewed_(r,group){return ['mantido','alterado'].includes(r.inventoryReview?.[group]);}
function assetState_(v){return ({OPERACIONAL:'Operacional',ATENCAO:'Atenção','EM OBSERVACAO':'Atenção',CRITICO:'Crítico','SUBSTITUICAO RECOMENDADA':'Crítico',INATIVO:'Inativo',RETIRADA:'Inativo'})[normalizeAsset_(v)];}
function assetDate_(value){if(!value)return undefined;try{addInspectionDays_(String(value),0);return new Date(value+'T12:00:00Z');}catch(_){return {_invalidDate:String(value)};}}
function dateKey_(value){if(!value)return '';return value instanceof Date?Utilities.formatDate(value,'America/Sao_Paulo','yyyy-MM-dd'):typeof value==='number'?new Date((value-25569)*86400000).toISOString().slice(0,10):String(value).slice(0,10);}
function commonBattery_(units,key){const values=[...new Set(units.map(u=>u[key]).filter(v=>v!==undefined&&v!==''))];return values.length===1?values[0]:undefined;}
function assetCandidates_(r){
  const candidates=[],warnings=[];
  const push=(tab,item,values,kind)=>candidates.push({tab,item,values,kind,serial:item.serie||item.serial||'',patr:item.patrimonio||'',ref:item.centralId||'',label:item.modelo||item.identificacao||kind});
  const generic=(item,kind,equipment,values={})=>push('Ativos',item,{'Local':r.nome,'Categoria':kind,'Equipamento':equipment,'Fabricante':item.fabricante||item.marca,'Modelo':item.modelo,'Status':assetState_(item.estado),'Observações':item.observacao||item.observacoes,...values},kind);
  for(const item of r.inventory||[]){
    if(!reviewed_(r,'equipamentos')&&item.confirmacao!=='Confirmado na etiqueta'){warnings.push('Equipamento não conferido: '+(item.modelo||item.id));continue;}
    if(Number(item.quantidade||1)!==1){warnings.push('Equipamento agregado deve ser identificado por unidade: '+(item.modelo||item.id));continue;}
    const types={RETIFICADORA:'Retificadora',BATERIA:'Bateria','AR-CONDICIONADO':'Ar-condicionado',GERADOR:'Gerador',NOBREAK:'Nobreak',INVERSOR:'Inversor',TRANSMISSAO:'Transmissão',OLT:'OLT',ROTEADOR:'Roteador',SWITCH:'Switch',SEGURANCA:'Segurança'};
    generic(item,types[normalizeAsset_(item.tipo)]||'Outro',item.tipo||'Equipamento');
  }
  for(const item of r.equipamentos?.climatizadores||[]){
    if(!reviewed_(r,'climatizadores')){warnings.push('Climatizador não conferido: '+(item.modelo||item.id));continue;}
    generic(item,'Ar-condicionado','Ar-condicionado');
    push('Climatização_Voanet',item,{'Estação':r.nome,'Tipo Local':'POP','Fabricante':item.marca,'Modelo':item.modelo,'BTUs':item.capacidade,'Tipo':item.tipo,'Nº Série':item.serie,'Tipo de Gás':item.gas,'Carga Gás':item.cargaGas,'Data Instalação':assetDate_(item.instalacao),'Última Medição Corrente':item.corrente,'Última Medição Temperatura':item.temperatura,'Protocolo referencia':r.os},'Ar-condicionado');
  }
  for(const item of r.equipamentos?.retificadoras||[]){
    if(!reviewed_(r,'retificadoras')){warnings.push('Retificadora não conferida: '+(item.modelo||item.id));continue;}
    generic(item,'Retificadora','Sistema Retificador');
    push('Retificadores',item,{'Estação':r.nome,'Modelo':item.modelo,'Fabricante':item.fabricante,'Módulos':item.urInstaladas,'Corrente (A) (TOTAL)':item.capacidadeCC,'Tensão (V)':item.tensao,'UR 01':item.ur01,'UR 02':item.ur02,'UR 03':item.ur03,'UR 04':item.ur04,'Data de Verficação':assetDate_(r.data),'Proxima Verificação':assetDate_(r.scheduleDueDate),'Observações':item.observacao},'Retificadora');
  }
  for(const item of r.equipamentos?.dios||[]){if(reviewed_(r,'dios'))generic(item,'Transmissão','DIO');else warnings.push('DIO não conferido: '+(item.identificacao||item.id));}
  for(const item of r.invTransceivers||[]){if(reviewed_(r,'transceivers'))generic(item,'Transmissão','Transceiver '+(item.tipo||''));else warnings.push('Transceiver não conferido: '+(item.serie||item.id));}
  for(const bank of r.invBatteryBanks||[]){
    const units=bank.baterias||[];
    for(const unit of units){if(['mantida','substituida'].includes(r.batteryReview?.[unit.id]))generic(unit,'Bateria','Bateria');}
    if(bank.cadastroCompleto!==true||!units.length||units.some(u=>!['mantida','substituida'].includes(r.batteryReview?.[u.id])||u.estado==='Retirada')){warnings.push('Banco incompleto, não conferido ou com retirada: '+(bank.identificacao||bank.id));continue;}
    if(!commonBattery_(units,'modelo')||!commonBattery_(units,'fabricante')){warnings.push('Banco com modelo/fabricante misto ou ausente: '+(bank.identificacao||bank.id));continue;}
    const item={...bank,serie:units.map(u=>u.serie||'').filter(Boolean).sort().join(', '),patrimonio:units.map(u=>u.patrimonio||'').filter(Boolean).sort().join(', ')};
    const technology=commonBattery_(units,'tecnologia');
    const techMap={'CHUMBO-ACIDO':'CHUMBO-ÁCIDO (VRLA)','LIFEPO4':'LÍTIO (LiFePO4)'};
    push('Controle_Baterias',item,{'Estação':r.nome,'Tecnologia':techMap[normalizeAsset_(technology)]||technology,'Fabricante':commonBattery_(units,'fabricante'),'Modelo':commonBattery_(units,'modelo'),'Quantidade':units.length,'Patrimônio':item.patrimonio,'Descrição':bank.identificacao,'Ano Fabricante':assetDate_(commonBattery_(units,'fabricacao')),'Data Instalação':assetDate_(commonBattery_(units,'instalacao')),'Autonomia (h)':bank.autonomiaHoras,'Tensão Nominal (V)':bank.tensao,'Capacidade (Ah)':bank.capacidade,'Observações':bank.observacao},'Banco de baterias');
  }
  return {candidates,warnings};
}
function prepareAssetSheets_(){
  const book=book_(config_().SPREADSHEET_ID);
  for(const name of Object.keys(ASSET_TABS)){
    const sheet=book.getSheetByName(name);if(!sheet)throw Error('Aba cadastral ausente: '+name);
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    assertAssetHeaders_(headers,name);
  }
  const privateBook=book_(config_().ACCESS_SPREADSHEET_ID);let audit=privateBook.getSheetByName(ASSET_AUDIT);
  if(!audit){audit=privateBook.insertSheet(ASSET_AUDIT);audit.getRange(1,1,1,AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);audit.setFrozenRows(1);}
  else if(audit.getRange(1,11).getValue()!=='Versao_Processamento')audit.getRange(1,11).setValue('Versao_Processamento');
}
function assetTable_(name){
  const sheet=book_(config_().SPREADSHEET_ID).getSheetByName(name);if(!sheet)throw Error('Aba ausente: '+name);
  const width=sheet.getLastColumn(),range=sheet.getRange(1,1,Math.max(1,sheet.getLastRow()),width),values=range.getValues();
  assertAssetHeaders_(values[0],name);
  return {sheet,headers:values[0],values,width};
}
function sameAssetStation_(row,headers,r,config){
  const code=row[headers.indexOf('Codigo_POP')];if(code)return String(code).trim()===String(r.codigoPop);
  return stationAssetKey_(row[headers.indexOf(config.station)])===stationAssetKey_(r.nome);
}
function findAssetRow_(table,candidate,r){
  const h=table.headers,config=ASSET_TABS[candidate.tab],get=(row,k)=>row[h.indexOf(k)];
  const incoming=[...identityTokens_(candidate.serial,'S:'),...identityTokens_(candidate.patr,'P:')];
  const rows=table.values.slice(1).map((row,i)=>({row,index:i+2})).filter(x=>x.row.some(v=>v!==''));
  let matches=[];
  if(candidate.ref)matches=rows.filter(x=>get(x.row,'ID_Ativo')===candidate.ref);
  if(!matches.length&&incoming.length)matches=rows.filter(x=>{
    const identifiers=[...identityTokens_(get(x.row,'Nº Série'),'S:'),...identityTokens_(get(x.row,'Patrimônio'),'P:')];
    return incoming.some(id=>identifiers.includes(id));
  });
  if(!matches.length){
    const model=normalizeAsset_(candidate.values.Modelo),maker=normalizeAsset_(candidate.values.Fabricante);
    if(model&&maker)matches=rows.filter(x=>{
      if(!sameAssetStation_(x.row,h,r,config)||normalizeAsset_(get(x.row,'Modelo'))!==model||normalizeAsset_(get(x.row,'Fabricante'))!==maker)return false;
      if(candidate.tab==='Ativos'&&normalizeAsset_(get(x.row,'Categoria'))!==normalizeAsset_(candidate.values.Categoria))return false;
      const existingSerial=identityTokens_(get(x.row,'Nº Série'),'S:');
      if(existingSerial.length&&identityTokens_(candidate.serial,'S:').length&&!existingSerial.some(id=>incoming.includes(id)))return false;
      return true;
    });
  }
  if(matches.length>1)throw Error('Mais de um equipamento corresponde à identificação.');
  if(matches.length&&!sameAssetStation_(matches[0].row,h,r,config))throw Error('O equipamento está vinculado a outro POP; movimentação exige conferência.');
  if(matches.length){const oldMaker=normalizeAsset_(get(matches[0].row,'Fabricante')),newMaker=normalizeAsset_(candidate.values.Fabricante);if(oldMaker&&newMaker&&oldMaker!==newMaker)throw Error('Fabricante divergente para a mesma identificação; solicite conferência.');}
  if(matches.length&&candidate.kind!=='Banco de baterias'){
    const oldSerial=identityTokens_(get(matches[0].row,'Nº Série'),'S:'),newSerial=identityTokens_(candidate.serial,'S:');
    if(oldSerial.length&&newSerial.length&&!oldSerial.some(id=>newSerial.includes(id)))throw Error('A série diverge da identificação já cadastrada; confirme a substituição com a gestão.');
  }
  if(!matches.length&&!incoming.length)throw Error('Informe número de série ou patrimônio antes de criar o ativo.');
  return matches[0]||null;
}
function validatedAssetValue_(rule,value,header){
  if(value===undefined||value===null||value==='')return undefined;
  if(value?._invalidDate)throw Error('Data inválida: '+value._invalidDate);
  if(typeof value==='string'&&['NAO VERIFICADO','NAO IDENTIFICADO'].includes(normalizeAsset_(value)))return undefined;
  if(['Nº Série','Patrimônio'].includes(header)&&!identityTokens_(value,'').length)return undefined;
  if(['BTUs','Carga Gás','Última Medição Corrente','Última Medição Temperatura','Módulos','Corrente (A) (TOTAL)','Tensão (V)','Quantidade','Autonomia (h)','Tensão Nominal (V)','Capacidade (Ah)'].includes(header)){
    const normalized=String(value).trim().replace(/\s*(BTU\/h|BTUs?|Ah|A|V|h|°C)$/i,'').replace(',','.');
    if(!/^-?\d+(\.\d+)?$/.test(normalized))throw Error('Informe um valor numérico.');value=Number(normalized);
  }
  if(value instanceof Date)return value;
  if(!rule)return text_(value);
  const type=String(rule.getCriteriaType()),criteria=rule.getCriteriaValues();
  if(type==='VALUE_IN_LIST'||type==='VALUE_IN_RANGE'){
    const allowed=type==='VALUE_IN_LIST'?criteria[0]:criteria[0].getDisplayValues().flat();
    const match=allowed.find(v=>normalizeAsset_(v)===normalizeAsset_(value));if(match===undefined)throw Error('Valor não permitido pela validação: '+value);return match;
  }
  return value instanceof Date?value:text_(value);
}
function writeAssetPatch_(table,rowIndex,patch,warnings){
  const range=table.sheet.getRange(rowIndex,1,1,table.width),formulas=range.getFormulas()[0],rules=range.getDataValidations()[0],before=range.getValues()[0],after=before.slice(),changed=[];
  for(const [header,value] of Object.entries(patch)){
    const col=table.headers.indexOf(header);if(col<0||formulas[col])continue;
    try{const rule=rules[col]||assetFallbackRule_(table.sheet.getName(),header);const accepted=validatedAssetValue_(rule,value,header);if(accepted===undefined)continue;if(JSON.stringify(before[col])===JSON.stringify(accepted))continue;after[col]=accepted;changed.push(col);}
    catch(error){warnings.push(header+': '+error.message);}
  }
  changed.sort((a,b)=>a-b);
  for(let i=0;i<changed.length;){let j=i;while(j+1<changed.length&&changed[j+1]===changed[j]+1)j++;table.sheet.getRange(rowIndex,changed[i]+1,1,changed[j]-changed[i]+1).setValues([after.slice(changed[i],changed[j]+1)]);i=j+1;}
  for(const header of ['Data_Ultima_Inspecao','Data de Verficação','Proxima Verificação']){const col=table.headers.indexOf(header);if(changed.includes(col))table.sheet.getRange(rowIndex,col+1).setNumberFormat('dd/MM/yyyy');}
  table.values[rowIndex-1]=after;return {changed:changed.length,before,after};
}
function assetFallbackRule_(tab,header){
  // Tabelas nativas podem expor a validação somente na propriedade da coluna.
  const lists={
    Ativos:{Categoria:['Retificadora','Bateria','Ar-condicionado','Gerador','Nobreak','Inversor','Transmissão','OLT','Roteador','Segurança','Outro','Inversor de Potência','Switch'],Status:['Operacional','Atenção','Crítico','Inativo']},
    Retificadores:{Fabricante:['XPS','Huawei','Emerson','Apr48','Volt']}
  };
  let allowed=lists[tab]?.[header];
  if(tab==='Climatização_Voanet'&&header==='Tipo Local')allowed=book_(config_().SPREADSHEET_ID).getSheetByName('FONTES').getRange('A2:A3').getDisplayValues().flat();
  if(tab==='Controle_Baterias'&&header==='Tecnologia')allowed=book_(config_().SPREADSHEET_ID).getSheetByName('FONTES').getRange('D2:D6').getDisplayValues().flat();
  return allowed?{getCriteriaType:()=> 'VALUE_IN_LIST',getCriteriaValues:()=>[allowed]}:null;
}
function appendNativeAssetRow_(table){
  // Insere dentro do limite atual para as tabelas nativas acompanharem a nova linha.
  const oldLast=Math.max(2,table.sheet.getLastRow()),target=oldLast;
  table.sheet.insertRowsBefore(target,1);
  const source=table.sheet.getRange(target+1,1,1,table.width),destination=table.sheet.getRange(target,1,1,table.width);
  source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
  source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);
  destination.clearContent();destination.setFormulasR1C1(source.getFormulasR1C1());
  table.values.splice(target-1,0,Array(table.width).fill(''));return target;
}
function syncAssets_(r,version){
  const {candidates,warnings}=assetCandidates_(r),result={created:0,updated:0,unchanged:0,pending:0,warnings:[]},events=[],tables={};
  const log=(tab,id,action,detail,before,after)=>events.push([hash_(r.id+'|'+version+'|'+tab+'|'+id+'|'+action+'|'+detail+'|'+JSON.stringify(after||{})),new Date(),r.id,r.codigoPop,tab,id,action,detail,JSON.stringify(before||{}),JSON.stringify(after||{}),version]);
  for(const warning of warnings){result.pending++;result.warnings.push(warning);log('', '', 'PENDENCIA',warning);}
  for(const candidate of candidates){
    try{
      const table=tables[candidate.tab]||(tables[candidate.tab]=assetTable_(candidate.tab));
      const found=findAssetRow_(table,candidate,r),h=table.headers;
      if(found){
        const date=dateKey_(found.row[h.indexOf(ASSET_TABS[candidate.tab].date||'Data_Ultima_Inspecao')]),revision=String(found.row[h.indexOf('Versao_Inspecao')]||'');
        if(date>r.data||(date===r.data&&revision>r.updated))throw Error('Inspeção anterior à última atualização deste ativo.');
      }
      const id=found?.row[h.indexOf('ID_Ativo')]||'AS-'+hash_(candidate.tab+'|'+r.codigoPop+'|'+(candidate.serial||candidate.patr||String(found?.index))).slice(0,24);
      const row=found?.index||appendNativeAssetRow_(table),fieldWarnings=[];
      const patch={...candidate.values,ID_Ativo:id,Codigo_POP:r.codigoPop,'Nº Série':candidate.serial,'Patrimônio':candidate.patr,[ASSET_TABS[candidate.tab].date||'Data_Ultima_Inspecao']:assetDate_(r.data),ID_Ultima_Inspecao:r.id,Versao_Inspecao:r.updated};
      const written=writeAssetPatch_(table,row,patch,fieldWarnings);
      const action=!found?'CRIADO':written.changed?'ATUALIZADO':'SEM_ALTERACAO';
      if(!found)result.created++;else if(written.changed)result.updated++;else result.unchanged++;
      if(action!=='SEM_ALTERACAO')log(candidate.tab,id,action,candidate.label,written.before,written.after);
      for(const warning of fieldWarnings){result.pending++;result.warnings.push(candidate.tab+' · '+candidate.label+': '+warning);log(candidate.tab,id,'PENDENCIA',warning);}
    }catch(error){const detail=candidate.tab+' · '+candidate.label+': '+error.message;result.pending++;result.warnings.push(detail);log(candidate.tab,candidate.ref,'PENDENCIA',detail);}
  }
  const audit=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);if(!audit)throw Error('Histórico de ativos não preparado.');
  const seen=new Set(audit.getLastRow()>1?audit.getRange(2,1,audit.getLastRow()-1,1).getValues().flat():[]),fresh=events.filter(e=>!seen.has(e[0]));
  if(fresh.length){const target=audit.getLastRow()+1;if(target+fresh.length-1>audit.getMaxRows())audit.insertRowsAfter(audit.getMaxRows(),fresh.length+100);audit.getRange(target,1,fresh.length,AUDIT_HEADERS.length).setValues(fresh.map(row=>row.map(v=>v instanceof Date?v:text_(v))));}
  // O resumo nas propriedades tem tamanho limitado; os detalhes integrais ficam no histórico privado.
  result.warnings=result.warnings.slice(0,12).map(x=>x.slice(0,220));return result;
}
function assetIssues_(input,user){
  const owner=recordOwner_(input.inspectionId);if(!owner||(owner!==user.email&&user.role!=='GESTAO'))throw Error('Registro indisponível.');
  const revision=recordRevision_(input.inspectionId),sheet=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);
  const rows=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,AUDIT_HEADERS.length).getValues():[];
  return {ok:true,issues:rows.filter(r=>r[2]===input.inspectionId&&r[6]==='PENDENCIA'&&r[10]===revision?.hash).map(r=>({tab:r[4],detail:r[7]}))};
}

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

return { setup, createOperatorKey, doPost, processQueue };
})();

function prepararInspecoesPOPs() {
  return BdInspecoesPOPs.setup();
}

function criarChaveInspecoesPOPs() {
  return BdInspecoesPOPs.createOperatorKey();
}

function processarFilaInspecoesPOPs() {
  return BdInspecoesPOPs.processQueue();
}

function receberInspecoesPOPs(e) {
  return BdInspecoesPOPs.doPost(e);
}

// Este é o ponto de entrada do aplicativo Web. O projeto deve ter somente um doPost.
function doPost(e) {
  return receberInspecoesPOPs(e);
}
