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
function identityTokens_(value,prefix){return String(value||'').split(/[,;\n]+/).map(x=>normalizeAsset_(x)).filter(x=>x&&!['N/A','NA','NAO IDENTIFICADO','SEM SERIE','SEM PATRIMONIO','-'].includes(x)).map(x=>prefix+x);}
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
    if(model&&maker)matches=rows.filter(x=>{
      if(!sameAssetStation_(x.row,h,r,config)||normalizeAsset_(get(x.row,'Modelo'))!==model||normalizeAsset_(get(x.row,'Fabricante'))!==maker)return false;
      if(candidate.tab==='Ativos'&&normalizeAsset_(get(x.row,'Categoria'))!==normalizeAsset_(candidate.values.Categoria))return false;
      const existingSerial=identityTokens_(get(x.row,'Nº Série'),'S:');
      if(existingSerial.length&&identityTokens_(candidate.serial,'S:').length&&!existingSerial.some(id=>incoming.includes(id)))return false;
      return true;
    });
  }
  if(matches.length>1)throw Error('Mais de um equipamento corresponde à identificação.');
  if(matches.length&&!sameAssetStation_(matches[0].row,h,r,config))throw Error('O equipamento está vinculado a outro POP; movimentação exige conferência.');
  if(matches.length){const oldMaker=normalizeAsset_(get(matches[0].row,'Fabricante')),newMaker=normalizeAsset_(candidate.values.Fabricante);if(oldMaker&&newMaker&&oldMaker!==newMaker)throw Error('Fabricante divergente para a mesma identificação; solicite conferência.');}
  if(matches.length&&candidate.kind!=='Banco de baterias'){
    const oldSerial=identityTokens_(get(matches[0].row,'Nº Série'),'S:'),newSerial=identityTokens_(candidate.serial,'S:');
    if(oldSerial.length&&newSerial.length&&!oldSerial.some(id=>newSerial.includes(id)))throw Error('A série diverge da identificação já cadastrada; confirme a substituição com a gestão.');
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
function writeAssetPatch_(table,rowIndex,patch,warnings){
  const range=table.sheet.getRange(rowIndex,1,1,table.width),formulas=range.getFormulas()[0],rules=range.getDataValidations()[0],before=range.getValues()[0],after=before.slice(),changed=[];
  for(const [header,value] of Object.entries(patch)){
    const col=table.headers.indexOf(header);if(col<0||formulas[col])continue;
    try{const rule=rules[col]||assetFallbackRule_(table.sheet.getName(),header);const accepted=validatedAssetValue_(rule,value,header);if(accepted===undefined)continue;if(JSON.stringify(before[col])===JSON.stringify(accepted))continue;after[col]=accepted;changed.push(col);}
    catch(error){warnings.push(header+': '+error.message);}
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
  const audit=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);if(!audit)throw Error('Histórico de ativos não preparado.');
  const seen=new Set(audit.getLastRow()>1?audit.getRange(2,1,audit.getLastRow()-1,1).getValues().flat():[]),fresh=events.filter(e=>!seen.has(e[0]));
  if(fresh.length){const target=audit.getLastRow()+1;if(target+fresh.length-1>audit.getMaxRows())audit.insertRowsAfter(audit.getMaxRows(),fresh.length+100);audit.getRange(target,1,fresh.length,AUDIT_HEADERS.length).setValues(fresh.map(row=>row.map(v=>v instanceof Date?v:text_(v))));}
  // O resumo nas propriedades tem tamanho limitado; os detalhes integrais ficam no histórico privado.
  result.warnings=result.warnings.slice(0,12).map(x=>x.slice(0,220));return result;
}
function assetIssues_(input,user){
  const owner=recordOwner_(input.inspectionId);if(!owner||(owner!==user.email&&user.role!=='GESTAO'))throw Error('Registro indisponível.');
  const revision=recordRevision_(input.inspectionId),sheet=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);
  const rows=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,AUDIT_HEADERS.length).getValues():[];
  return {ok:true,issues:rows.filter(r=>r[2]===input.inspectionId&&r[6]==='PENDENCIA'&&r[10]===(revision?.assetAuditVersion||revision?.hash)).map(r=>({tab:r[4],detail:r[7]}))};
}
