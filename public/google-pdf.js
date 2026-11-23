'use strict';

let googlePdfLibrary;
function loadGooglePdfLibrary(){
  if(window.PDFLib)return Promise.resolve(window.PDFLib);
  if(!googlePdfLibrary)googlePdfLibrary=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='./vendor/pdf-lib-1.17.1.min.js';
    script.onload=()=>resolve(window.PDFLib);
    script.onerror=()=>{script.remove();googlePdfLibrary=null;reject(Error('Não foi possível carregar o gerador do resumo PDF.'));};
    document.head.append(script);
  });
  return googlePdfLibrary;
}

async function buildGoogleSummary(item){
  const {PDFDocument,StandardFonts,rgb}=await loadGooglePdfLibrary();
  const doc=await PDFDocument.create();
  const page=doc.addPage([595.28,841.89]);
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const characters=new Set(regular.getCharacterSet());
  const red=rgb(.72,.08,.16),ink=rgb(.10,.15,.22),muted=rgb(.31,.38,.46),tint=rgb(.95,.96,.98);
  const text=(value,x,y,size=12,font=regular,color=ink,width=500)=>{
    let clean=[...String(value??'').normalize('NFC').replace(/\s+/g,' ').trim()].map(char=>characters.has(char.codePointAt(0))?char:'-').join('');
    if(!clean)clean='—';
    if(font.widthOfTextAtSize(clean,size)>width){
      while(clean&&font.widthOfTextAtSize(clean+'…',size)>width)clean=clean.slice(0,-1);
      clean=clean.trimEnd()+'…';
    }
    page.drawText(clean,{x,y,size,font,color});
  };
  const line=y=>page.drawLine({start:{x:46,y},end:{x:549,y},thickness:.7,color:rgb(.85,.89,.92)});
  try{
    const response=await fetch('./voanet.png');
    const logo=await doc.embedPng(await response.arrayBuffer());
    page.drawImage(logo,{x:46,y:766,width:125,height:125*logo.height/logo.width});
  }catch(_){text('VOANET',46,774,17,bold,red);}
  line(751);
  text('Resumo gerencial de inspeção',46,711,26,bold);
  text([item.station,item.stationCode].filter(Boolean).join(' · '),46,674,17,bold,red);
  text('Vistoria em '+fmt(item.date)+' · Próxima preventiva: '+fmt(item.due),46,649,11,regular,muted);
  const conform=Number(item.conform)||0,nc=Number(item.nc)||0;
  const metrics=[
    [String(nc),'Não conformidades'],
    [conform+nc?(100*conform/(conform+nc)).toFixed(1).replace('.',',')+'%':'—','Conformidade'],
    [item.criticality||'—','Criticidade operacional']
  ];
  metrics.forEach(([value,label],index)=>{
    const x=46+index*171;
    page.drawRectangle({x,y:560,width:160,height:61,color:tint});
    text(value,x+12,590,18,bold,index===0?red:ink,136);
    text(label,x+12,571,9,regular,muted,136);
  });
  text('Registro central',46,524,15,bold);
  const details=[
    ['Técnico responsável',item.technician],
    ['Periodicidade',item.period?item.period+' dias':'—'],
    ['Pendências no plano de ação',item.issues??'—'],
    ['Ativos atualizados / novos',item.assets?[item.assets.updated||0,item.assets.created||0].join(' / '):'—'],
    ['Pendências de conferência de ativos',item.assets?.pending??'—']
  ];
  details.forEach(([label,value],index)=>{
    const y=493-index*29;
    text(label,46,y,10,bold);
    text(value,270,y,11,regular,ink,275);
    line(y-10);
  });
  text('As evidências e observações técnicas estão no relatório arquivado.',46,317,10,regular,muted);
  line(92);
  text(item.id+' · Fonte: Planilha central de inspeções POPs',46,73,9,regular,muted);
  return doc.save();
}

async function googleDownloadSummary(id,trigger){
  if(googleUser?.role!=='GESTAO'||trigger.disabled)return;
  const item=googleCentralItems.find(record=>record.id===id);
  if(!item)return;
  const session=googleSession;
  trigger.disabled=true;
  try{
    const bytes=await buildGoogleSummary(item);
    if(session!==googleSession)return;
    const safe=String(item.station||id).replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
    const date=fmt(item.date).replaceAll('/','-');
    const name=[safe||id,/^\d{2}-\d{2}-\d{4}$/.test(date)?date:'','Resumo gerencial'].filter(Boolean).join(' - ')+'.pdf';
    download(bytes,name,'application/pdf');
  }catch(error){if(session===googleSession)alert(error.message);}
  finally{trigger.disabled=false;}
}
