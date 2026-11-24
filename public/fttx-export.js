'use strict';

const FTTX_EXPORT_HEADERS = [
  'Projeto', 'Etapa', 'Material', 'Unidade', 'Quantidade', 'Preço unitário estimado (R$)',
  'Subtotal estimado (R$)', 'Origem', 'Data da referência', 'URL da referência'
];
const FTTX_COST_NOTE = 'Estimativa de materiais. O subtotal cobre os itens com preço informado e não inclui mão de obra nem frete.';
let fttxExcelLibrary;

function loadFttxExcelLibrary() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!fttxExcelLibrary) fttxExcelLibrary = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/exceljs-4.4.0.min.js';
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => {
      script.remove();
      fttxExcelLibrary = null;
      reject(Error('Não foi possível carregar o exportador Excel.'));
    };
    document.head.append(script);
  });
  return fttxExcelLibrary;
}

async function buildFttxWorkbook(report) {
  const {Workbook} = await loadFttxExcelLibrary();
  const book = new Workbook();
  book.creator = 'VOANET · Infraestrutura';
  book.calcProperties.fullCalcOnLoad = true;
  const summary = book.addWorksheet('Resumo');
  const materials = book.addWorksheet('Materiais', {views:[{state:'frozen', ySplit:1}]});
  const color = 'FFB9142A';
  const header = row => {
    row.height = 28;
    row.font = {bold:true, color:{argb:'FFFFFFFF'}};
    row.fill = {type:'pattern', pattern:'solid', fgColor:{argb:color}};
    row.alignment = {vertical:'middle', wrapText:true};
  };
  const money = '"R$ " #,##0.00';
  materials.columns = [28, 27, 54, 10, 13, 22, 22, 26, 22, 42].map(width => ({width}));
  header(materials.addRow(FTTX_EXPORT_HEADERS));
  for (const item of report.items) {
    const row = materials.addRow([report.project, item.group, item.name, item.unit, item.quantity, item.price,
      null, item.source, item.checkedOn, item.url ? {text:'Abrir referência', hyperlink:item.url} : null]);
    const n = row.number;
    row.getCell(7).value = {
      formula:`IF(COUNT(E${n}:F${n})=2,ROUND(E${n}*F${n},2),"")`, result:item.subtotal ?? ''
    };
    if (item.url) row.getCell(10).font = {color:{argb:'FF185793'}, underline:true};
  }
  materials.getColumn(5).numFmt = '#,##0.##';
  materials.getColumn(6).numFmt = money + '##';
  materials.getColumn(7).numFmt = money;
  materials.autoFilter = {from:'A1', to:'J'+materials.rowCount};

  summary.columns = [{width:37}, {width:40}, {width:18}, {width:18}];
  summary.mergeCells('A1:D1');
  summary.getCell('A1').value = 'VOANET  |  Levantamento FTTx';
  header(summary.getRow(1));
  summary.addRow(['Projeto', report.project]);
  summary.mergeCells('B2:D2');
  summary.getCell('B2').alignment = {wrapText:true};
  summary.getRow(2).height = 32;
  summary.addRow(['Emissão', report.date]);
  summary.addRow(['Cabo lançado (m)', report.routeTotal]);
  summary.addRow(['Reserva técnica (m)', report.reserveTotal]);
  summary.addRow(['Cabo total (m)', report.cableTotal]);
  summary.addRow(['Linhas de material', report.items.length]);
  const last = materials.rowCount;
  summary.addRow(['Linhas sem preço', {formula:`COUNTBLANK(Materiais!F2:F${last})`, result:report.missing}]);
  const total = summary.addRow(['Subtotal estimado de materiais', {
    formula:`IF(COUNT(Materiais!F2:F${last})=0,"",SUM(Materiais!G2:G${last}))`,
    result:report.subtotal ?? ''
  }]);
  total.getCell(2).numFmt = money;
  total.font = {bold:true, color:{argb:color}};
  summary.mergeCells('A11:D12');
  summary.getCell('A11').value = FTTX_COST_NOTE;
  summary.getCell('A11').alignment = {wrapText:true, vertical:'middle'};
  return book.xlsx.writeBuffer();
}

