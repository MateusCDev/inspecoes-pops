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
    const reportName=name+'_'+REPORT_VERSION;
    const pdf=artifact_(folder,reportName+'.pdf',()=>createPdf_(record,folder,reportName));
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
