// Somente valores privados são mantidos durante uma execução, nunca credenciais no cliente.
let requestContext_ = null;
function beginRequest_(){
  const store=PropertiesService.getScriptProperties();
  requestContext_={store,values:Object.assign({},store.getProperties()),books:{},fallbackRules:{},sheet:null,users:null,stations:null};
}
function headerMap_(headers){
  const map=Object.create(null);
  for(let i=0;i<headers.length;i++)map[headers[i]]=i;
  return map;
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
