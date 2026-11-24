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
function commonBattery_(units,key){
  const values=units.map(unit=>String(unit[key]??'').trim()).filter(Boolean);
  return new Set(values.map(normalizeAsset_)).size===1?values[0]:undefined;
}
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
    const label=bank.identificacao||bank.id;
    const incomplete=bank.cadastroCompleto!==true||!units.length||
      units.some(u=>!['mantida','substituida'].includes(r.batteryReview?.[u.id])||u.estado==='Retirada');
    if(incomplete)warnings.push('Banco incompleto, não conferido ou com retirada: '+label);
    const identifiers=units.flatMap(unit=>[...identityTokens_(unit.serie,'S:'),...identityTokens_(unit.patrimonio,'P:')]);
    if(new Set(identifiers).size!==identifiers.length){
      warnings.push('Série ou patrimônio repetido no banco de baterias: '+label);
      continue;
    }
    for(const unit of units){if(['mantida','substituida'].includes(r.batteryReview?.[unit.id]))generic(unit,'Bateria','Bateria');}
    if(incomplete)continue;
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
  destination.clearContent();
  const formulas=source.getFormulasR1C1()[0];
  const calculatedHeader={Retificadores:'Status','Climatização_Voanet':'Próxima Manutenção'}[table.sheet.getName()];
  const calculated=table.headers.indexOf(calculatedHeader);
  if(calculated>=0&&!formulas[calculated]&&target>2){
    const first=Math.max(2,target-10);
    const previous=table.sheet.getRange(first,calculated+1,target-first,1).getFormulasR1C1();
    formulas[calculated]=previous.reverse().find(([formula])=>formula)?.[0]||'';
  }
  // As células sem fórmula ficam vazias e continuam aptas a receber os dados da vistoria.
  for(let start=0;start<formulas.length;start++){
    if(!formulas[start])continue;
    let end=start+1;
    while(formulas[end])end++;
    table.sheet.getRange(target,start+1,1,end-start).setFormulasR1C1([formulas.slice(start,end)]);
    start=end-1;
  }
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
      if(candidate.tab==='Controle_Baterias'&&found?.row[h.indexOf('Descrição')])delete patch.Descrição;
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
