const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./support/gas.cjs');

test('Gestão atualiza somente o PDF de uma inspeção recebida e preserva o arquivo anterior',()=>{
 const h=harness(), record=h.record();
 const sent=h.send(record);
 assert.equal(sent.ok,true);
 const originalRow=h.rows[1].slice();
 const [filename,old]=[...h.files].find(([name])=>name.endsWith('.pdf'));
 h.files.delete(filename);
 h.files.set('pdf-historico.pdf',old);
 const count=h.files.size;
 assert.equal(h.request({action:'refreshReport',inspectionId:record.id}).ok,false);
 assert.equal(h.files.size,count);
 const result=h.request({action:'refreshReport',inspectionId:record.id},'manager');
 assert.equal(result.ok,true);
 assert.notEqual(result.pdfUrl,sent.pdfUrl);
 const pdfColumn=h.rows[0].indexOf('pdf_url');
 assert.equal(h.rows[1][pdfColumn],result.pdfUrl);
 originalRow[pdfColumn]=result.pdfUrl;
 assert.deepEqual(h.rows[1],originalRow);
 assert.equal(h.files.get('pdf-historico.pdf'),old);
 assert.equal(h.request({action:'refreshReport',inspectionId:record.id},'manager').pdfUrl,result.pdfUrl);
 assert.equal(h.files.size,count+1);
 assert.equal(h.request({action:'pdf',inspectionId:record.id}).fileName,'POP fictício - 16-11-2026.pdf');
 assert.match([...h.files.keys()].find(name=>name.endsWith('tecnico-v5.pdf')), /^POP fictício - 16-11-2026 - /);
});

test('limita textos longos no relatório e usa estação e data no nome',()=>{
 const {c}=harness();
 const excerpt=c.reportExcerpt_('ação prioritária '.repeat(50),105);
 assert.ok(excerpt.length<=105);
 assert.match(excerpt,/…$/);
 assert.equal(c.reportFileBase_('POP Sul / Norte','2026-11-21','INSP-01'),'POP Sul Norte - 21-11-2026');
});
test('monta o relatório técnico com seções, ações e fotos vinculadas',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const entries=[];
 function text(){
  return {setFontFamily(){return this},setFontSize(){return this},setForegroundColor(){return this},setBold(){return this}};
 }
 function paragraph(value){
  return {setHeading(){return this},setSpacingBefore(){return this},setSpacingAfter(){return this},
   setLineSpacing(){return this},setAlignment(){return this},appendInlineImage(blob){entries.push(blob);return {getWidth:()=>800,getHeight:()=>600,setWidth(){return this},setHeight(){return this}}},setText(next){entries.push(next);return this},editAsText:text};
 }
 function section(){
  return {
   appendParagraph(value){entries.push(value);return paragraph(value)},
   appendPageBreak(){entries.push('PAGE_BREAK')},
   appendImage(blob){entries.push(blob);return {getWidth:()=>800,getHeight:()=>600,setWidth(){return this},setHeight(){return this}}},
   appendTable(rows){
    entries.push(rows);
    return {setBorderWidth(){return this},setBorderColor(){return this},setColumnWidth(){return this},
     getCell(){return {...section(),getChild:()=>({asParagraph:()=>paragraph('')}),setBackgroundColor(){},editAsText:text}}};
   },
   setPageWidth(){return this},setPageHeight(){return this},setMarginLeft(){return this},
   setMarginRight(){return this},setMarginTop(){return this},setMarginBottom(){return this}
  };
 }
 const dir=path.join(__dirname,'../apps-script');
 const environment=vm.createContext({
  REPORT_LOGO:'bG9nbw==',
  Utilities:{base64Decode:s=>Buffer.from(s,'base64'),newBlob:(_bytes,_type,name)=>name},
  DocumentApp:{HorizontalAlignment:{RIGHT:'right'},ParagraphHeading:{TITLE:'title',HEADING1:'h1',HEADING2:'h2'},create:()=>({
   getId:()=>1,getBody:section,addHeader:section,addFooter:section,saveAndClose(){}
  })},
  DriveApp:{getFileById:()=>({moveTo(){},setTrashed(){},getAs:()=>({setName:name=>name})})},
  MimeType:{PDF:1},photoBlob_:photo=>photo.id
 });
 vm.runInContext(['schema.gs','report.gs'].map(name=>fs.readFileSync(path.join(dir,name),'utf8')).join('\n'),environment);
 const report={id:'INSP-TESTE',nome:'Estação fictícia',codigoPop:'TESTE',data:'2026-11-21',inspetor:'Técnico fictício',
  sintese:'A vistoria está registrada.',checks:{'EL-01':{status:'NC',note:'Evidência registrada'}},
  issues:[{titulo:'Identificar o quadro',acao:'Etiquetar os disjuntores',prioridade:'P1'}],
  photos:[{id:'foto-1',target:'check:EL-01',caption:'Quadro de energia'}],photoFiles:[{id:'foto-1'}]};
 assert.equal(environment.createPdf_(report,{createFile:name=>name},'homologacao'),'homologacao.pdf');
 for(const expected of ['voanet.png','Relatório técnico de inspeção','Indicadores e diagnóstico','Não conformidades','Ações e medições',
  'Etiquetar os disjuntores','21/11/2026','Evidências fotográficas','Quadro de energia']){
  assert.ok(JSON.stringify(entries).includes(expected),expected);
 }
 assert.equal(entries.filter(entry=>entry==='PAGE_BREAK').length,2);
 assert.ok(entries.includes('foto-1'));
});
