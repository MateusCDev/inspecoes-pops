const REPORT_VERSION = 'relatorio-v2';
const REPORT_INK = '#192638';
const REPORT_MUTED = '#526277';
const REPORT_RED = '#b9142a';
const REPORT_LINE = '#dbe3eb';
const REPORT_STATUS = {C:'Conforme',NC:'Não conforme',NA:'Não se aplica',NV:'Não verificado'};

function reportValue_(value) {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.split('-').reverse().join('/') : (text || '—');
}

function reportLabel_(key) {
  const labels = {
    id:'Identificador',os:'OS / SIGA+',cftv:'CFTV',dataUltima:'Última atualização',
    dataConferencia:'Data da conferência',tx:'Transceiver',nc:'Não conformidades',
    retificadoras:'Retificadoras',bancos:'Bancos de baterias',baterias:'Baterias',
    climatizadores:'Climatizadores',dios:'DIOs',confirmado:'Cadastro confirmado'
  };
  return labels[key] || (key.charAt(0).toUpperCase() + key.slice(1)).replace(/[_-]+/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2');
}

function reportParagraph_(container,text,options={}) {
  const p=container.appendParagraph(String(text));
  if (options.heading) p.setHeading(DocumentApp.ParagraphHeading[options.heading]);
  p.setSpacingBefore(options.before || 0).setSpacingAfter(options.after ?? 5).setLineSpacing(1.16);
  p.editAsText().setFontFamily('Arial').setFontSize(options.size || 10)
    .setForegroundColor(options.color || REPORT_INK).setBold(Boolean(options.bold));
  return p;
}

function reportHeading_(body,text,level=1) {
  return reportParagraph_(body,text,{heading:level===1?'HEADING1':'HEADING2',size:level===1?17:12,
    before:level===1?12:8,after:7,bold:true,color:level===1?REPORT_INK:REPORT_RED});
}

function reportTable_(body,head,rows,widths) {
  const table=body.appendTable([head,...rows].map(row=>row.map(reportValue_)));
  table.setBorderWidth(.5).setBorderColor(REPORT_LINE);
  widths.forEach((width,index)=>table.setColumnWidth(index,width));
  for(let col=0;col<head.length;col++){
    const cell=table.getCell(0,col);
    cell.setBackgroundColor(REPORT_INK);
    cell.editAsText().setFontFamily('Arial').setBold(true).setFontSize(9).setForegroundColor('#ffffff');
  }
  for(let row=1;row<=rows.length;row++){
    for(let col=0;col<head.length;col++){
      const cell=table.getCell(row,col);
      cell.editAsText().setFontSize(9).setForegroundColor(REPORT_INK);
      if(row%2===1)cell.setBackgroundColor('#f4f7fa');
      if(reportValue_(rows[row-1][col])===REPORT_STATUS.NC){
        cell.setBackgroundColor('#fff0f1');
        cell.editAsText().setBold(true).setForegroundColor(REPORT_RED);
      }
    }
  }
  return table;
}

function reportDetails_(body,title,value,depth=0) {
  if(!value||typeof value!=='object'||depth>6)return;
  const entries=Object.entries(value).filter(([,v])=>v!==''&&v!==null&&v!==undefined&&
    (typeof v!=='object'||Object.keys(v).length));
  if(!entries.length)return;
  if(Array.isArray(value)){
    entries.forEach(([index,item])=>{
      if(typeof item==='object')reportDetails_(body,title+' '+(Number(index)+1),item,depth+1);
      else reportParagraph_(body,title+' '+(Number(index)+1)+' · '+reportValue_(item));
    });
    return;
  }
  const fields=entries.filter(([,v])=>typeof v!=='object');
  if(fields.length){
    reportHeading_(body,title,2);
    reportTable_(body,['Campo','Registro'],fields.map(([key,v])=>[reportLabel_(key),v]),[169,335]);
  }
  entries.filter(([,v])=>typeof v==='object').forEach(([key,nested])=>
    reportDetails_(body,title+' · '+reportLabel_(key),nested,depth+1));
}

function reportPhotoGroups_(photos) {
  const byCode=new Map(groups.flatMap(group=>group.items.map(([code,label])=>[code,{title:group.title,label:code+' · '+label}])));
  const sections=new Map();
  photos.forEach((photo,index)=>{
    const target=String(photo.target||'');
    const item=target.startsWith('check:')?byCode.get(target.slice(6)):null;
    const title=item?.title||(target.startsWith('interligacoes:')?'Interligações':
      target?'Inventário e equipamentos':(photo.category&&photo.category!=='Item vinculado'?photo.category:'Fotos gerais da estação'));
    if(!sections.has(title))sections.set(title,[]);
    sections.get(title).push({photo,index:index+1,label:item?.label||''});
  });
  return sections;
}

function reportPhotos_(body,record) {
  const photos=record.photos||[];
  if(!photos.length)return;
  const references=new Map(record.photoFiles.map(ref=>[ref.id,ref]));
  body.appendPageBreak();
  reportHeading_(body,'Evidências fotográficas');
  reportParagraph_(body,photos.length+' foto(s) registradas na vistoria.',{color:REPORT_MUTED});
  for(const [title,items] of reportPhotoGroups_(photos)){
    reportHeading_(body,title,2);
    for(let i=0;i<items.length;i+=2){
      const gallery=body.appendTable([['','']]).setBorderWidth(.5).setBorderColor(REPORT_LINE);
      gallery.setColumnWidth(0,252).setColumnWidth(1,252);
      items.slice(i,i+2).forEach(({photo,index,label},col)=>{
        const cell=gallery.getCell(0,col);
        cell.getChild(0).asParagraph().setText('Foto '+String(index).padStart(2,'0'))
          .editAsText().setFontSize(9).setBold(true).setForegroundColor(REPORT_RED);
        if(label)reportParagraph_(cell,label,{size:9,bold:true});
        const image=cell.appendImage(photoBlob_(references.get(photo.id)));
        const scale=Math.min(1,225/image.getWidth(),165/image.getHeight());
        image.setWidth(Math.max(1,Math.round(image.getWidth()*scale))).setHeight(Math.max(1,Math.round(image.getHeight()*scale)));
        const caption=photo.caption||photo.name;
        if(caption)reportParagraph_(cell,caption,{size:9,color:REPORT_MUTED,before:3});
      });
    }
  }
}

function createPdf_(record,folder,name) {
  const doc=DocumentApp.create(name);
  const temporary=DriveApp.getFileById(doc.getId());
  try{
    temporary.moveTo(folder);
    const body=doc.getBody();
    body.setPageWidth(595.28).setPageHeight(841.89).setMarginLeft(45).setMarginRight(45).setMarginTop(60).setMarginBottom(55);
    const header=doc.addHeader();
    if(typeof REPORT_LOGO==='string'){
      const logo=header.appendImage(Utilities.newBlob(Utilities.base64Decode(REPORT_LOGO),'image/png','voanet.png'));
      logo.setWidth(112).setHeight(23);
    }else{
      reportParagraph_(header,'VOANET  |  INFRAESTRUTURA E OPERAÇÕES',{color:REPORT_RED,bold:true,size:9});
    }
    reportParagraph_(doc.addFooter(),record.id+'  ·  Relatório de inspeção técnica',{color:REPORT_MUTED,size:8});
    reportParagraph_(body,'Relatório de inspeção técnica',{heading:'TITLE',size:27,bold:true,after:8});
    reportParagraph_(body,[record.codigoPop,record.nome].filter(Boolean).join(' · '),{size:18,bold:true,color:REPORT_RED});
    reportParagraph_(body,record.id,{size:9,color:REPORT_MUTED,after:15});

    reportTable_(body,['Data da vistoria','Técnico responsável','Próxima inspeção'],
      [[record.data,record.inspetor,record.scheduleDueDate]],[130,244,130]);
    reportHeading_(body,'Resumo da vistoria');
    const groupsChecks=groups.flatMap(group=>group.items.map(([id])=>record.checks?.[id]?.status||'NV'));
    if(record.interligacoes?.status)groupsChecks.push(record.interligacoes.status);
    const counts=Object.keys(REPORT_STATUS).map(status=>groupsChecks.filter(value=>value===status).length);
    reportTable_(body,Object.values(REPORT_STATUS),[counts],[126,126,126,126]);
    for(const [label,value] of [['Síntese técnica',record.sintese],['Recomendações',record.investimentos]]){
      if(value){reportHeading_(body,label,2);reportParagraph_(body,value);}
    }
    reportHeading_(body,'Identificação e programação');
    const details=fields.filter(([key])=>!['nome','data','inspetor','sintese','investimentos'].includes(key)&&String(record[key]??'').trim())
      .map(([key,label])=>[label,record[key]]);
    if(record.popCriticality)details.push(['Criticidade cadastral do POP',record.popCriticality]);
    if(record.schedulePeriod)details.push(['Periodicidade preventiva',record.schedulePeriod+' dias']);
    if(record.scheduleNotes)details.push(['Observações da programação',record.scheduleNotes]);
    if(details.length)reportTable_(body,['Campo','Registro'],details,[169,335]);

    body.appendPageBreak();
    reportHeading_(body,'Checklist técnico');
    groups.forEach(group=>{
      reportHeading_(body,group.title,2);
      reportTable_(body,['Item avaliado','Situação','Observações'],group.items.map(([id,title])=>[
        id+' · '+title,REPORT_STATUS[record.checks?.[id]?.status||'NV']||'Situação não reconhecida',record.checks?.[id]?.note
      ]),[215,99,190]);
    });
    const measurements=readings.filter(([key])=>record.readings?.[key]!==''&&record.readings?.[key]!=null)
      .map(([key,label])=>[label,record.readings[key]]);
    if(measurements.length){reportHeading_(body,'Medições');reportTable_(body,['Parâmetro','Valor'],measurements,[235,269]);}
    reportDetails_(body,'Interligações',record.interligacoes);
    reportDetails_(body,'Estrutura de torre',{presenca:record.torrePresenca,tipo:record.torreTipo,altura:record.torreAltura,
      laudo:record.torreLaudo,observacoes:record.torreObs});
    reportDetails_(body,'Monitoramento por câmeras',{presenca:record.cftvPresenca,obrigatorio:record.cftvObrigatorio,
      quantidade:record.cftvQtd,estado:record.cftvEstado,gravacao:record.cftvGravacao,ultimoTeste:record.cftvUltimoTeste,observacoes:record.cftvObs});

    reportHeading_(body,'Plano de ação');
    if(record.issues?.length)reportDetails_(body,'Pendência',record.issues);
    else reportParagraph_(body,'Sem pendências registradas.');
    reportHeading_(body,'Inventário e conferências');
    for(const [label,value] of [
      ['Equipamento de rede',record.inventory],['Equipamentos da estação',record.equipamentos],
      ['Transceiver óptico',record.invTransceivers],['Banco de baterias',record.invBatteryBanks],
      ['Conferência do inventário',record.inventoryReview],['Origem do inventário',record.inventorySource],
      ['Conferência de baterias',record.batteryReview]
    ])reportDetails_(body,label,value);
    reportPhotos_(body,record);
    doc.saveAndClose();
    return folder.createFile(temporary.getAs(MimeType.PDF).setName(name+'.pdf'));
  }finally{temporary.setTrashed(true);}
}

function refreshReport_(input,user) {
  if(user.role!=='GESTAO')throw Error('Somente a Gestão pode gerar uma nova versão do relatório.');
  const id=input.inspectionId;
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||''))throw Error('Identificador de inspeção inválido.');
  const lockKey='REPORT_REFRESH_'+hash_(id);
  const claim=withWriteLock_(()=>{
    const revision=recordRevision_(id);
    if(!revision?.payloadId)throw Error('O arquivo de origem desta inspeção não está disponível.');
    if(Number(privateValue_(lockKey))>Date.now())throw Error('O relatório já está sendo atualizado.');
    const until=Date.now()+JOB_LEASE_MS;
    setPrivate_(lockKey,String(until));
    return {revision,until};
  });
  try{
    const folder=DriveApp.getFolderById(config_().PDF_FOLDER_ID);
    const name=id+'_'+claim.revision.hash.slice(0,12)+'_'+REPORT_VERSION;
    const pdf=artifact_(folder,name+'.pdf',()=>{
      const record=readJsonFile_(claim.revision.payloadId);
      validate_(record);
      return createPdf_(record,folder,name);
    });
    return withWriteLock_(()=>{
      if(privateValue_(lockKey)!==String(claim.until)||recordRevision_(id)?.hash!==claim.revision.hash){
        throw Error('A inspeção mudou durante a geração. Atualize os dados e tente novamente.');
      }
      const sheet=sheet_(), matches=sheet.getLastRow()>1
        ? sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findAll() : [];
      if(matches.length!==1)throw Error('Registro indisponível na planilha.');
      const url=pdf.getUrl();
      sheet.getRange(matches[0].getRow(),headers_().indexOf('pdf_url')+1).setValue(url);
      SpreadsheetApp.flush();
      setPrivate_('PDF_'+hash_(id),pdf.getId());
      return {ok:true,inspectionId:id,pdfUrl:url};
    });
  }finally{
    withWriteLock_(()=>{
      if(privateValue_(lockKey)===String(claim.until))deletePrivate_(lockKey);
    });
  }
}
