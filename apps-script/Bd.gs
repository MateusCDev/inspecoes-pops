// Integração POPs — arquivo único para o Bd.gs do projeto existente.
// Substitui somente o conteúdo anterior de Bd.gs desta integração.
// Não é necessário criar schema.gs separado nesta alternativa.
// Antes de implantar, verificar se outro arquivo já declara doPost.
// Se existir, integrar o encaminhamento na função existente em vez de duplicá-la.
const BdInspecoesPOPs = (() => {
'use strict';
// Extraído da aplicação v2.2 fornecida pelo usuário.
const groups=[
 {key:'energia',title:'Energia elétrica e proteções',icon:'⚡',items:[['EL-01','Identificação dos quadros, circuitos e diagramas'],['EL-02','Conservação externa, tampas e acesso seguro'],['EL-03','Disjuntores, DPS e demais proteções: inspeção técnica'],['EL-04','Aterramento e equipotencialização: evidências / laudo'],['EL-05','Medições elétricas / termografia (quando autorizadas)']]},
 {key:'retificacao',title:'Retificadores e alimentação CC',icon:'🔌',items:[['CC-01','Fabricante, modelo, tensão nominal e módulos instalados'],['CC-02','Carga atual, capacidade e margem de expansão'],['CC-03','Alarmes, sinalizações e monitoramento remoto'],['CC-04','Redundância / módulos sobressalentes']]},
 {key:'baterias',title:'Banco de baterias',icon:'🔋',items:[['BT-01','Quantidade, modelo, Ah e datas de instalação'],['BT-02','Estado visual, bornes e conexões (sem manipulação)'],['BT-03','Arranjo elétrico e condição de proteção'],['BT-04','Tensões / ensaios / autonomia por equipe habilitada']]},
 {key:'clima',title:'Climatização e ambiente',icon:'❄️',items:[['CL-01','Fabricante, modelo, capacidade, idade e quantidade'],['CL-02','Filtragem, conservação, drenagem e condensadora'],['CL-03','Temperatura / umidade reais medidas na sala'],['CL-04','Redundância, alarmes e registros de manutenção']]},
 {key:'telecom',title:'Telecomunicações e fibras',icon:'🌐',items:[['TC-01','Modelo, patrimônio, número de série e função dos ativos'],['TC-02','Portas utilizadas, identificação e inventário lógico'],['TC-03','Alarmes e operação confirmados por sistema de gestão'],['TC-04','Organização, fixação e raio de curvatura dos cabos'],['TC-05','Rotas, redundância e documentação de enlaces']]},
 {key:'predial',title:'Infraestrutura física e segurança',icon:'🏢',items:[['IF-01','Paredes, teto, piso e sinais de umidade/infiltração'],['IF-02','Vedação de janelas, portas e passagens de cabos'],['IF-03','Rack, fixação, ventilação e limpeza técnica'],['IF-04','Controle de acesso e medidas contra incêndio'],['IF-05','Identificação e condições gerais da estação']]},
 {key:'torre',title:'Estrutura de torre',icon:'🗼',items:[
  ['TR-01','Condição visual externa da estrutura e da pintura/proteção anticorrosiva'],
  ['TR-02','Base aparente, fundação e indícios visuais de fissuras ou movimentação'],
  ['TR-03','Estais, fixações e ancoragens: evidências visuais disponíveis'],
  ['TR-04','Acesso restrito, sinalização e impedimentos de segurança'],
  ['TR-05','Sistema de aterramento e proteção contra descargas: registros de inspeção/laudo'],
  ['TR-06','Iluminação de obstáculo, quando exigida, confirmada por responsável'],
  ['TR-07','Relatório estrutural / manutenção vigente, se aplicável']
 ]},
 {key:'cftv',title:'Monitoramento por câmeras (CFTV)',icon:'📹',items:[
  ['CV-01','Existência e identificação do sistema de câmeras'],
  ['CV-02','Estado visual dos dispositivos e acessórios acessíveis'],
  ['CV-03','Câmeras apresentam imagem quando verificado em sistema autorizado'],
  ['CV-04','Gravação efetivamente confirmada em teste autorizado'],
  ['CV-05','Consulta de gravação anterior validada, se autorizada'],
  ['CV-06','Alertas de indisponibilidade e suporte documentados'],
  ['CV-07','Requisitos de privacidade e acesso restrito verificados']
 ]},
 {key:'monitoramento',title:'Monitoramento e histórico',icon:'📡',items:[['MO-01','Sensores ambientais e monitoração remota'],['MO-02','Alarmes ativos, registro de eventos e escalonamento'],['MO-03','Existência de procedimentos de contingência'],['MO-04','Falhas repetidas, manutenções e pendências anteriores']]}
];

const fields=[['nome','Estação / código'],['municipio','Município / endereço'],['ocupacao','Tipo de ocupação'],['parceiroOcupacao','Proprietário / parceiro'],['contatoOcupacao','Contato para acesso'],['horarioAcesso','Horário / condição de acesso'],['restricoesAcesso','Restrições de acesso'],['latitude','Latitude'],['longitude','Longitude'],['data','Data da vistoria'],['inicio','Horário de início'],['fim','Horário de término'],['inspetor','Técnico 01'],['inspetorAux','Técnico 02'],['equipe','Equipe'],['os','OS / SIGA+'],['tipo','Tipo de inspeção'],['acesso','Condições de acesso'],['funcao','Função da estação / serviços'],['impacto','Clientes / serviços impactados'],['enlaces','Enlaces / dependências'],['redundancia','Redundância de energia / rede'],['historico','Histórico de falhas e OS'],['observacoes','Observações gerais'],['classificacao','Criticidade operacional'],['sintese','Síntese técnica'],['investimentos','Investimentos e recomendações']];
const readings=[['tensaoAC','Tensão CA (V)'],['correnteCA','Corrente CA (A)'],['tensaoCC','Tensão CC (V)'],['cargaCC','Carga CC (A)'],['modulos','Módulos retificadores (ativos/total)'],['qtdBaterias','Quantidade de baterias'],['capBaterias','Capacidade nominal do banco (Ah)'],['autonomia','Autonomia verificada (min)'],['temp','Temperatura ambiente (°C)'],['umid','Umidade relativa (%)'],['arBTU','Capacidade de climatização (BTU/h)'],['ultimaPrev','Última preventiva (data)']];

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
    JSON.stringify(r.issues||[]),JSON.stringify({inventory:r.inventory,equipamentos:r.equipamentos,transceivers:r.invTransceivers,bancos:r.invBatteryBanks}),
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
    if(input.action==='session')return reply_({ok:true,user,capabilities:{apiVersion:2,stagedPhotos:true,summary:true,assetsSync:true,accessAdmin:true,reportRefresh:true,assetInventory:true,assetReconciliation:true}});
    if(input.action==='fleetLoad'||input.action==='fleetSave')return reply_(fleetRequest_(input,user));
    if(input.action==='users')return reply_(listAccess_(user));
    if(input.action==='manageOperator')return reply_(manageOperator_(input,user));
    if(input.action==='stations')return reply_({ok:true,stations:stations_()});
    if(input.action==='list')return reply_(listInspections_(input,user));
    if(input.action==='dashboard')return reply_(dashboard_(input,user));
    if(input.action==='photo')return reply_(stagePhoto_(input,user));
    if(input.action==='refreshReport')return reply_(refreshReport_(input,user));
    if(input.action==='pdf')return reply_(downloadPdf_(input,user));
    if(input.action==='inspectionAssets')return reply_(inspectionAssets_(input,user));
    if(input.action==='assetIssues')return reply_(assetIssues_(input,user));
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

const REPORT_LOGO = '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AAiAAAiAAAiAAAiAgPcJIMUAJYCAS4BWHNQGARAAARAAARAAARAAARAAAf8QQK4gAAKeEEDAxRNK2AcEQAAEQAAEQAAEQAAEQMC8BKAZCIAACJiQAAIuJqwUqAQCIAACIAACIAACIBDYBKA9CIAACIAACCDgAhsAARAAARAAARAAgeAngBKCAAiAAAiAAAj4mAACLj4GjuxAAARAAARAAASYAAQEQAAEQAAEQAAEgpsAAi7BXb8oHQiAAAiAgKcEsB8IgAAIgAAIgAAIgAAIeJEAAi5ehImkQAAEQMCbBJAWCIAACIAACIAACIAACIBA4BJAwCVw6w6ag4CvCSA/EAABEAABEAABEAABEAABEAABDwkg4OIhKOxmRgLQCQRAAARAAARAAARAAARAAARAAATMSQABF2/WC9ICARAAARAAARAAARAAARAAARAAARAIfgIelBABFw8gYRcQAAEQAAEQAAEQAAEQAAEQAAEQMDMB6GY+Agi4mK9OoBEIgAAIgAAIgAAIgAAIgAAIBDoB6A8CpZ4AAi6l3gQAAARAAARAAARAAARAAARKAwGUEQRAAAR8SwABF9/yRm4gAAIgAAIgAAIgAAIgcJ4APkEABEAABIKaAAIuQV29KBwIgAAIgAAIgAAIeE4Ae4IACIAACIAACHiPAAIu3mOJlEAABEAABEAABLxLAKmBAAiAAAiAAAiAQMASQMAlYKsOioMACIAACPieAHIEARAAARAAARAAARAAAc8IIODiGSfsBQIgAALmJACtQAAEQAAEQAAEQAAEQAAETEkAARdTVguUAoHAJQDNQQAEQAAEQAAEQAAEQAAEQAAEiBBwgRUEOwGUDwRAAARAAARAAARAAARAAARAAAR8TgABF58jR4YgAAIgAAIgAAIgAAIgAAIgAAIgAALBTsCgYC8hygcCIAACIAACIAACIAACIAACIAACIEAEBj4lgCtcfIobmYEACIAACIAACIAACIAACIAACLgJYAkCwUwAAZdgrl2UDQRAAARAAARAAARAAARAoDAEsC8IgAAIeI0AAi5eQ4mEQAAEQAAEQAAEQAAEQMDbBJAeCIAACIBAoBJAwCVQaw56gwAIgAAIgAAIgIA/CCBPEAABEAABEAABjwgg4OIRJuwEAiAAAiAAAiBgVgLQCwRAAARAAARAAATMSAABFzPWCnQCARAAARAIZALQHQRAAARAAARAAARAAATo/wEAAP//wBbQdwAAAAZJREFUAwAreLEQe9r1JAAAAABJRU5ErkJggg==';
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

// A lista de e-mails e perfis permanece na planilha privada, fora do site público.
const ACCESS_SHEET = 'Acessos_Inspecoes_POPs';
const ACCESS_HEADERS = ['email','perfil','ativo','emitir_chave'];
function requirePrivateData_() {
  if (DriveApp.getFileById(config_().ACCESS_SPREADSHEET_ID).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw Error('A lista de acessos precisa ter acesso geral Restrito no Drive.');
  }
  if (DriveApp.getFolderById(config_().PDF_FOLDER_ID).getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw Error('A pasta de relatórios precisa ter acesso geral Restrito no Drive.');
  }
}
function accessSheet_() {
  const book = book_(config_().ACCESS_SPREADSHEET_ID);
  const sheet = book.getSheetByName(ACCESS_SHEET);
  if (!sheet || JSON.stringify(sheet.getRange(1,1,1,4).getValues()[0]) !== JSON.stringify(ACCESS_HEADERS)) {
    throw Error('Prepare a aba Acessos_Inspecoes_POPs com email, perfil, ativo e emitir_chave.');
  }
  return sheet;
}
function accessUsers_() {
  const sheet = accessSheet_(), seen = new Set();
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().flatMap((r,i)=>{
    if (!String(r[0]||'').trim()) return [];
    const email=String(r[0]).trim().toLowerCase(),role=String(r[1]).trim().toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['GESTAO','OPERACAO'].includes(role) || seen.has(email)) throw Error('E-mail/perfil inválido ou duplicado na aba de acessos.');
    seen.add(email);
    return [{email,role,active:r[2]===true,issue:r[3]===true,row:i+2}];
  });
}
function issueAccessKeys_() {
  beginRequest_();
  requirePrivateData_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw Error('Outro processo está em andamento.');
  try {
    const selected=accessUsers_().filter(u=>u.active&&u.issue);
    if (!selected.length) throw Error('Marque emitir_chave para as pessoas que receberão uma nova chave.');
    const props=PropertiesService.getScriptProperties();
    const keys=JSON.parse(props.getProperty('TOKEN_HASHES')||'{}');
    const issued=selected.map(u=>{
      Object.keys(keys).forEach(hash=>{if(keys[hash]?.email===u.email)delete keys[hash];});
      const token=Utilities.getUuid()+Utilities.getUuid();
      keys[hash_(token)]={email:u.email};
      return {user:u,token};
    });
    props.setProperty('TOKEN_HASHES',JSON.stringify(keys));
    const sheet=accessSheet_();
    issued.forEach(({user,token})=>{
      sheet.getRange(user.row,4).setValue(false);
      console.log('E-mail: '+user.email+' | Perfil: '+user.role+'\nChave individual: '+token);
    });
    console.log('Entregue cada chave somente à pessoa correspondente. Não publique as chaves na planilha.');
  } finally {lock.releaseLock();}
}
function authenticate_(input) {
  const keys=JSON.parse(config_().TOKEN_HASHES||'{}');
  const binding=typeof input.token==='string'&&keys[hash_(input.token)];
  // Chaves antigas anônimas não podem acessar dados ou escolher um perfil.
  const user=binding?.email&&accessUsers_().find(u=>u.active&&u.email===binding.email);
  if (!user) return null;
  return {email:user.email,role:user.role};
}
function canReadRow_(row,headers,user) {
  return user.role==='GESTAO'||recordOwner_(row[0])===user.email;
}
function recordOwner_(id) {return privateValue_('OWNER_'+hash_(String(id)))||'';}
function recordRevision_(id) {return JSON.parse(privateValue_('REVISION_'+hash_(String(id)))||'null');}
function listInspections_(input,user) {
  const sheet=sheet_(),headers=headers_(),limit=50;
  let cursor=input.cursor===undefined?sheet.getLastRow():Number(input.cursor);
  if (!Number.isInteger(cursor)||cursor<1||cursor>sheet.getLastRow()) throw Error('Página inválida.');
  const items=[];
  while(cursor>1&&items.length<limit){
    const start=Math.max(2,cursor-99);
    const block=sheet.getRange(start,1,cursor-start+1,43).getValues();
    for(let i=block.length-1;i>=0;i--){
      cursor=start+i-1;
      const row=block[i];
      if(!row[0]||!canReadRow_(row,headers,user))continue;
      const get=k=>row[headers.indexOf(k)];
      items.push({id:row[0],stationCode:get('codigo_pop'),station:get('nome'),date:get('data'),updated:get('updated'),technician:get('inspetor'),owner:recordOwner_(row[0])||'Autoria não vinculada',criticality:get('classificacao'),nc:get('itens_nao_conformes'),conform:get('itens_conformes'),unverified:get('itens_nao_verificados'),due:get('scheduleDueDate'),period:get('schedulePeriod'),issues:get('qtd_pendencias')});
      if(items.length===limit)break;
    }
  }
  return {ok:true,items,nextCursor:cursor>1?cursor:null};
}
function downloadPdf_(input,user) {
  if(!/^INSP-[A-Za-z0-9-]+$/.test(input.inspectionId||''))throw Error('Registro indisponível.');
  const sheet=sheet_(),headers=headers_();
  const matches=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(input.inspectionId).matchEntireCell(true).findAll():[];
  if(matches.length!==1)throw Error('Registro indisponível.');
  const row=sheet.getRange(matches[0].getRow(),1,1,headers.length).getValues()[0];
  if(!canReadRow_(row,headers,user))throw Error('Registro indisponível.');
  // Não usar o link da planilha como autorização para ler arquivos privados do Drive.
  const pdfId=privateValue_('PDF_'+hash_(input.inspectionId));
  if(!pdfId)throw Error('PDF ainda não vinculado pelo serviço.');
  const file=DriveApp.getFileById(pdfId);
  if(file.getSize()>15*1024*1024)throw Error('PDF maior que 15 MB. Solicite o arquivo à gestão.');
  const suffix=/ - [a-f0-9]{12} - gerencial-v\d+\.pdf$/;
  const name=file.getName();
  const base=suffix.test(name)?name.replace(suffix,'') : reportFileBase_(row[headers.indexOf('nome')],row[headers.indexOf('data')],input.inspectionId);
  return {ok:true,fileName:base+'.pdf',base64:Utilities.base64Encode(file.getBlob().getBytes())};
}

function schedulingDays_(criticality){
  const normalized=String(criticality||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  if(['ALTA','CRITICA','CRITICO'].includes(normalized))return 45;
  if(normalized==='MEDIA')return 90;
  return null;
}
function stations_(){
  const sheet=book_(config_().SPREADSHEET_ID).getSheetByName('POPs');
  if(!sheet||sheet.getLastRow()<1)throw Error('Cadastro de POPs indisponível.');
  const data=sheet.getRange(1,1,sheet.getLastRow(),10).getValues(),header=data.shift();
  if(header[0]!=='Código'||header[1]!=='Nome da Estação'||header[8]!=='Criticidade')throw Error('Cabeçalho do cadastro de POPs incompatível.');
  const stations=data.flatMap(row=>{
    const code=String(row[0]??'').trim(),name=String(row[1]??'').trim();
    if(!code||!name)return [];
    const criticality=String(row[8]||'').trim();
    const inactive=code==='PCAM.021'&&name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()==='POP CORDEBRAS';
    return [{code,name,city:String(row[3]||''),criticality,days:schedulingDays_(criticality),inactive}];
  });
  const counts=Object.create(null);stations.filter(s=>!s.inactive).forEach(s=>counts[s.code]=(counts[s.code]||0)+1);
  return stations.map(s=>({...s,duplicate:!s.inactive&&counts[s.code]>1}));
}
function addInspectionDays_(date,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Data de vistoria inválida.');
  const d=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Data de vistoria inválida.');
  d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function applyScheduling_(record){
  const code=String(record.codigoPop??'').trim(),catalog=stations_();
  if(catalog.some(s=>s.inactive&&s.code===code&&s.name===record.nome))throw Error('Este POP foi retirado da programação de inspeções.');
  const station=catalog.find(s=>s.code===code&&!s.inactive);
  if(!station)throw Error('Selecione um código do cadastro de POPs.');
  if(station.duplicate)throw Error('O código deste POP está duplicado no cadastro. Solicite a correção à gestão.');
  if(!station.days)throw Error('A criticidade deste POP ainda não tem periodicidade definida.');
  record.codigoPop=station.code;record.nome=station.name;record.popCriticality=station.criticality;
  record.schedulePeriod=station.days;record.scheduleBaseDate=record.data;
  record.scheduleDueDate=addInspectionDays_(record.data,station.days);
  return {days:station.days,baseDate:record.data,dueDate:record.scheduleDueDate,criticality:station.criticality};
}

// Somente valores privados são mantidos durante uma execução, nunca credenciais no cliente.
let requestContext_ = null;
function beginRequest_(){
  const store=PropertiesService.getScriptProperties();
  requestContext_={store,values:Object.assign({},store.getProperties()),books:{}};
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
    const current={id:record.id,hash,actor:user.email,owner,updated:record.updated,state:'recebendo',createdAt:new Date().toISOString(),leaseUntil:Date.now()+JOB_LEASE_MS,schedule,reprocess,assetAuditVersion:reprocess?hash+'-'+Utilities.getUuid():hash};
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
    const reportName=reportDriveName_(record,job.hash);
    const existingPdfId=job.reprocess&&privateValue_('PDF_'+hash_(id));
    const pdf=existingPdfId?DriveApp.getFileById(existingPdfId):artifact_(folder,reportName+'.pdf',()=>createPdf_(record,folder,reportName));
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
      const assetAuditVersion=job.assetAuditVersion||job.hash;
      const assets=syncAssets_(record,assetAuditVersion);
      const result={ok:true,inspectionId:id,pdfUrl:pdf.getUrl(),backupUrl:backup.getUrl(),receivedAt:revision?.hash===job.hash?revision.receivedAt:new Date().toISOString(),schedule:job.schedule,assets};
      const target=matches.length?matches[0].getRow():sheet.getLastRow()+1;if(target>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
      if(!job.reprocess||!matches.length)sheet.getRange(target,1,1,headers.length).setValues([row_(record,result,owner,job.hash)]);
      setPrivate_('PDF_'+hash_(id),pdf.getId());
      const compactAssets={created:assets.created,updated:assets.updated,unchanged:assets.unchanged,pending:assets.pending};
      setPrivate_('REVISION_'+hash_(id),JSON.stringify({hash:job.hash,updated:record.updated,receivedAt:result.receivedAt,schedule:job.schedule,assets:compactAssets,assetAuditVersion,payloadId:job.payloadId}));
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

function summaryItem_(row,headers){
  const get=k=>row[headers.indexOf(k)],revision=recordRevision_(row[0]);
  return {id:row[0],stationCode:get('codigo_pop'),station:get('nome'),date:get('data'),updated:get('updated'),technician:get('inspetor'),owner:recordOwner_(row[0])||'Autoria não vinculada',criticality:get('classificacao'),nc:Number(get('itens_nao_conformes'))||0,conform:Number(get('itens_conformes'))||0,unverified:Number(get('itens_nao_verificados'))||0,due:get('scheduleDueDate'),period:get('schedulePeriod'),issues:Number(get('qtd_pendencias'))||0,assets:revision?.assets||null};
}
function dashboard_(input,user){
  const scope=user.role==='GESTAO'?'GESTAO':user.email+'|OPERACAO';
  const key='dash_'+hash_(scope+'|'+(privateValue_('DATA_VERSION')||'0'));
  const cache=CacheService.getScriptCache(),cached=cache.get(key);if(cached)return JSON.parse(cached);
  const sheet=sheet_(),headers=headers_(),last=sheet.getLastRow();
  const rows=last>1?sheet.getRange(2,1,last-1,43).getValues():[];
  let total=0,c=0,nc=0;const byPOP=Object.create(null),latest=new Map(),items=[];let nextCursor=null;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];if(!row[0]||!canReadRow_(row,headers,user))continue;
    const item=summaryItem_(row,headers);total++;c+=item.conform;nc+=item.nc;byPOP[item.station]=(byPOP[item.station]||0)+item.nc;
    const stationKey=String(item.stationCode||'')+'|'+item.station,old=latest.get(stationKey);
    if(!old||String(item.date)+String(item.updated)>String(old.date)+String(old.updated))latest.set(stationKey,item);
    if(items.length<50){items.push(item);if(items.length===50&&i>0)nextCursor=i+1;}
  }
  const result={ok:true,items,nextCursor,summary:{total,conform:c,nc,ranking:Object.entries(byPOP).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,8),latest:[...latest.values()]},refreshedAt:new Date().toISOString()};
  const serialized=JSON.stringify(result);if(serialized.length<90000)cache.put(key,serialized,45);return result;
}

const ASSET_TABS={
  Ativos:{station:'Local',width:7},
  'Climatização_Voanet':{station:'Estação',width:15},
  Controle_Baterias:{station:'Estação',width:18},
  Retificadores:{station:'Estação',width:18,date:'Data de Verficação'}
};
const ASSET_META=['ID_Ativo','Codigo_POP','ID_Ultima_Inspecao','Versao_Inspecao'];
const ASSET_AUDIT='Historico_Ativos_POPs';
const AUDIT_HEADERS=['ID_Evento','Momento','ID_Inspecao','Codigo_POP','Aba','ID_Ativo','Acao','Detalhe','Antes_JSON','Depois_JSON','Versao_Processamento'];
function assertAssetHeaders_(headers,name){
  if(name==='Retificadores'&&headers.includes('Data_Ultima_Inspecao')&&headers.includes('Data de Verficação'))throw Error('Datas de verificação redundantes em Retificadores.');
  const seen=new Set();
  for(const header of headers){let key=normalizeAsset_(header).replace(/[^A-Z0-9]/g,'');if(['NSERIE','NUMEROSERIE','SERIE'].includes(key))key='SERIE';if(['PATRIMONIO','PATRIMONIOREFERENCIA'].includes(key))key='PATRIMONIO';if(!key)continue;if(seen.has(key))throw Error('Colunas redundantes ou ambíguas em '+name+': '+header);seen.add(key);}
  const required=[...ASSET_META,'Nº Série','Patrimônio',ASSET_TABS[name].date||'Data_Ultima_Inspecao',ASSET_TABS[name].station,'Fabricante','Modelo'];
  if(!required.every(h=>headers.includes(h)))throw Error('Colunas de integração ainda não preparadas em '+name+'.');
}
function normalizeAsset_(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');}
function stationAssetKey_(value){return normalizeAsset_(value).replace(/^\w+[.-]\d+\s*[: -]\s*/,'').replace(/\bVOANET\b/g,'').replace(/[^A-Z0-9]/g,'');}
function identityTokens_(value,prefix){return String(value||'').split(/[,;\n]+/).map(x=>normalizeAsset_(x)).filter(x=>x&&!x.startsWith('#')&&!['N/A','NA','NAO IDENTIFICADO','SEM SERIE','SEM PATRIMONIO','-'].includes(x)).map(x=>prefix+x);}
function overlappingAssetIds_(a,b){return a.some(value=>b.includes(value));}
function paddedSerialMatch_(a,b){
  return a.length===1&&b.length===1&&/^S:\d+$/.test(a[0])&&/^S:\d+$/.test(b[0])
    &&a[0]!==b[0]&&a[0].replace(/^S:0*/,'')===b[0].replace(/^S:0*/,'');
}
function reviewed_(r,group){return ['mantido','alterado'].includes(r.inventoryReview?.[group]);}
function assetState_(v){return ({OPERACIONAL:'Operacional',ATENCAO:'Atenção','EM OBSERVACAO':'Atenção',CRITICO:'Crítico','SUBSTITUICAO RECOMENDADA':'Crítico',INATIVO:'Inativo',RETIRADA:'Inativo'})[normalizeAsset_(v)];}
function assetDate_(value){
  if(!value)return undefined;
  const original=String(value).trim();
  const br=original.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso=br?[br[3],br[2],br[1]].join('-'):original;
  try{addInspectionDays_(iso,0);return new Date(iso+'T12:00:00Z');}
  catch(_){return {_invalidDate:original};}
}
function dateKey_(value){if(!value)return '';return value instanceof Date?Utilities.formatDate(value,'America/Sao_Paulo','yyyy-MM-dd'):typeof value==='number'?new Date((value-25569)*86400000).toISOString().slice(0,10):String(value).slice(0,10);}
function commonBattery_(units,key){const values=[...new Set(units.map(u=>u[key]).filter(v=>v!==undefined&&v!==''))];return values.length===1?values[0]:undefined;}
function assetCandidates_(r){
  const candidates=[],warnings=[];
  const push=(tab,item,values,kind)=>candidates.push({tab,item,values,kind,serial:item.serie||item.serial||'',patr:item.patrimonio||'',ref:item.centralId||'',label:item.modelo||item.identificacao||kind});
  const generic=(item,kind,equipment,values={})=>push('Ativos',item,{'Local':r.nome,'Categoria':kind,'Equipamento':equipment,'Fabricante':item.fabricante||item.marca,'Modelo':item.modelo,'Status':assetState_(item.estado),'Observações':item.observacao||item.observacoes,...values},kind);
  for(const item of r.inventory||[]){
    if(!reviewed_(r,'equipamentos')&&item.confirmacao!=='Confirmado na etiqueta'){warnings.push('Equipamento não conferido: '+(item.modelo||item.id));continue;}
    if(Number(item.quantidade||1)!==1){warnings.push('Equipamento agregado deve ser identificado por unidade: '+(item.modelo||item.id));continue;}
    const types={RETIFICADORA:'Retificadora',BATERIA:'Bateria','AR-CONDICIONADO':'Ar-condicionado',GERADOR:'Gerador',NOBREAK:'Nobreak',INVERSOR:'Inversor',TRANSMISSAO:'Transmissão',OLT:'OLT',ROTEADOR:'Roteador',SWITCH:'Switch',SEGURANCA:'Segurança'};
    generic(item,types[normalizeAsset_(item.tipo)]||'Outro',item.tipo||'Equipamento');
  }
  for(const item of r.equipamentos?.climatizadores||[]){
    if(!reviewed_(r,'climatizadores')){warnings.push('Climatizador não conferido: '+(item.modelo||item.id));continue;}
    generic(item,'Ar-condicionado','Ar-condicionado');
    push('Climatização_Voanet',item,{'Estação':r.nome,'Tipo Local':'POP','Fabricante':item.marca,'Modelo':item.modelo,'BTUs':item.capacidade,'Tipo':item.tipo,'Nº Série':item.serie,'Tipo de Gás':item.gas,'Carga Gás':item.cargaGas,'Data Instalação':assetDate_(item.instalacao),'Última Medição Corrente':item.corrente,'Última Medição Temperatura':item.temperatura,'Protocolo referencia':r.os},'Ar-condicionado');
  }
  for(const item of r.equipamentos?.retificadoras||[]){
    if(!reviewed_(r,'retificadoras')){warnings.push('Retificadora não conferida: '+(item.modelo||item.id));continue;}
    generic(item,'Retificadora','Sistema Retificador');
    push('Retificadores',item,{'Estação':r.nome,'Modelo':item.modelo,'Fabricante':item.fabricante,'Módulos':item.urInstaladas,'Corrente (A) (TOTAL)':item.capacidadeCC,'Tensão (V)':item.tensao,'UR 01':item.ur01,'UR 02':item.ur02,'UR 03':item.ur03,'UR 04':item.ur04,'Data de Verficação':assetDate_(r.data),'Proxima Verificação':assetDate_(r.scheduleDueDate),'Observações':item.observacao},'Retificadora');
  }
  for(const item of r.equipamentos?.dios||[]){if(reviewed_(r,'dios'))generic(item,'Transmissão','DIO');else warnings.push('DIO não conferido: '+(item.identificacao||item.id));}
  for(const item of r.invTransceivers||[]){if(reviewed_(r,'transceivers'))generic(item,'Transmissão','Transceiver '+(item.tipo||''));else warnings.push('Transceiver não conferido: '+(item.serie||item.id));}
  for(const bank of r.invBatteryBanks||[]){
    const units=bank.baterias||[];
    for(const unit of units){if(['mantida','substituida'].includes(r.batteryReview?.[unit.id]))generic(unit,'Bateria','Bateria');}
    if(bank.cadastroCompleto!==true||!units.length||units.some(u=>!['mantida','substituida'].includes(r.batteryReview?.[u.id])||u.estado==='Retirada')){warnings.push('Banco incompleto, não conferido ou com retirada: '+(bank.identificacao||bank.id));continue;}
    if(!commonBattery_(units,'modelo')||!commonBattery_(units,'fabricante')){warnings.push('Banco com modelo/fabricante misto ou ausente: '+(bank.identificacao||bank.id));continue;}
    const item={...bank,serie:units.map(u=>u.serie||'').filter(Boolean).sort().join(', '),patrimonio:units.map(u=>u.patrimonio||'').filter(Boolean).sort().join(', ')};
    const technology=commonBattery_(units,'tecnologia');
    const techMap={'CHUMBO-ACIDO':'CHUMBO-ÁCIDO (VRLA)','LIFEPO4':'LÍTIO (LiFePO4)'};
    push('Controle_Baterias',item,{'Estação':r.nome,'Tecnologia':techMap[normalizeAsset_(technology)]||technology,'Fabricante':commonBattery_(units,'fabricante'),'Modelo':commonBattery_(units,'modelo'),'Quantidade':units.length,'Patrimônio':item.patrimonio,'Descrição':bank.identificacao,'Ano Fabricante':assetDate_(commonBattery_(units,'fabricacao')),'Data Instalação':assetDate_(commonBattery_(units,'instalacao')),'Autonomia (h)':bank.autonomiaHoras,'Tensão Nominal (V)':bank.tensao,'Capacidade (Ah)':bank.capacidade,'Observações':bank.observacao},'Banco de baterias');
  }
  return {candidates,warnings};
}
function prepareAssetSheets_(){
  const book=book_(config_().SPREADSHEET_ID);
  for(const name of Object.keys(ASSET_TABS)){
    const sheet=book.getSheetByName(name);if(!sheet)throw Error('Aba cadastral ausente: '+name);
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    assertAssetHeaders_(headers,name);
  }
  const privateBook=book_(config_().ACCESS_SPREADSHEET_ID);let audit=privateBook.getSheetByName(ASSET_AUDIT);
  if(!audit){audit=privateBook.insertSheet(ASSET_AUDIT);audit.getRange(1,1,1,AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);audit.setFrozenRows(1);}
  else if(audit.getRange(1,11).getValue()!=='Versao_Processamento')audit.getRange(1,11).setValue('Versao_Processamento');
}
function assetTable_(name){
  const sheet=book_(config_().SPREADSHEET_ID).getSheetByName(name);if(!sheet)throw Error('Aba ausente: '+name);
  const width=sheet.getLastColumn(),range=sheet.getRange(1,1,Math.max(1,sheet.getLastRow()),width),values=range.getValues();
  assertAssetHeaders_(values[0],name);
  return {sheet,headers:values[0],values,width};
}
function sameAssetStation_(row,headers,r,config){
  const code=row[headers.indexOf('Codigo_POP')];if(code)return String(code).trim()===String(r.codigoPop);
  return stationAssetKey_(row[headers.indexOf(config.station)])===stationAssetKey_(r.nome);
}
function findAssetRow_(table,candidate,r){
  const h=table.headers,config=ASSET_TABS[candidate.tab],get=(row,k)=>row[h.indexOf(k)];
  const incoming=[...identityTokens_(candidate.serial,'S:'),...identityTokens_(candidate.patr,'P:')];
  const rows=table.values.slice(1).map((row,i)=>({row,index:i+2})).filter(x=>x.row.some(v=>v!==''));
  let matches=[];
  if(candidate.ref)matches=rows.filter(x=>get(x.row,'ID_Ativo')===candidate.ref);
  if(!matches.length&&incoming.length)matches=rows.filter(x=>{
    const identifiers=[...identityTokens_(get(x.row,'Nº Série'),'S:'),...identityTokens_(get(x.row,'Patrimônio'),'P:')];
    return incoming.some(id=>identifiers.includes(id));
  });
  if(!matches.length){
    const model=normalizeAsset_(candidate.values.Modelo),maker=normalizeAsset_(candidate.values.Fabricante);
    if(model&&maker){
      const similar=rows.filter(x=>sameAssetStation_(x.row,h,r,config)&&normalizeAsset_(get(x.row,'Modelo'))===model
        &&normalizeAsset_(get(x.row,'Fabricante'))===maker&&(candidate.tab!=='Ativos'||normalizeAsset_(get(x.row,'Categoria'))===normalizeAsset_(candidate.values.Categoria)));
      const serial=identityTokens_(candidate.serial,'S:'),patr=identityTokens_(candidate.patr,'P:');
      matches=similar.filter(x=>{
        const oldSerial=identityTokens_(get(x.row,'Nº Série'),'S:'),oldPatr=identityTokens_(get(x.row,'Patrimônio'),'P:');
        return (!serial.length||!oldSerial.length||oldSerial.some(id=>serial.includes(id)))
          &&(!patr.length||!oldPatr.length||oldPatr.some(id=>patr.includes(id)));
      });
    }
  }
  if(matches.length>1)throw Error('Mais de um equipamento corresponde à identificação.');
  if(matches.length&&!sameAssetStation_(matches[0].row,h,r,config))throw Error('O equipamento está vinculado a outro POP; movimentação exige conferência.');
  if(matches.length){const oldMaker=normalizeAsset_(get(matches[0].row,'Fabricante')),newMaker=normalizeAsset_(candidate.values.Fabricante);if(oldMaker&&newMaker&&oldMaker!==newMaker)throw Error('Fabricante divergente para a mesma identificação; solicite conferência.');}
  if(matches.length&&candidate.kind!=='Banco de baterias'){
    const oldSerial=identityTokens_(get(matches[0].row,'Nº Série'),'S:'),newSerial=identityTokens_(candidate.serial,'S:');
    const samePatr=overlappingAssetIds_(identityTokens_(get(matches[0].row,'Patrimônio'),'P:'),identityTokens_(candidate.patr,'P:'));
    if(oldSerial.length&&newSerial.length&&!overlappingAssetIds_(oldSerial,newSerial)&&!(samePatr&&paddedSerialMatch_(oldSerial,newSerial)))throw Error('A série diverge da identificação já cadastrada; confirme a substituição com a gestão.');
  }
  if(!matches.length&&!incoming.length)throw Error('Informe número de série ou patrimônio antes de criar o ativo.');
  return matches[0]||null;
}
function validatedAssetValue_(rule,value,header){
  if(value===undefined||value===null||value==='')return undefined;
  if(value?._invalidDate)throw Error('Data inválida: '+value._invalidDate);
  if(typeof value==='string'&&['NAO VERIFICADO','NAO IDENTIFICADO'].includes(normalizeAsset_(value)))return undefined;
  if(['Nº Série','Patrimônio'].includes(header)&&!identityTokens_(value,'').length)return undefined;
  if(['BTUs','Carga Gás','Última Medição Corrente','Última Medição Temperatura','Módulos','Corrente (A) (TOTAL)','Tensão (V)','Quantidade','Autonomia (h)','Tensão Nominal (V)','Capacidade (Ah)'].includes(header)){
    const raw=String(value).trim();
    const gasUnit=header==='Carga Gás'?raw.match(/\s*(kg|g)$/i):null;
    const normalized=(gasUnit?raw.slice(0,gasUnit.index):raw.replace(/\s*(BTU\/h|BTUs?|Ah|A|V|h|°C)$/i,'')).replace(',','.');
    if(!/^-?\d+(\.\d+)?$/.test(normalized))throw Error(header==='Carga Gás'?'Informe a carga em g ou kg.':'Informe um valor numérico.');
    value=Number(normalized)*(gasUnit?.[1].toLowerCase()==='kg'?1000:1);
  }
  if(value instanceof Date)return value;
  if(!rule)return text_(value);
  const type=String(rule.getCriteriaType()),criteria=rule.getCriteriaValues();
  if(type==='VALUE_IN_LIST'||type==='VALUE_IN_RANGE'){
    const allowed=type==='VALUE_IN_LIST'?criteria[0]:criteria[0].getDisplayValues().flat();
    const match=allowed.find(v=>normalizeAsset_(v)===normalizeAsset_(value));if(match===undefined)throw Error('Valor não permitido pela validação: '+value);return match;
  }
  return value instanceof Date?value:text_(value);
}
function writeAssetPatch_(table,rowIndex,patch,warnings,strict=false){
  const range=table.sheet.getRange(rowIndex,1,1,table.width),formulas=range.getFormulas()[0],rules=range.getDataValidations()[0],before=range.getValues()[0],after=before.slice(),changed=[];
  for(const [header,value] of Object.entries(patch)){
    const col=table.headers.indexOf(header);
    if(col<0)continue;
    if(formulas[col]){
      if(strict&&['Nº Série','Patrimônio'].includes(header)&&identityTokens_(value,'').length&&String(before[col])!==String(value)){
        warnings.push(header+': a célula usa uma fórmula que precisa ser conferida na planilha.');
      }
      continue;
    }
    try{const rule=rules[col]||assetFallbackRule_(table.sheet.getName(),header);const accepted=validatedAssetValue_(rule,value,header);if(accepted===undefined)continue;if(JSON.stringify(before[col])===JSON.stringify(accepted))continue;after[col]=accepted;changed.push(col);}
    catch(error){warnings.push(header+': '+error.message);}
  }
  if(strict&&warnings.length)throw Error(warnings.join(' · '));
  for(const header of ['Nº Série','Patrimônio']){
    const col=table.headers.indexOf(header);
    if(changed.includes(col)&&typeof after[col]==='string')table.sheet.getRange(rowIndex,col+1).setNumberFormat('@');
  }
  changed.sort((a,b)=>a-b);
  for(let i=0;i<changed.length;){let j=i;while(j+1<changed.length&&changed[j+1]===changed[j]+1)j++;table.sheet.getRange(rowIndex,changed[i]+1,1,changed[j]-changed[i]+1).setValues([after.slice(changed[i],changed[j]+1)]);i=j+1;}
  for(const header of ['Data_Ultima_Inspecao','Data de Verficação','Proxima Verificação']){const col=table.headers.indexOf(header);if(changed.includes(col))table.sheet.getRange(rowIndex,col+1).setNumberFormat('dd/MM/yyyy');}
  table.values[rowIndex-1]=after;return {changed:changed.length,before,after};
}
function assetFallbackRule_(tab,header){
  // Tabelas nativas podem expor a validação somente na propriedade da coluna.
  const lists={
    Ativos:{Categoria:['Retificadora','Bateria','Ar-condicionado','Gerador','Nobreak','Inversor','Transmissão','OLT','Roteador','Segurança','Outro','Inversor de Potência','Switch'],Status:['Operacional','Atenção','Crítico','Inativo']},
    Retificadores:{Fabricante:['XPS','Huawei','Emerson','Apr48','Volt']}
  };
  let allowed=lists[tab]?.[header];
  if(tab==='Climatização_Voanet'&&header==='Tipo Local')allowed=book_(config_().SPREADSHEET_ID).getSheetByName('FONTES').getRange('A2:A3').getDisplayValues().flat();
  if(tab==='Controle_Baterias'&&header==='Tecnologia')allowed=book_(config_().SPREADSHEET_ID).getSheetByName('FONTES').getRange('D2:D6').getDisplayValues().flat();
  return allowed?{getCriteriaType:()=> 'VALUE_IN_LIST',getCriteriaValues:()=>[allowed]}:null;
}
function appendNativeAssetRow_(table){
  // Insere dentro do limite atual para as tabelas nativas acompanharem a nova linha.
  const oldLast=Math.max(2,table.sheet.getLastRow()),target=oldLast;
  table.sheet.insertRowsBefore(target,1);
  const source=table.sheet.getRange(target+1,1,1,table.width),destination=table.sheet.getRange(target,1,1,table.width);
  source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
  source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);
  destination.clearContent();destination.setFormulasR1C1(source.getFormulasR1C1());
  table.values.splice(target-1,0,Array(table.width).fill(''));return target;
}
function syncAssets_(r,version){
  const {candidates,warnings}=assetCandidates_(r),result={created:0,updated:0,unchanged:0,pending:0,warnings:[]},events=[],tables={};
  const log=(tab,id,action,detail,before,after)=>events.push([hash_(r.id+'|'+version+'|'+tab+'|'+id+'|'+action+'|'+detail+'|'+JSON.stringify(after||{})),new Date(),r.id,r.codigoPop,tab,id,action,detail,JSON.stringify(before||{}),JSON.stringify(after||{}),version]);
  for(const warning of warnings){result.pending++;result.warnings.push(warning);log('', '', 'PENDENCIA',warning);}
  for(const candidate of candidates){
    try{
      const table=tables[candidate.tab]||(tables[candidate.tab]=assetTable_(candidate.tab));
      const found=findAssetRow_(table,candidate,r),h=table.headers;
      if(found){
        const date=dateKey_(found.row[h.indexOf(ASSET_TABS[candidate.tab].date||'Data_Ultima_Inspecao')]),revision=String(found.row[h.indexOf('Versao_Inspecao')]||'');
        if(date>r.data||(date===r.data&&revision>r.updated))throw Error('Inspeção anterior à última atualização deste ativo.');
      }
      const id=found?.row[h.indexOf('ID_Ativo')]||'AS-'+hash_(candidate.tab+'|'+r.codigoPop+'|'+(candidate.serial||candidate.patr||String(found?.index))).slice(0,24);
      const row=found?.index||appendNativeAssetRow_(table),fieldWarnings=[];
      const patch={...candidate.values,ID_Ativo:id,Codigo_POP:r.codigoPop,'Nº Série':candidate.serial,'Patrimônio':candidate.patr,[ASSET_TABS[candidate.tab].date||'Data_Ultima_Inspecao']:assetDate_(r.data),ID_Ultima_Inspecao:r.id,Versao_Inspecao:r.updated};
      const written=writeAssetPatch_(table,row,patch,fieldWarnings);
      const action=!found?'CRIADO':written.changed?'ATUALIZADO':'SEM_ALTERACAO';
      if(!found)result.created++;else if(written.changed)result.updated++;else result.unchanged++;
      if(action!=='SEM_ALTERACAO')log(candidate.tab,id,action,candidate.label,written.before,written.after);
      for(const warning of fieldWarnings){result.pending++;result.warnings.push(candidate.tab+' · '+candidate.label+': '+warning);log(candidate.tab,id,'PENDENCIA',warning);}
    }catch(error){const detail=candidate.tab+' · '+candidate.label+': '+error.message;result.pending++;result.warnings.push(detail);log(candidate.tab,candidate.ref,'PENDENCIA',detail);}
  }
  appendAssetEvents_(events);
  // O resumo nas propriedades tem tamanho limitado; os detalhes integrais ficam no histórico privado.
  result.warnings=result.warnings.slice(0,12).map(x=>x.slice(0,220));return result;
}
function appendAssetEvents_(events){
  const audit=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);if(!audit)throw Error('Histórico de ativos não preparado.');
  const seen=new Set(audit.getLastRow()>1?audit.getRange(2,1,audit.getLastRow()-1,1).getValues().flat():[]),fresh=events.filter(e=>!seen.has(e[0]));
  if(fresh.length){const target=audit.getLastRow()+1;if(target+fresh.length-1>audit.getMaxRows())audit.insertRowsAfter(audit.getMaxRows(),fresh.length+100);audit.getRange(target,1,fresh.length,AUDIT_HEADERS.length).setValues(fresh.map(row=>row.map(v=>v instanceof Date?v:text_(v))));}
}
function openAssetIssues_(id,revision){
  const sheet=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);
  const rows=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,AUDIT_HEADERS.length).getValues():[];
  const current=rows.filter(r=>r[2]===id&&r[10]===(revision?.assetAuditVersion||revision?.hash));
  const closed=new Set(current.filter(r=>['VINCULADO','SUBSTITUIDO'].includes(r[6])).map(r=>r[7].split('|')[0]));
  return current.filter(r=>r[6]==='PENDENCIA'&&!closed.has(r[0]));
}
function assetIssues_(input,user){
  const owner=recordOwner_(input.inspectionId);if(!owner||(owner!==user.email&&user.role!=='GESTAO'))throw Error('Registro indisponível.');
  const revision=recordRevision_(input.inspectionId);
  return {ok:true,issues:openAssetIssues_(input.inspectionId,revision).map(r=>({tab:r[4],detail:r[7]}))};
}