async function buildFttxPdf(report) {
  const {PDFDocument, StandardFonts, rgb} = await loadGooglePdfLibrary();
  const doc = await PDFDocument.create();
  doc.setTitle(report.project+' - Levantamento FTTx');
  doc.setAuthor('VOANET · Infraestrutura');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const characters = new Set(regular.getCharacterSet());
  const width = 595.28, height = 841.89, left = 38, right = width-left;
  const red = rgb(.72,.08,.16), ink = rgb(.10,.15,.22), muted = rgb(.32,.38,.46);
  const tint = rgb(.95,.97,.98), border = rgb(.87,.90,.93), white = rgb(1,1,1);
  let logo, page, y;

  try {
    const response = await fetch('./voanet.png');
    if (response.ok) logo = await doc.embedPng(await response.arrayBuffer());
  } catch (_) { /* Usa o nome da empresa se a imagem estiver indisponível. */ }

  const clean = value => [...String(value ?? '').normalize('NFC').replace(/\s+/g,' ').trim()
    .replaceAll('″','"').replaceAll('′',"'").replaceAll('≥','>=').replaceAll('≤','<=')]
    .map(char => characters.has(char.codePointAt(0)) ? char : '-').join('');
  function wrap(value, limit, size, font = regular) {
    const text = clean(value);
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? line+' '+word : word;
      if (font.widthOfTextAtSize(next,size) <= limit) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (font.widthOfTextAtSize(line+char,size) > limit) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    return [...lines,line];
  }
  function draw(value, x, baseline, {size=10, font=regular, color=ink, alignRight=false} = {}) {
    const text = clean(value);
    const start = alignRight ? x-font.widthOfTextAtSize(text,size) : x;
    page.drawText(text,{x:start,y:baseline,size,font,color});
  }
  function band(top, depth, color) {
    page.drawRectangle({x:left,y:top-depth,width:right-left,height:depth,color});
  }
  function rule(baseline) {
    page.drawLine({start:{x:left,y:baseline},end:{x:right,y:baseline},thickness:.6,color:border});
  }
  function startPage(first) {
    page = doc.addPage([width,height]);
    page.drawRectangle({x:0,y:height-5,width,height:5,color:red});
    if (logo) page.drawImage(logo,{x:left,y:781,width:104,height:104*logo.height/logo.width});
    else draw('VOANET',left,784,{size:16,font:bold,color:red});
    draw('INFRAESTRUTURA  /  PROJETOS',right,785,{size:9,font:bold,color:muted,alignRight:true});
    rule(768);
    draw('Levantamento FTTx',left,737,{size:first?24:18,font:bold});
    y = 713;
    for (const line of wrap(report.project,right-left,12,bold)) {
      draw(line,left,y,{size:12,font:bold,color:red});
      y -= 15;
    }
    draw((first?'Emissão em ':'Continuação  ·  ')+report.date,left,y,{size:9,color:muted});
    y -= 18;
    if (first) {
      band(y,64,tint);
      const metrics = [
        ['Cabo lançado', fttxQuantityFormat.format(report.routeTotal)+' m'],
        ['Reserva técnica', fttxQuantityFormat.format(report.reserveTotal)+' m'],
        ['Cabo total', fttxQuantityFormat.format(report.cableTotal)+' m']
      ];
      metrics.forEach(([label,value],index) => {
        const x = left+12+index*171;
        draw(label,x,y-17,{size:8,color:muted});
        draw(value,x,y-34,{size:13,font:bold});
      });
      draw(report.subtotal===null?'Subtotal estimado indisponível':'Subtotal estimado '+fttxCurrency.format(report.subtotal),
        left+12,y-52,{size:10,font:bold,color:red});
      draw(report.missing+' de '+report.items.length+' linhas sem preço',right-12,y-52,{size:9,color:muted,alignRight:true});
      y -= 81;
      for (const line of wrap(FTTX_COST_NOTE,right-left,8.5)) {
        draw(line,left,y,{size:8.5,color:muted});
        y -= 12;
      }
      y -= 7;
    }
    band(y,21,red);
    const heading = {size:9,font:bold,color:white};
    draw('Material',left+8,y-14,heading);
    draw('Un.',left+267,y-14,heading);
    draw('Qtd.',left+342,y-14,{...heading,alignRight:true});
    draw('Unitário est.',left+427,y-14,{...heading,alignRight:true});
    draw('Subtotal est.',right-8,y-14,{...heading,alignRight:true});
    y -= 21;
  }

  startPage(true);
  let currentGroup;
  for (const item of report.items) {
    const lines = wrap(item.name,252,9);
    const depth = Math.max(19,lines.length*11+8);
    if (y-depth-(currentGroup===item.group?0:21)<54) {
      startPage(false);
      currentGroup = null;
    }
    if (currentGroup!==item.group) {
      band(y,21,tint);
      draw(item.group,left+8,y-14,{size:9,font:bold});
      y -= 21;
      currentGroup = item.group;
    }
    lines.forEach((line,index) => draw(line,left+8,y-12-index*11,{size:9}));
    draw(item.unit,left+267,y-12,{size:9});
    draw(fttxQuantityFormat.format(item.quantity),left+342,y-12,{size:9,alignRight:true});
    draw(item.price===null?'—':fttxUnitPrice.format(item.price),left+427,y-12,{size:9,alignRight:true});
    draw(item.subtotal===null?'—':fttxCurrency.format(item.subtotal),right-8,y-12,{size:9,alignRight:true});
    y -= depth;
    rule(y);
  }
  const pages = doc.getPages();
  pages.forEach((entry,index) => {
    page = entry;
    rule(43);
    draw('VOANET · Levantamento de materiais para o almoxarifado',left,30,{size:8,color:muted});
    draw(`Página ${index+1} de ${pages.length}`,right,30,{size:8,color:muted,alignRight:true});
  });
  return doc.save();
}
