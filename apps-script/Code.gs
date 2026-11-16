// Executar como proprietário. Autorização por chaves individuais revogáveis.
const DESTINATION_SHEET = 'Inspecoes_POPs';
const CONFIG_DEFAULTS = {
  SPREADSHEET_ID: '1WArVbYwKaiWkhgNxeNXdbPx4OK5tNqyJcDRbFp91Gf8',
  PDF_FOLDER_ID: '1onSSKBtDs46OXBLaHZCOkh7rXKUFROHc'
};
function config_() {return Object.assign({}, CONFIG_DEFAULTS, PropertiesService.getScriptProperties().getProperties());}
function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(b => ((b+256)%256).toString(16).padStart(2,'0')).join('');
}
function createOperatorKey() {
  // Execute no editor, entregue a chave fora do GitHub e remova o log após a entrega.
  const token = Utilities.getUuid() + Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  const users = JSON.parse(props.getProperty('TOKEN_HASHES') || '{}');
  const name = 'operador-' + Utilities.getUuid().slice(0,8);
  users[hash_(token)] = name;
  props.setProperty('TOKEN_HASHES', JSON.stringify(users));
  console.log('Operador: ' + name + '\nChave individual: ' + token);
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
    sheet.getRange(1,1,1,expected.length).setValues([expected]).setFontWeight('bold').setBackground('#17365d').setFontColor('#ffffff');
    sheet.setFrozenRows(1); sheet.setColumnWidths(1,expected.length,160);
    sheet.getRange(1,1,1,expected.length).createFilter();
  }
  if (JSON.stringify(sheet.getRange(1,1,1,expected.length).getValues()[0]) !== JSON.stringify(expected)) throw Error('Cabeçalho incompatível. Não foi gravado nenhum registro.');
  return sheet;
}
function setup() {
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
  body.appendParagraph(typeof value === 'string' ? value : JSON.stringify(value,null,2));
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
    const users = JSON.parse(config_().TOKEN_HASHES||'{}');
    const operator = typeof input.token === 'string' && users[hash_(input.token)];
    if (!operator) return reply_({ok:false,error:'Chave de envio inválida ou revogada.'});
    if (input.version !== 1) throw Error('Versão incompatível.');
    const r = input.record;
    validate_(r);
    const hash = hash_(JSON.stringify(r));
    // Valida limites de célula antes de criar arquivos no Drive.
    row_(r,{},operator,hash);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw Error('Outro envio está em andamento. Tente novamente.');
    const sheet = sheet_(), headers = headers_();
    const matches = sheet.getLastRow()>1 ? sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(r.id).matchEntireCell(true).findAll() : [];
    if (matches.length > 1) throw Error('ID duplicado na planilha. Contate o responsável.');
    const existing = matches.length ? matches[0].getRow() : null;
    if (existing) {
      const previous = sheet.getRange(existing,1,1,headers.length).getValues()[0];
      if (previous[headers.indexOf('hash_versao')] === hash) return reply_({ok:true,inspectionId:r.id,pdfUrl:previous[headers.indexOf('pdf_url')],receivedAt:previous[headers.indexOf('recebido_em')]});
      if (String(previous[headers.indexOf('updated')]) >= r.updated) throw Error('Existe uma versão mais recente ou conflitante desta inspeção. Contate o responsável.');
    }
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
    const result = {ok:true,inspectionId:r.id,pdfUrl:pdf.getUrl(),backupUrl:backup.getUrl(),receivedAt:new Date().toISOString()};
    const target = existing || sheet.getLastRow()+1;
    if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),100);
    sheet.getRange(target,1,1,headers.length).setValues([row_(r,result,operator,hash)]);
    SpreadsheetApp.flush(); committed = true;
    return reply_(result);
  } catch (error) {
    if (!committed) created.forEach(file=>{try{file.setTrashed(true);}catch(_){}});
    return reply_({ok:false,error:'Envio não concluído: '+error.message});
  } finally {if(lock?.hasLock()) lock.releaseLock();}
}
function doGet() {return reply_({ok:true,service:'VOANET — recebimento de inspeções',version:1});}