function inspectionAssets_(input,user){
  const id=input.inspectionId;
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||'')||user.role!=='GESTAO'||!recordOwner_(id))throw Error('Inventário indisponível.');
  const revision=recordRevision_(id);
  if(!revision?.payloadId)throw Error('O inventário desta inspeção ainda não está disponível.');
  const record=readJsonFile_(revision.payloadId);
  const banks=record.invBatteryBanks?.length?record.invBatteryBanks:(record.equipamentos?.bancos||[]);
  const groups=[
    ['Equipamentos de rede',record.inventory],
    ['Transceivers',record.invTransceivers],
    ['Climatização',record.equipamentos?.climatizadores],
    ['Retificadores',record.equipamentos?.retificadoras],
    ['DIOs',record.equipamentos?.dios],
    ['Bancos de baterias',banks],
    ['Baterias',banks.flatMap(bank=>bank.baterias||[])]
  ].filter(([,items])=>Array.isArray(items)&&items.length).map(([label,items])=>({
    label,items:items.map(item=>({
      name:String(item.modelo||item.identificacao||item.tipo||'Sem identificação').slice(0,130),
      serial:String(item.serie||item.serial||'').slice(0,80),
      asset:String(item.patrimonio||'').slice(0,80),
      status:String(item.estado||item.confirmacao||'').slice(0,90)
    }))
  }));
  return {ok:true,inspectionId:id,groups};
}

