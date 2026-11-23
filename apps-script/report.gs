const REPORT_VERSION = 'gerencial-v4';
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

function reportExcerpt_(value,limit) {
  const text=String(value??'').replace(/\s+/g,' ').trim();
  if(text.length<=limit)return text;
  const cut=text.slice(0,limit-1);
  const boundary=cut.lastIndexOf(' ');
  return (boundary>limit*.75?cut.slice(0,boundary):cut).trimEnd()+'…';
}

function reportFileBase_(station,date,id) {
  const safeStation=String(station||'').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
  const iso=date instanceof Date?Utilities.formatDate(date,'America/Sao_Paulo','yyyy-MM-dd'):String(date||'').slice(0,10);
  const day=/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.split('-').reverse().join('-'):'';
  return [safeStation||id||'Inspeção',day].filter(Boolean).join(' - ');
}

function reportDriveName_(record,hash) {
  return reportFileBase_(record.nome,record.data,record.id)+' - '+hash.slice(0,12)+' - '+REPORT_VERSION;
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
    reportParagraph_(doc.addFooter(),record.id+'  ·  Relatório gerencial de inspeção',{color:REPORT_MUTED,size:8});
    reportParagraph_(body,'Resumo gerencial de inspeção',{heading:'TITLE',size:25,bold:true,after:7});
    reportParagraph_(body,reportExcerpt_([record.codigoPop,record.nome].filter(Boolean).join(' · '),105),{size:17,bold:true,color:REPORT_RED});
    reportTable_(body,['Vistoria','Técnico responsável','Próxima inspeção'],
      [[record.data,reportExcerpt_(record.inspetor,75),record.scheduleDueDate]],[130,244,130]);
    if(record.municipio||record.os)reportParagraph_(body,reportExcerpt_([record.municipio,record.os].filter(Boolean).join(' · '),140),{size:9,before:6,color:REPORT_MUTED});

    const checks=groups.flatMap(group=>group.items.map(([code,label])=>({
      title:code+' · '+label,status:record.checks?.[code]?.status||'NV',note:record.checks?.[code]?.note
    })));
    if(record.interligacoes?.status)checks.push({title:'Interligações',status:record.interligacoes.status,note:record.interligacoes.observacoes});
    const findings=checks.filter(item=>item.status==='NC');
    reportHeading_(body,'Resumo da vistoria');
    reportTable_(body,Object.values(REPORT_STATUS),[Object.keys(REPORT_STATUS).map(status=>checks.filter(item=>item.status===status).length)],[126,126,126,126]);
    if(record.sintese)reportParagraph_(body,reportExcerpt_(record.sintese,260),{before:8});
    reportHeading_(body,'Não conformidades',2);
    if(findings.length){
      reportTable_(body,['Item','Observação'],findings.slice(0,4).map(item=>[reportExcerpt_(item.title,95),reportExcerpt_(item.note,105)]),[240,264]);
      if(findings.length>4)reportParagraph_(body,'Mais '+(findings.length-4)+' no checklist completo.',{color:REPORT_MUTED,before:4});
    }else reportParagraph_(body,'Nenhuma não conformidade registrada.');

    const issues=record.issues||[];
    if(issues.length){
      reportHeading_(body,'Ações prioritárias',2);
      const order=issue=>Number(String(issue.prioridade||'').match(/^P([0-9])/i)?.[1]||9);
      const priority=issues.slice().sort((a,b)=>order(a)-order(b));
      reportTable_(body,['Ação','Prioridade e situação','Responsável e prazo'],priority.slice(0,3).map(issue=>[
        reportExcerpt_([issue.titulo,issue.acao].filter(Boolean).join(' · '),105),
        reportExcerpt_([issue.prioridade,issue.status].filter(Boolean).join(' · '),50),
        reportExcerpt_([issue.responsavel,issue.prazo&&reportValue_(issue.prazo)].filter(Boolean).join(' · '),50)
      ]),[245,129,130]);
      if(issues.length>3)reportParagraph_(body,'Mais '+(issues.length-3)+' ação(ões) no registro completo.',{color:REPORT_MUTED,before:4});
    }else if(record.investimentos){
      reportHeading_(body,'Recomendações',2);
      reportParagraph_(body,reportExcerpt_(record.investimentos,215));
    }
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
    const record=readJsonFile_(claim.revision.payloadId);
    validate_(record);
    const name=reportDriveName_(record,claim.revision.hash);
    const pdf=artifact_(folder,name+'.pdf',()=>createPdf_(record,folder,name));
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
