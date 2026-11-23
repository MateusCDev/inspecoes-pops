const REPORT_VERSION = 'tecnico-v5';
const REPORT_INK = '#192638';
const REPORT_MUTED = '#526277';
const REPORT_RED = '#b9142a';
const REPORT_LINE = '#dbe3eb';

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

function reportHeading_(body,text) {
  return reportParagraph_(body,text,{heading:'HEADING2',size:12,before:10,after:7,bold:true,color:REPORT_RED});
}

function reportTable_(body,head,rows,widths) {
  const table=body.appendTable([head,...rows].map(row=>row.map(reportValue_)));
  table.setBorderWidth(.5).setBorderColor(REPORT_LINE);
  widths.forEach((width,index)=>table.setColumnWidth(index,width));
  for(let col=0;col<head.length;col++){
    const cell=table.getCell(0,col);
    cell.setBackgroundColor('#edf1f5');
    cell.editAsText().setFontFamily('Arial').setBold(true).setFontSize(9).setForegroundColor(REPORT_INK);
  }
  for(let row=1;row<=rows.length;row++){
    for(let col=0;col<head.length;col++){
      const cell=table.getCell(row,col);
      cell.editAsText().setFontSize(9).setForegroundColor(REPORT_INK);
      if(row%2===1)cell.setBackgroundColor('#f4f7fa');
      if(head[col]==='Não conformes'&&Number(rows[row-1][col])>0){
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

function reportEvidence_(record,checks){
  const files=new Map((record.photoFiles||[]).map(photo=>[photo.id,photo]));
  const byCode=new Map(checks.map(check=>[check.code,check]));
  const photos=(record.photos||[]).flatMap(meta=>{
    const file=files.get(meta.id);
    if(!file)return [];
    const check=byCode.get(String(meta.target||'').replace(/^check:/,''));
    const caption=reportExcerpt_([check?.code,meta.caption||check?.label||meta.category||'Evidência da vistoria'].filter(Boolean).join(' · '),120);
    return [{file,check,target:meta.target||meta.id,caption}];
  });
  const targets=new Set();
  const unique=photos.filter(photo=>{
    if(targets.has(photo.target))return false;
    targets.add(photo.target);
    return true;
  });
  const findings=unique.filter(photo=>photo.check?.status==='NC');
  const sections=new Set(findings.map(photo=>photo.check.code.split('-')[0]));
  const varied=[],remaining=[];
  for(const photo of unique.filter(item=>item.check?.status!=='NC')){
    const section=photo.check?.code.split('-')[0];
    if(!section||sections.has(section))remaining.push(photo);
    else{sections.add(section);varied.push(photo);}
  }
  return [...findings,...varied,...remaining];
}

function reportEvidencePage_(body,record,checks,section){
  const evidence=[];
  for(const photo of reportEvidence_(record,checks)){
    try{evidence.push({...photo,blob:photoBlob_(photo.file)});}
    catch(error){console.warn('Evidência indisponível para o relatório '+record.id);}
    if(evidence.length===4)break;
  }
  if(!evidence.length){
    if(record.photos?.length)reportParagraph_(body,'As fotos registradas estão indisponíveis para inclusão neste PDF.',{color:REPORT_MUTED,size:9});
    return;
  }

  body.appendPageBreak();
  reportHeading_(body,section+'. Evidências fotográficas');
  const rows=Array.from({length:Math.ceil(evidence.length/2)},()=>[' ',' ']);
  const grid=body.appendTable(rows).setBorderWidth(.5).setBorderColor(REPORT_LINE);
  grid.setColumnWidth(0,257).setColumnWidth(1,257);
  let shown=0;
  evidence.forEach((photo,index)=>{
    const cell=grid.getCell(Math.floor(index/2),index%2);
    try{
      const image=cell.getChild(0).asParagraph().setText('').appendInlineImage(photo.blob);
      const width=image.getWidth(),height=image.getHeight();
      const scale=Math.min(228/width,183/height,1);
      image.setWidth(Math.max(1,Math.round(width*scale))).setHeight(Math.max(1,Math.round(height*scale)));
      reportParagraph_(cell,'Foto '+String(index+1).padStart(2,'0')+' · '+photo.caption,{size:9,bold:true,after:4});
      shown++;
    }catch(error){
      reportParagraph_(cell,'Imagem indisponível · '+photo.caption,{size:9,color:REPORT_MUTED});
    }
  });
  reportParagraph_(body,`${shown} de ${record.photos.length} evidência(s) incluída(s) nesta seleção.`,{before:8,size:9,color:REPORT_MUTED});
}

function createPdf_(record,folder,name) {
  const doc=DocumentApp.create(name);
  const temporary=DriveApp.getFileById(doc.getId());
  try{
    temporary.moveTo(folder);
    const body=doc.getBody();
    body.setPageWidth(595.28).setPageHeight(841.89).setMarginLeft(40).setMarginRight(40).setMarginTop(74).setMarginBottom(48);
    const header=doc.addHeader();
    const brand=header.appendTable([[' ','INFRAESTRUTURA O&M']]).setBorderWidth(0);
    brand.setColumnWidth(0,300).setColumnWidth(1,214);
    const logoCell=brand.getCell(0,0);
    if(typeof REPORT_LOGO==='string'){
      const logo=logoCell.getChild(0).asParagraph().setText('').appendInlineImage(
        Utilities.newBlob(Utilities.base64Decode(REPORT_LOGO),'image/png','voanet.png'));
      logo.setWidth(132).setHeight(27);
    }else{
      reportParagraph_(logoCell,'VOANET',{color:REPORT_RED,bold:true,size:15});
    }
    const headerCell=brand.getCell(0,1);
    headerCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT)
      .editAsText().setFontFamily('Arial').setBold(true).setFontSize(10).setForegroundColor(REPORT_INK);
    reportParagraph_(headerCell,'Relatório de inspeção · Infraestrutura',{size:8,color:REPORT_MUTED})
      .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    reportParagraph_(doc.addFooter(),record.id+'  ·  VOANET Infraestrutura O&M',{color:REPORT_MUTED,size:8});

    reportParagraph_(body,reportExcerpt_(record.nome,85),{heading:'TITLE',size:23,bold:true,color:REPORT_RED,after:4});
    reportParagraph_(body,'Relatório técnico de inspeção · '+record.id,{size:10,color:REPORT_MUTED,after:10});
    reportHeading_(body,'01. Identificação da vistoria');
    reportTable_(body,['Identificação','Dados da inspeção'],[
      ['Estação / código',reportExcerpt_([record.nome,record.codigoPop].filter(Boolean).join(' · '),120)],
      ['Município',reportExcerpt_(record.municipio,110)],
      ['Vistoria / próxima preventiva',reportValue_(record.data)+' / '+reportValue_(record.scheduleDueDate)],
      ['Técnico responsável',reportExcerpt_(record.inspetor,110)]
    ],[186,328]);

    const checks=groups.flatMap(group=>group.items.map(([code,label])=>({
      code,label,status:record.checks?.[code]?.status||'NV',note:record.checks?.[code]?.note
    })));
    if(record.interligacoes?.status)checks.push({code:'INT',label:'Interligações',status:record.interligacoes.status,note:record.interligacoes.observacoes});
    const findings=checks.filter(item=>item.status==='NC');

    reportHeading_(body,'02. Indicadores e diagnóstico');
    reportTable_(body,['Conformes','Não conformes','Não verificados','Criticidade'],
      [[checks.filter(check=>check.status==='C').length,findings.length,checks.filter(check=>check.status==='NV').length,record.classificacao]],
      [126,126,126,136]);
    if(record.sintese)reportParagraph_(body,reportExcerpt_(record.sintese,560),{before:7});

    reportHeading_(body,'03. Não conformidades');
    if(findings.length){
      reportTable_(body,['Item de inspeção','Observação'],findings.slice(0,6).map(item=>[
        reportExcerpt_(item.code+' · '+item.label,95),reportExcerpt_(item.note,135)
      ]),[225,289]);
      if(findings.length>6)reportParagraph_(body,'Mais '+(findings.length-6)+' item(ns) no checklist da vistoria.',{color:REPORT_MUTED,before:4});
    }else reportParagraph_(body,'Nenhuma não conformidade registrada.');

    const readings=[
      ['Tensão CA (V)',record.readings?.tensaoAC],['Tensão CC (V)',record.readings?.tensaoCC],
      ['Carga CC (A)',record.readings?.cargaCC],['Módulos retificadores',record.readings?.modulos],
      ['Quantidade de baterias',record.readings?.qtdBaterias],['Temperatura ambiente (°C)',record.readings?.temperatura],
      ['Autonomia (min)',record.readings?.autonomia]
    ].filter(([,value])=>value!==undefined&&value!==null&&value!=='');
    const issues=record.issues||[];
    const hasTechnicalDetails=Boolean(issues.length||record.investimentos||readings.length);
    if(hasTechnicalDetails){
      body.appendPageBreak();
      reportHeading_(body,'04. Ações e medições');
      if(issues.length){
        const order=issue=>Number(String(issue.prioridade||'').match(/^P([0-9])/i)?.[1]||9);
        const priority=issues.slice().sort((a,b)=>order(a)-order(b));
        reportTable_(body,['Ação','Prioridade / situação','Responsável / prazo'],priority.slice(0,5).map(issue=>[
          reportExcerpt_([issue.titulo,issue.acao].filter(Boolean).join(' · '),135),
          reportExcerpt_([issue.prioridade,issue.status].filter(Boolean).join(' · '),60),
          reportExcerpt_([issue.responsavel,issue.prazo&&reportValue_(issue.prazo)].filter(Boolean).join(' · '),65)
        ]),[244,130,140]);
        if(issues.length>5)reportParagraph_(body,'Mais '+(issues.length-5)+' ação(ões) no registro da vistoria.',{color:REPORT_MUTED,before:4});
      }
      if(record.investimentos)reportParagraph_(body,reportExcerpt_(record.investimentos,460),{before:9});
      if(readings.length)reportTable_(body,['Leitura','Valor registrado'],
        readings.map(([label,value])=>[label,reportExcerpt_(value,55)]),[240,274]);
    }
    reportEvidencePage_(body,record,checks,hasTechnicalDetails?'05':'04');
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