function centralBatteryBanks_(user){
  if(user.role!=='GESTAO')throw Error('Consulta disponível para a Gestão.');
  const {sheet,headers,values,width}=assetTable_('Controle_Baterias');
  const rows=sheet.getRange(1,1,values.length,width).getDisplayValues().slice(1);
  const banks=rows.flatMap(row=>{
    const get=name=>row[headers.indexOf(name)];
    const station=get('Estação'),model=get('Modelo'),name=get('Descrição');
    if(!station||!model&&!name&&!get('Patrimônio'))return [];
    return [{station,name,model,maker:get('Fabricante'),quantity:get('Quantidade'),
      installed:get('Data Instalação'),age:get('Tempo de Uso (meses)'),
      nextTest:get('Próxima Teste'),status:get('Status')}];
  });
  return {ok:true,banks};
}

function centralAssetsForInspection_(input,user){
  const id=input.inspectionId;
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||'')||user.role!=='GESTAO'||!recordOwner_(id))throw Error('Cadastro indisponível.');
  const revision=recordRevision_(id);
  if(!revision?.payloadId)throw Error('A identificação do POP desta vistoria está indisponível.');
  const record=readJsonFile_(revision.payloadId);
  const groups=Object.entries(ASSET_TABS).map(([tab,config])=>{
    const {values,headers}=assetTable_(tab);
    const items=values.slice(1).filter(row=>sameAssetStation_(row,headers,record,config)
      &&stationAssetKey_(row[headers.indexOf(config.station)])===stationAssetKey_(record.nome)).map(row=>{
      const get=name=>row[headers.indexOf(name)];
      return {name:[get('Equipamento')||get('Descrição'),get('Fabricante'),get('Modelo')].filter(Boolean).join(' · '),
        serial:get('Nº Série'),asset:get('Patrimônio'),status:get('Status')};
    });
    return {label:tab,items};
  }).filter(group=>group.items.length);
  return {ok:true,groups};
}

