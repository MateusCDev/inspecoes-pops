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
