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
    JSON.stringify(r.issues||[]),JSON.stringify({inventory:r.inventory,equipamentos:r.equipamentos,transceivers:classifiedTransceivers_(r),bancos:r.invBatteryBanks}),
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
function reply_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e) {
  try {
    beginRequest_();
    if(!e?.postData?.contents||e.postData.contents.length>15*1024*1024)throw Error('Requisição vazia ou maior que 15 MB.');
    const input=JSON.parse(e.postData.contents),user=authenticate_(input);
    if(!user)return reply_({ok:false,code:'AUTH',error:'Chave inválida, revogada ou ainda não vinculada a uma pessoa ativa.'});
    requirePrivateData_();
    if(input.version!==1)throw Error('Versão incompatível.');
    if(input.action==='session')return reply_({ok:true,user,capabilities:{apiVersion:2,stagedPhotos:true,summary:true,assetsSync:true,accessAdmin:true,reportRefresh:true,assetInventory:true,assetReconciliation:true,assetComparisonV2:true,assetAdjustments:true,climateOptional:true,actionPlans:true}});
    if(input.action==='fleetLoad'||input.action==='fleetSave')return reply_(fleetRequest_(input,user));
    if(input.action==='users')return reply_(listAccess_(user));
    if(input.action==='manageOperator')return reply_(manageOperator_(input,user));
    if(input.action==='stations')return reply_({ok:true,stations:stations_()});
    if(input.action==='list')return reply_(listInspections_(input,user));
    if(input.action==='dashboard')return reply_(dashboard_(input,user));
    if(input.action==='inspectionActionPlan')return reply_(inspectionActionPlan_(input,user));
    if(input.action==='photo')return reply_(stagePhoto_(input,user));
    if(input.action==='refreshReport')return reply_(refreshReport_(input,user));
    if(input.action==='pdf')return reply_(downloadPdf_(input,user));
    if(input.action==='inspectionAssets')return reply_(inspectionAssets_(input,user));
    if(input.action==='assetIssues')return reply_(assetIssues_(input,user));
    if(input.action==='applyAssetAdjustment')return reply_(applyAssetAdjustment_(input,user));
    if(input.action==='centralBatteryBanks')return reply_(centralBatteryBanks_(user));
    if(input.action==='centralAssetsForInspection')return reply_(centralAssetsForInspection_(input,user));
    if(input.action==='compareInspectionAssets')return reply_(compareInspectionAssets_(input,user));
    if(input.action==='applyAssetDecision')return reply_(applyAssetDecision_(input,user));
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