function comparisonAsset_(candidate,table,entry,record){
  const {row}=entry,h=table.headers,get=name=>row[h.indexOf(name)];
  const serial=identityTokens_(candidate.serial,'S:'),patr=identityTokens_(candidate.patr,'P:');
  const previousSerial=identityTokens_(get('Nº Série'),'S:'),previousPatr=identityTokens_(get('Patrimônio'),'P:');
  const samePatr=overlappingAssetIds_(patr,previousPatr);
  const sameRawSerial=overlappingAssetIds_(serial,previousSerial);
  const paddedSerial=paddedSerialMatch_(serial,previousSerial);
  const sameSerial=sameRawSerial||(samePatr&&paddedSerial);
  const serialDiff=serial.length>0&&previousSerial.length>0&&!sameSerial;
  const patrDiff=patr.length>0&&previousPatr.length>0&&!samePatr;
  const sameRef=Boolean(candidate.ref&&candidate.ref===get('ID_Ativo'));
  const config=ASSET_TABS[candidate.tab];
  const station=String(get(config.station)||'');
  const sameStation=sameAssetStation_(row,h,record,config)&&stationAssetKey_(station)===stationAssetKey_(record.nome);
  const maker=normalizeAsset_(candidate.values.Fabricante),oldMaker=normalizeAsset_(get('Fabricante'));
  const model=normalizeAsset_(candidate.values.Modelo).replace(/[^A-Z0-9]/g,'');
  const oldModel=normalizeAsset_(get('Modelo')).replace(/[^A-Z0-9]/g,'');
  const sameModel=Boolean(model&&model===oldModel&&(!maker||!oldMaker||maker===oldMaker));
  const bankLabel=candidate.tab==='Controle_Baterias'&&candidate.label&&normalizeAsset_(candidate.label)===normalizeAsset_(get('Descrição'));
  const score=(sameRef?16:0)+(sameSerial?8:0)+(samePatr?6:0)+(sameStation&&(sameModel||bankLabel)?2:0);
  if(!score)return null;
  const basis=[sameRef&&'Vínculo anterior',sameRawSerial&&'Série igual',(sameSerial&&!sameRawSerial)&&'Série equivalente com zeros à esquerda',samePatr&&'Patrimônio igual',sameModel&&'Modelo igual',bankLabel&&'Banco com a mesma identificação'].filter(Boolean);
  const date=dateKey_(get(config.date||'Data_Ultima_Inspecao'));
  return {entry,score,sameStation,sameModel,sameRef,sameSerial,samePatr,serialDiff,patrDiff,
    newer:date>record.data||(date===record.data&&String(get('Versao_Inspecao')||'')>record.updated),paddedSerial,
    display:{station,model:get('Modelo'),maker:get('Fabricante'),serial:get('Nº Série'),patr:get('Patrimônio'),
      name:get('Descrição'),quantity:get('Quantidade'),gas:get('Carga Gás'),installed:dateKey_(get('Data Instalação')),basis,serialDiff,patrDiff,
      otherStation:!sameStation}};
}

function assetComparisonData_(id,user){
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||'')||user.role!=='GESTAO'||!recordOwner_(id))throw Error('Conferência indisponível.');
  const revision=recordRevision_(id);
  if(!revision?.payloadId)throw Error('O inventário arquivado desta inspeção está indisponível.');
  const issues=openAssetIssues_(id,revision);
  const record=readJsonFile_(revision.payloadId);
  const {candidates}=assetCandidates_(record);
  for(const bank of record.invBatteryBanks||[]){
    const label=bank.identificacao||bank.id;
    if(candidates.some(item=>item.tab==='Controle_Baterias'&&item.label===label))continue;
    const batteries=bank.baterias||[];
    candidates.push({tab:'Controle_Baterias',label,serial:batteries.map(item=>item.serie).filter(Boolean).join(', '),
      patr:batteries.map(item=>item.patrimonio).filter(Boolean).join(', '),values:{
        Fabricante:commonBattery_(batteries,'fabricante'),Modelo:commonBattery_(batteries,'modelo'),Quantidade:batteries.length}});
  }
  const tables={},comparisons=[];
  for(const candidate of candidates){
    const prefix=candidate.tab+' · '+candidate.label+': ';
    const related=issues.filter(issue=>issue[4]===candidate.tab
      ? issue[7].startsWith(prefix)||(!issue[7].startsWith(candidate.tab+' · ')&&candidate.tab!=='Ativos')
      : candidate.tab==='Controle_Baterias'&&!issue[4]&&issue[7].endsWith(': '+candidate.label));
    if(!related.length)continue;
    const table=tables[candidate.tab]||(tables[candidate.tab]=assetTable_(candidate.tab));
    const matches=table.values.slice(1).map((row,i)=>comparisonAsset_(candidate,table,{row,index:i+2},record))
      .filter(Boolean).sort((a,b)=>b.score-a.score);
    const identityIssues=related.filter(issue=>issue[7].startsWith(prefix)&&/série diverge|mais de um equipamento|fabricante divergente/i.test(issue[7]));
    const hasSerial=identityTokens_(candidate.serial,'S:').length===1;
    const identity=JSON.stringify([candidate.tab,candidate.label,candidate.item?.id,candidate.serial,candidate.patr]);
    for(const match of matches.slice(0,6)){
      const stableIdentity=match.sameRef||match.sameSerial||match.samePatr;
      const elsewhere=matches.some(other=>other!==match&&(other.sameSerial||other.samePatr));
      const uniqueCandidate=candidates.filter(item=>item.tab===candidate.tab&&item.label===candidate.label).length===1;
      const permitted=candidate.tab==='Ativos'&&uniqueCandidate&&identityIssues.length===1&&match.sameStation&&!match.newer&&!elsewhere;
      if(permitted&&stableIdentity&&!match.serialDiff&&!match.patrDiff&&match.sameModel)match.operation='link';
      if(permitted&&hasSerial&&match.serialDiff&&!match.paddedSerial&&!match.patrDiff&&(match.samePatr||match.sameModel))match.operation='replace';
      if(match.operation){
        match.issue=identityIssues[0];
        match.token=hash_(JSON.stringify([id,revision.hash,match.issue[0],identity,match.entry.row,match.operation]));
      }
    }
    comparisons.push({candidate,table,matches:matches.slice(0,6),related});
  }
  return {record,revision,issues,comparisons};
}

function compareInspectionAssets_(input,user){
  const data=assetComparisonData_(input.inspectionId,user);
  return {ok:true,items:data.comparisons.map(({candidate,matches,related})=>({
    tab:candidate.tab,label:candidate.label,station:data.record.nome,model:candidate.values.Modelo,maker:candidate.values.Fabricante,
    serial:candidate.serial,patr:candidate.patr,quantity:candidate.values.Quantidade,
    gas:candidate.values['Carga Gás'],installed:candidate.values['Data Instalação'] instanceof Date
      ? dateKey_(candidate.values['Data Instalação']) : candidate.values['Data Instalação']?._invalidDate,
    issues:related.map(issue=>issue[7]),
    matches:matches.map(match=>({...match.display,operation:match.operation,token:match.token}))
  }))};
}

function applyAssetDecision_(input,user){
  if(user.role!=='GESTAO')throw Error('Decisão disponível para a Gestão.');
  const id=input.inspectionId,reason=String(input.reason||'').trim();
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||'')||!/^[a-f0-9]{64}$/.test(input.decisionToken||''))throw Error('Abra a comparação novamente.');
  if(reason.length<5||reason.length>300)throw Error('Informe o motivo da decisão (5 a 300 caracteres).');
  return withWriteLock_(()=>{
    if(privateValue_(jobKey_(id)))throw Error('A inspeção tem um processamento pendente. Aguarde e atualize a conferência.');
    const data=assetComparisonData_(id,user);
    const group=data.comparisons.find(item=>item.matches.some(match=>match.token===input.decisionToken));
    if(!group)throw Error('O cadastro ou a pendência mudou. Abra a comparação novamente.');
    const {candidate,table}=group,match=group.matches.find(item=>item.token===input.decisionToken);
    const {record,revision}=data,{row,index}=match.entry;
    const assetId=row[table.headers.indexOf('ID_Ativo')]||'AS-'+hash_('Ativos|'+record.codigoPop+'|'+input.decisionToken).slice(0,24);
    const patch={...candidate.values,ID_Ativo:assetId,Codigo_POP:record.codigoPop,
      'Nº Série':candidate.serial,'Patrimônio':candidate.patr,Data_Ultima_Inspecao:assetDate_(record.data),
      ID_Ultima_Inspecao:id,Versao_Inspecao:record.updated};
    const version=revision.assetAuditVersion||revision.hash;
    const detail=match.issue[0]+'|'+user.email+'|'+reason;
    const pendingEvent=[hash_(input.decisionToken+'|DECISAO'),new Date(),id,record.codigoPop,'Ativos',assetId,
      'DECISAO',detail,JSON.stringify(row),JSON.stringify(patch),version];
    appendAssetEvents_([pendingEvent]);
    const written=writeAssetPatch_(table,index,patch,[],true);
    SpreadsheetApp.flush();
    const action=match.operation==='replace'?'SUBSTITUIDO':'VINCULADO';
    appendAssetEvents_([[hash_(input.decisionToken+'|'+action),new Date(),id,record.codigoPop,'Ativos',assetId,
      action,detail,JSON.stringify(written.before),JSON.stringify(written.after),version]]);
    revision.assets={...revision.assets,pending:data.issues.length-1};
    setPrivate_('REVISION_'+hash_(id),JSON.stringify(revision));
    setPrivate_('DATA_VERSION',Utilities.getUuid());
    return {ok:true,action};
  });
}

function requireManager_(user){if(!user||user.role!=='GESTAO')throw Error('Acesso restrito à gestão.');}
function listAccess_(user){requireManager_(user);return {ok:true,users:accessUsers_().map(u=>({email:u.email,role:u.role,active:u.active}))};}
function logAccessChange_(manager,email,action){
  const book=book_(config_().ACCESS_SPREADSHEET_ID);let sheet=book.getSheetByName('Historico_Acessos_POPs');
  if(!sheet){sheet=book.insertSheet('Historico_Acessos_POPs');sheet.getRange(1,1,1,4).setValues([['Momento','Gestor','Operador','Acao']]);sheet.setFrozenRows(1);}
  if(sheet.getLastRow()+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
  sheet.getRange(sheet.getLastRow()+1,1,1,4).setValues([[new Date(),text_(manager),text_(email),action]]);
}
function manageOperator_(input,user){
  requireManager_(user);
  const email=String(input.email||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))throw Error('Informe um e-mail válido.');
  if(!['issue','deactivate'].includes(input.operation))throw Error('Operação de acesso inválida.');
  if(input.role&&input.role!=='OPERACAO')throw Error('Esta tela cadastra somente operadores.');
  return withWriteLock_(()=>{
    const users=accessUsers_(),manager=users.find(u=>u.email===user.email&&u.active&&u.role==='GESTAO');if(!manager)throw Error('Acesso gerencial não confirmado.');
    const existing=users.find(u=>u.email===email);
    if(existing?.role==='GESTAO')throw Error('Os acessos da Gestão são administrados pelo responsável pela configuração.');
    if(input.operation==='deactivate'&&!existing)throw Error('Operador não encontrado.');
    const keys=JSON.parse(privateValue_('TOKEN_HASHES')||'{}');Object.keys(keys).forEach(k=>{if(keys[k]?.email===email)delete keys[k];});
    let token=null;if(input.operation==='issue'){token=Utilities.getUuid()+Utilities.getUuid();keys[hash_(token)]={email};}
    // Nenhuma chave é gravada na planilha ou no histórico. Reemissão revoga a anterior.
    setPrivate_('TOKEN_HASHES',JSON.stringify(keys));
    const sheet=accessSheet_();let row=existing?.row;
    if(!row){row=Math.max(2,sheet.getLastRow());sheet.insertRowsBefore(row,1);const source=sheet.getRange(row+1,1,1,4),destination=sheet.getRange(row,1,1,4);source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);source.copyTo(destination,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);}
    sheet.getRange(row,1,1,4).setValues([[email,'OPERACAO',input.operation==='issue',false]]);
    logAccessChange_(user.email,email,input.operation==='deactivate'?'DESATIVADO':existing?'CHAVE_REEMITIDA':'OPERADOR_CADASTRADO');
    return {ok:true,email,token,active:input.operation==='issue'};
  });
}

// A planilha compartilhada recebe apenas a visão operacional. O acervo e a
// auditoria autenticada ficam no Drive, em uma pasta dedicada e restrita.
const FLEET_SHEET = 'Frota';
const FLEET_HEADERS = ['Tipo de registro','ID do registro','ID do veículo','Placa','Descrição','Data','Status'];
const FLEET_COLLECTIONS = ['vehicles','drivers','inspections','issues','handovers'];
const FLEET_LIMIT = 12 * 1024 * 1024;

function fleetSheet_() {
  const sheet = book_(config_().SPREADSHEET_ID).getSheetByName(FLEET_SHEET);
  if (!sheet || JSON.stringify(sheet.getRange(1,1,1,FLEET_HEADERS.length).getDisplayValues()[0]) !== JSON.stringify(FLEET_HEADERS)) {
    throw Error('A guia Frota precisa ter os cabeçalhos previstos.');
  }
  return sheet;
}

function fleetFolder_() {
  const id = privateValue_('FLEET_FOLDER_ID');
  if (!id) throw Error('A Frota aguarda configuração no Apps Script.');
  const folder = DriveApp.getFolderById(id);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw Error('A pasta da Frota precisa ter acesso geral Restrito.');
  return folder;
}

function setupFleet() {
  return withWriteLock_(() => {
    fleetSheet_();
    if (!privateValue_('FLEET_FOLDER_ID')) {
      const folder = DriveApp.createFolder('Frota Infra — arquivo restrito');
      setPrivate_('FLEET_FOLDER_ID',folder.getId());
    }
    fleetFolder_();
  });
}

function fleetHead_() {
  return JSON.parse(privateValue_('FLEET_HEAD') || 'null');
}

function fleetState_(head) {
  return head ? readJsonFile_(head.file) : {
    vehicles:[], drivers:[], inspections:[], issues:[], handovers:[], settings:{weeklyDay:1}, version:4, audit:[]
  };
}

function fleetDay_(value) {
  const date = typeof value === 'string' ? value.slice(0,10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : '';
}

function fleetId_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

function fleetValidate_(state) {
  if (!state || state.version !== 4 || !state.settings || Array.isArray(state.settings) || typeof state.settings !== 'object') throw Error('Formato de frota inválido.');
  for (const key of FLEET_COLLECTIONS) {
    if (!Array.isArray(state[key])) throw Error('Coleção da frota inválida.');
    const ids = new Set();
    for (const entry of state[key]) {
      if (!fleetId_(entry?.id) || ids.has(entry.id)) throw Error('ID de frota inválido ou duplicado.');
      ids.add(entry.id);
    }
  }
  if (typeof state.settings.qrBase !== 'undefined' &&
      (typeof state.settings.qrBase !== 'string' || state.settings.qrBase.length > 1024 ||
      (state.settings.qrBase && !/^https?:\/\/[^\s@]+$/i.test(state.settings.qrBase)))) throw Error('Endereço QR inválido.');
  if (state.drivers.some(driver => typeof driver.name !== 'string' || !driver.name.trim())) throw Error('Cadastro de condutor inválido.');
  if (state.inspections.some(record => !Array.isArray(record.answers) || record.answers.some(answer => !answer || typeof answer.k !== 'string'))) {
    throw Error('Respostas do checklist inválidas.');
  }
  const vehicles = new Set(state.vehicles.map(v => v.id));
  const drivers = new Set(state.drivers.map(d => d.id));
  for (const vehicle of state.vehicles) {
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(vehicle.plate || '') ||
        typeof vehicle.model !== 'string' || !vehicle.model.trim() ||
        !['Em utilização','Disponível','Indisponível','Aguardando recebimento'].includes(vehicle.status) ||
        (vehicle.driverId && !drivers.has(vehicle.driverId))) throw Error('Cadastro de veículo inválido.');
  }
  if (new Set(state.vehicles.map(v => v.plate)).size !== state.vehicles.length) throw Error('Placa duplicada.');
  for (const key of ['inspections','issues','handovers']) {
    if (state[key].some(record => !vehicles.has(record.vehicleId) || !fleetDay_(record.date))) throw Error('Registro sem veículo ou data válida.');
  }
  const checkValue = (value, depth) => {
    if (depth > 14) throw Error('Estrutura da frota inválida.');
    if (typeof value === 'string' && /^data:/i.test(value) &&
        !/^data:(?:application\/pdf|image\/(?:png|jpeg|gif|webp));base64,[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
      throw Error('Formato de anexo inválido.');
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__','constructor','prototype'].includes(key)) throw Error('Propriedade inválida.');
        checkValue(child, depth + 1);
      }
    }
  };
  checkValue(state, 0);
}

function fleetRows_(state) {
  const plates = new Map(state.vehicles.map(v => [v.id,v.plate]));
  return [
    ...state.vehicles.map(v => ['Veículo',v.id,v.id,v.plate,'Cadastro de veículo','',v.status]),
    ...state.inspections.map(r => ['Checklist',r.id,r.vehicleId,plates.get(r.vehicleId),'Inspeção veicular',fleetDay_(r.date),'Registrada']),
    ...state.issues.map(r => ['Avaria',r.id,r.vehicleId,plates.get(r.vehicleId),'Avaria veicular',fleetDay_(r.date),r.status === 'Resolvida' ? 'Resolvida' : 'Em aberto']),
    ...state.handovers.map(r => ['Devolução',r.id,r.vehicleId,plates.get(r.vehicleId),'Movimentação de veículo',fleetDay_(r.date),r.confirmed ? 'Confirmada' : 'Pendente'])
  ].map(row => row.map(text_));
}

function fleetWriteRows_(sheet, state) {
  const rows = fleetRows_(state);
  const count = Math.max(rows.length,sheet.getLastRow()-1);
  if (!count) return;
  if (count + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),count + 1 - sheet.getMaxRows());
  while (rows.length < count) rows.push(Array(FLEET_HEADERS.length).fill(''));
  sheet.getRange(2,1,count,FLEET_HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();
}

function fleetComplete_(sheet, next, state) {
  fleetWriteRows_(sheet,state);
  setPrivate_('FLEET_HEAD',JSON.stringify(next));
  deletePrivate_('FLEET_PENDING');
  if (next.previous && next.previous !== next.file) {
    try { DriveApp.getFileById(next.previous).setTrashed(true); } catch (_) { /* O acervo atual já foi confirmado. */ }
  }
}

function fleetRequest_(input,user) {
  if (user.role !== 'GESTAO') throw Error('A Frota está disponível para o perfil Gestão nesta implantação.');
  if (input.action === 'fleetLoad') {
    fleetFolder_();
    fleetSheet_();
    const head = fleetHead_();
    return {ok:true,version:head?.version || 0,state:fleetState_(head)};
  }
  return withWriteLock_(() => {
    // Revalida a chave dentro do bloqueio, inclusive após reemissão ou revogação.
    const actor = authenticate_(input);
    if (!actor || actor.role !== 'GESTAO') throw Error('Acesso à Frota revogado.');
    const folder = fleetFolder_(), sheet = fleetSheet_();
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw Error('Versão da frota inválida.');
    fleetValidate_(input.state);
    const serialized = JSON.stringify(input.state);
    if (serialized.length > FLEET_LIMIT) throw Error('O acervo excede o limite de 12 MB desta integração.');
    const hash = hash_(serialized);
    const pending = JSON.parse(privateValue_('FLEET_PENDING') || 'null');
    if (pending) fleetComplete_(sheet,pending,fleetState_(pending));
    const head = fleetHead_(), version = head?.version || 0;
    if (head?.hash === hash) return {ok:true,version,audit:fleetState_(head).audit};
    if (input.revision !== version) return {ok:false,code:'FLEET_CONFLICT',error:'A frota foi atualizada em outra sessão. Recarregue os registros e refaça a alteração.'};

    const current = fleetState_(head);
    const nextState = Object.fromEntries(FLEET_COLLECTIONS.map(key => [key,input.state[key]]));
    nextState.version = 4;
    nextState.settings = {weeklyDay:1,qrBase:input.state.settings.qrBase || ''};
    nextState.audit = (current.audit || []).concat([{
      at:new Date().toISOString(),actor:actor.email,action:'Gravação',entity:'Frota',id:String(version + 1),fields:[]
    }]).slice(-500);
    const blob = Utilities.newBlob(JSON.stringify(nextState),'application/json','frota-' + Utilities.getUuid() + '.json');
    if (blob.getBytes().length > FLEET_LIMIT) throw Error('O acervo excede o limite de 12 MB desta integração.');
    const file = folder.createFile(blob);
    const next = {version:version + 1,hash,file:file.getId(),previous:head?.file || ''};
    setPrivate_('FLEET_PENDING',JSON.stringify(next));
    fleetComplete_(sheet,next,nextState);
    return {ok:true,version:next.version,audit:nextState.audit};
  });
}

return { setup, setupFleet, createOperatorKey, doPost, processQueue };
})();

function prepararInspecoesPOPs() {
  return BdInspecoesPOPs.setup();
}

function prepararFrota() {
  return BdInspecoesPOPs.setupFleet();
}

function criarChaveInspecoesPOPs() {
  return BdInspecoesPOPs.createOperatorKey();
}

function processarFilaInspecoesPOPs() {
  return BdInspecoesPOPs.processQueue();
}

function receberInspecoesPOPs(e) {
  return BdInspecoesPOPs.doPost(e);
}

// Este é o ponto de entrada do aplicativo Web. O projeto deve ter somente um doPost.
function doPost(e) {
  return receberInspecoesPOPs(e);
}
