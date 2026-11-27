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
function identityTokens_(value,prefix){return String(value||'').split(/[,;\n]+/).map(x=>normalizeAsset_(x)).filter(x=>x&&!x.startsWith('#')&&!/^(?:N[/.]?A[.]?|NAO (?:IDENTIFICAD[OA]|VERIFICAD[OA]|INFORMAD[OA]|SE APLICA)|SEM (?:NUMERO (?:DE )?|N[º°.] (?:DE )?)?(?:SERIE|PATRIMONIO)|[-–—]+)$/.test(x)).map(x=>prefix+x);}
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
function classifiedTransceivers_(record){
  const oltIds=new Set((record.inventory||[]).filter(item=>/^OLT\b/.test(normalizeAsset_(item.tipo))).map(item=>item.id));
  return (record.invTransceivers||[]).map(item=>{
    const gponPort=/^GPON\s+\d+\/\d+\/\d+$/.test(normalizeAsset_(item.porta));
    return normalizeAsset_(item.tipo)==='OUTRO'&&gponPort&&oltIds.has(item.equipamentoId)
      ? {...item,tipo:'GPON'} : item;
  });
}
function assetCandidates_(r){
  const candidates=[],warnings=[];
  const climateSkipped=r.inventoryReview?.climatizadores==='fora_escopo';
  const push=(tab,item,values,kind)=>candidates.push({tab,item,values,kind,serial:item.serie||item.serial||'',patr:item.patrimonio||'',ref:item.centralId||'',label:item.modelo||item.identificacao||kind});
  const generic=(item,kind,equipment,values={})=>push('Ativos',item,{'Local':r.nome,'Categoria':kind,'Equipamento':equipment,'Fabricante':item.fabricante||item.marca,'Modelo':item.modelo,'Status':assetState_(item.estado),'Observações':item.observacao||item.observacoes,...values},kind);
  for(const item of r.inventory||[]){
    if(climateSkipped&&/^AR[- ]CONDICIONADO$/.test(normalizeAsset_(item.tipo)))continue;
    if(!reviewed_(r,'equipamentos')&&item.confirmacao!=='Confirmado na etiqueta'){warnings.push('Equipamento não conferido: '+(item.modelo||item.id));continue;}
    if(Number(item.quantidade||1)!==1){warnings.push('Equipamento agregado deve ser identificado por unidade: '+(item.modelo||item.id));continue;}
    const types={RETIFICADORA:'Retificadora',BATERIA:'Bateria','AR-CONDICIONADO':'Ar-condicionado',GERADOR:'Gerador',NOBREAK:'Nobreak',INVERSOR:'Inversor',TRANSMISSAO:'Transmissão',OLT:'OLT',ROTEADOR:'Roteador',SWITCH:'Switch',SEGURANCA:'Segurança'};
    generic(item,types[normalizeAsset_(item.tipo)]||'Outro',item.tipo||'Equipamento');
  }
  for(const item of r.equipamentos?.climatizadores||[]){
    if(climateSkipped)continue;
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
  for(const item of classifiedTransceivers_(r)){
    if(!reviewed_(r,'transceivers')){
      warnings.push('Transceiver não conferido: '+(item.serie||item.id));
      continue;
    }
    const condition=String(item.estado??'').trim();
    const observation=condition&&!assetState_(condition)?'Situação na vistoria: '+condition+'.':undefined;
    generic(item,'Transmissão','Transceiver '+(item.tipo||''),{'Observações':item.observacao||item.observacoes||observation});
  }
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
  return {sheet,headers:values[0],index:headerMap_(values[0]),values,width};
}
function sameAssetStation_(row,headers,r,config,idx){
  const code=row[idx?idx['Codigo_POP']:headers.indexOf('Codigo_POP')];if(code)return String(code).trim()===String(r.codigoPop);
  return stationAssetKey_(row[idx?idx[config.station]:headers.indexOf(config.station)])===stationAssetKey_(r.nome);
}
function findAssetRow_(table,candidate,r){
  const h=table.headers,idx=table.index||headerMap_(h),config=ASSET_TABS[candidate.tab],get=(row,k)=>row[idx[k]];
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
      const similar=rows.filter(x=>sameAssetStation_(x.row,h,r,config,idx)&&normalizeAsset_(get(x.row,'Modelo'))===model
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
  if(matches.length&&!sameAssetStation_(matches[0].row,h,r,config,idx))throw Error('O equipamento está vinculado a outro POP; movimentação exige conferência.');
  if(matches.length){const oldMaker=normalizeAsset_(get(matches[0].row,'Fabricante')),newMaker=normalizeAsset_(candidate.values.Fabricante);if(oldMaker&&newMaker&&oldMaker!==newMaker)throw Error('Fabricante divergente para a mesma identificação; solicite conferência.');}
  if(matches.length&&/^Transceiver\b/.test(candidate.values.Equipamento||'')){
    const modelKey=value=>normalizeAsset_(value).replace(/[^A-Z0-9]/g,'');
    const oldModel=modelKey(get(matches[0].row,'Modelo')),model=modelKey(candidate.values.Modelo);
    if(oldModel&&model&&oldModel!==model)throw Error('Modelo divergente para a mesma identificação; confira a etiqueta.');
  }
  if(matches.length&&candidate.kind!=='Banco de baterias'){
    const oldSerial=identityTokens_(get(matches[0].row,'Nº Série'),'S:'),newSerial=identityTokens_(candidate.serial,'S:');
    const samePatr=overlappingAssetIds_(identityTokens_(get(matches[0].row,'Patrimônio'),'P:'),identityTokens_(candidate.patr,'P:'));
    if(oldSerial.length&&newSerial.length&&!overlappingAssetIds_(oldSerial,newSerial)&&!(samePatr&&paddedSerialMatch_(oldSerial,newSerial)))throw Error('A série diverge da identificação já cadastrada; confirme a substituição com a gestão.');
  }
  if(!matches.length&&!incoming.length)throw Error('Informe número de série ou patrimônio antes de criar o ativo.');
  return matches[0]||null;
}
function validatedAssetValue_(rule,value,header){
  if(value===undefined||value===null||(typeof value==='string'&&!value.trim()))return undefined;
  if(value?._invalidDate)throw Error('Data inválida: '+value._invalidDate);
  if(typeof value==='string'&&['NAO VERIFICADO','NAO IDENTIFICADO'].includes(normalizeAsset_(value)))return undefined;
  if(['Nº Série','Patrimônio'].includes(header)&&!identityTokens_(value,'').length)return undefined;
  if(['BTUs','Carga Gás','Última Medição Corrente','Última Medição Temperatura','Módulos','Corrente (A) (TOTAL)','Tensão (V)','Quantidade','Autonomia (h)','Tensão Nominal (V)','Capacidade (Ah)'].includes(header)){
    const raw=String(value).trim();
    const climateMeasurement=['Última Medição Corrente','Última Medição Temperatura'].includes(header);
    if(climateMeasurement&&/^(?:[-–—]+|N[/.]?A[.]?|S[/.]?M[.]?|NAO (?:SE APLICA|MEDID[OA]|AFERID[OA]|REALIZAD[OA]|INFORMAD[OA])|(?:SEM|NAO HOUVE) MEDICAO|MEDICAO NAO REALIZADA)$/.test(normalizeAsset_(raw)))return undefined;
    const gasUnit=header==='Carga Gás'?raw.match(/\s*(kg|g)$/i):null;
    const unit=header==='Última Medição Temperatura'?/\s*[°º]?\s*C$/i:/\s*(BTU\/h|BTUs?|Ah|A|V|h)$/i;
    const normalized=(gasUnit?raw.slice(0,gasUnit.index):raw.replace(unit,'')).trim().replace(',','.');
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
  const idx=table.index||headerMap_(table.headers);
  const range=table.sheet.getRange(rowIndex,1,1,table.width),formulas=range.getFormulas()[0],rules=range.getDataValidations()[0],before=range.getValues()[0],after=before.slice(),changed=[];
  for(const [header,value] of Object.entries(patch)){
    const col=idx[header];
    if(col===undefined)continue;
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
    const col=idx[header];
    if(col!==undefined&&changed.includes(col)&&typeof after[col]==='string')table.sheet.getRange(rowIndex,col+1).setNumberFormat('@');
  }
  changed.sort((a,b)=>a-b);
  for(let i=0;i<changed.length;){let j=i;while(j+1<changed.length&&changed[j+1]===changed[j]+1)j++;table.sheet.getRange(rowIndex,changed[i]+1,1,changed[j]-changed[i]+1).setValues([after.slice(changed[i],changed[j]+1)]);i=j+1;}
  for(const header of ['Data_Ultima_Inspecao','Data de Verficação','Proxima Verificação']){const col=idx[header];if(col!==undefined&&changed.includes(col))table.sheet.getRange(rowIndex,col+1).setNumberFormat('dd/MM/yyyy');}
  table.values[rowIndex-1]=after;return {changed:changed.length,before,after};
}
function assetFallbackRule_(tab,header){
  const cache=context_().fallbackRules,key=tab+'|'+header;
  if(Object.prototype.hasOwnProperty.call(cache,key))return cache[key];
  // Tabelas nativas podem expor a validação somente na propriedade da coluna.
  const lists={
    Ativos:{Categoria:['Retificadora','Bateria','Ar-condicionado','Gerador','Nobreak','Inversor','Transmissão','OLT','Roteador','Segurança','Outro','Inversor de Potência','Switch'],Status:['Operacional','Atenção','Crítico','Inativo']},
    Retificadores:{Fabricante:['XPS','Huawei','Emerson','Apr48','Volt']}
  };
  let allowed=lists[tab]?.[header];
  if(tab==='Climatização_Voanet'&&header==='Tipo Local')allowed=book_(config_().SPREADSHEET_ID).getSheetByName('FONTES').getRange('A2:A3').getDisplayValues().flat();
  if(tab==='Controle_Baterias'&&header==='Tecnologia')allowed=book_(config_().SPREADSHEET_ID).getSheetByName('FONTES').getRange('D2:D6').getDisplayValues().flat();
  cache[key]=allowed?{getCriteriaType:()=> 'VALUE_IN_LIST',getCriteriaValues:()=>[allowed]}:null;
  return cache[key];
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
  const corrections=recordRevision_(r.id)?assetAuditRows_(r.id):[];
  const {candidates,warnings}=assetCandidatesWithAdjustments_(r,corrections),result={created:0,updated:0,unchanged:0,pending:0,warnings:[]},events=[],tables={};
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
      const previousNote=found?.row[h.indexOf('Observações')];
      if(previousNote&&/^Transceiver /.test(candidate.values.Equipamento||'')&&!candidate.item.observacao&&!candidate.item.observacoes
        &&!/^Situação na vistoria: [^.]+\.$/.test(previousNote))delete patch.Observações;
      const written=writeAssetPatch_(table,row,patch,fieldWarnings);
      const action=!found?'CRIADO':written.changed?'ATUALIZADO':'SEM_ALTERACAO';
      if(!found)result.created++;else if(written.changed)result.updated++;else result.unchanged++;
      if(action!=='SEM_ALTERACAO')log(candidate.tab,id,action,candidate.label,written.before,written.after);
      for(const warning of fieldWarnings){
        const detail=candidate.tab+' · '+candidate.label+': '+warning;
        result.pending++;result.warnings.push(detail);log(candidate.tab,id,'PENDENCIA',detail,{candidate:candidate.key});
      }
    }catch(error){const detail=candidate.tab+' · '+candidate.label+': '+error.message;result.pending++;result.warnings.push(detail);log(candidate.tab,candidate.ref,'PENDENCIA',detail,{candidate:candidate.key});}
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
function assetAuditRows_(id){
  const sheet=book_(config_().ACCESS_SPREADSHEET_ID).getSheetByName(ASSET_AUDIT);
  return sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,AUDIT_HEADERS.length).getValues().filter(row=>row[2]===id):[];
}
function openAssetIssues_(id,revision,rows=assetAuditRows_(id)){
  const current=rows.filter(r=>r[10]===(revision?.assetAuditVersion||revision?.hash));
  const closed=new Set(current.filter(r=>['VINCULADO','SUBSTITUIDO','AJUSTE_PENDENCIA'].includes(r[6])).map(r=>r[7].split('|')[0]));
  return current.filter(r=>r[6]==='PENDENCIA'&&!closed.has(r[0]));
}

function assetIssueCandidateKey_(issue){
  try{return JSON.parse(issue[8]).candidate;}catch(_){return undefined;}
}
function assetCandidatesWithAdjustments_(record,rows=assetAuditRows_(record.id)){
  const result=assetCandidates_(record);
  for(const candidate of result.candidates)candidate.key=assetCandidateKey_(candidate);
  const indexed=new Map(result.candidates.map(candidate=>[candidate.key,candidate]));
  for(const row of rows){
    if(row[6]!=='AJUSTE_PENDENCIA')continue;
    const adjustment=JSON.parse(row[9]);
    if(adjustment.updated!==record.updated)continue;
    const candidate=indexed.get(adjustment.candidate);
    if(!candidate)continue;
    if(adjustment.fields){
      Object.assign(candidate.values,adjustment.fields);
      if(adjustment.fields['Data Instalação'])candidate.values['Data Instalação']=assetDate_(adjustment.fields['Data Instalação']);
    }
    if(adjustment.identity)Object.assign(candidate,adjustment.identity);
  }
  return result;
}

const CLIMATE_ADJUSTMENTS={
  'Última Medição Temperatura':{field:'Temperatura medida (°C)',optional:true},
  'Última Medição Corrente':{field:'Corrente medida (A)',optional:true},
  'Carga Gás':{field:'Carga de gás (g ou kg)'},
  'Data Instalação':{field:'Data de instalação (DD/MM/AAAA)'}
};
function assetPendingAdjustment_(issue,record,revision,candidates,tables){
  const tab=issue[4],detail=issue[7];
  const field=tab==='Climatização_Voanet'&&Object.keys(CLIMATE_ADJUSTMENTS).find(key=>
    detail.startsWith(key+': ')||detail.includes(': '+key+': '));
  const identity=tab==='Ativos'&&/mais de um equipamento|informe número de série ou patrimônio|a série diverge/i.test(detail);
  if(!field&&!identity)return null;
  const recordedKey=assetIssueCandidateKey_(issue);
  let matching=candidates.filter(candidate=>candidate.tab===tab&&(recordedKey
    ? candidate.key===recordedKey
    : detail.startsWith(tab+' · '+candidate.label+': ')||Boolean(field&&detail.startsWith(field+': '))));
  if(!recordedKey&&matching.length>1&&identity){
    const table=tables[tab]||(tables[tab]=assetTable_(tab));
    matching=matching.filter(candidate=>{
      try{findAssetRow_(table,candidate,record);}
      catch(error){return detail===tab+' · '+candidate.label+': '+error.message;}
      return false;
    });
  }
  if(matching.length!==1)return null;
  const candidate=matching[0];
  const token=hash_(JSON.stringify([record.id,revision.assetAuditVersion||revision.hash,issue[0],candidate.key,field||'identity']));
  const raw=field?candidate.values[field]:null;
  const form=field
    ? {...CLIMATE_ADJUSTMENTS[field],value:raw instanceof Date?dateKey_(raw):raw?._invalidDate??raw??'',type:'value'}
    : {type:'identity',serial:candidate.serial,patr:candidate.patr};
  return {candidate,field,form:{...form,token,asset:candidate.label}};
}
function assetIssues_(input,user){
  const id=input.inspectionId,owner=recordOwner_(id);
  if(!owner||(owner!==user.email&&user.role!=='GESTAO'))throw Error('Registro indisponível.');
  const revision=recordRevision_(id),rows=assetAuditRows_(id),issues=openAssetIssues_(id,revision,rows);
  const record=user.role==='GESTAO'&&revision?.payloadId&&issues.length?readJsonFile_(revision.payloadId):null;
  const candidates=record?assetCandidatesWithAdjustments_(record,rows).candidates:[];
  const tables={};
  return {ok:true,issues:issues.map(row=>({tab:row[4],detail:row[7],
    adjustment:record?assetPendingAdjustment_(row,record,revision,candidates,tables)?.form:undefined}))};
}

function applyAssetAdjustment_(input,user){
  if(user.role!=='GESTAO')throw Error('Ajuste disponível para a Gestão.');
  const id=input.inspectionId,token=input.adjustmentToken,reason=String(input.reason??'').trim();
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||'')||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Abra a pendência novamente.');
  if(reason.length<5||reason.length>300)throw Error('Informe o motivo do ajuste (5 a 300 caracteres).');
  return withWriteLock_(()=>{
    const revision=recordRevision_(id);
    if(!revision?.payloadId||!recordOwner_(id))throw Error('Inspeção indisponível.');
    if(privateValue_(jobKey_(id)))throw Error('Aguarde o processamento da inspeção e abra a pendência novamente.');
    const rows=assetAuditRows_(id),issues=openAssetIssues_(id,revision,rows),eventId=hash_(token+'|AJUSTE_PENDENCIA');
    if(rows.some(row=>row[0]===eventId)){
      if(revision.assets?.pending!==issues.length){
        revision.assets={...revision.assets,pending:issues.length};
        setPrivate_('REVISION_'+hash_(id),JSON.stringify(revision));
        setPrivate_('DATA_VERSION',Utilities.getUuid());
      }
      return {ok:true,pending:issues.length};
    }
    const record=readJsonFile_(revision.payloadId),tables={};
    const {candidates}=assetCandidatesWithAdjustments_(record,rows);
    const issue=issues.find(entry=>assetPendingAdjustment_(entry,record,revision,candidates,tables)?.form.token===token);
    if(!issue)throw Error('A pendência mudou. Abra a lista novamente.');
    const {candidate,field,form}=assetPendingAdjustment_(issue,record,revision,candidates,tables);
    const adjustment={updated:record.updated,candidate:candidate.key};
    let patch={};
    const omitted=input.notMeasured===true;
    if(omitted){
      if(!form.optional)throw Error('Essa pendência requer um valor conferido.');
      adjustment.fields={[field]:null};
    }else if(field){
      const value=String(input.value??'').trim();
      if(!value||value.length>60)throw Error('Informe um valor válido para '+form.field+'.');
      const accepted=validatedAssetValue_(null,field==='Data Instalação'?assetDate_(value):value,field);
      if(accepted===undefined)throw Error('Informe um valor conferido ou selecione Medição não realizada.');
      adjustment.fields={[field]:value};
      patch={[field]:accepted};
    }else{
      const serial=String(input.serial??'').trim(),patr=String(input.patr??'').trim();
      const identifiers=[...identityTokens_(serial,'S:'),...identityTokens_(patr,'P:')];
      if(!identifiers.length||[serial,patr].some(value=>value.length>80||/[,;\r\n]/.test(value))){
        throw Error('Informe uma única série ou patrimônio da etiqueta do equipamento.');
      }
      adjustment.identity={serial,patr,ref:''};
      patch={'Nº Série':serial,'Patrimônio':patr};
    }

    let rowChange;
    if(!omitted){
      const table=tables[candidate.tab]||(tables[candidate.tab]=assetTable_(candidate.tab));
      const corrected={...candidate,...adjustment.identity};
      const found=findAssetRow_(table,corrected,record);
      if(!found)throw Error('O ajuste precisa identificar um equipamento já cadastrado. Para criar um ativo, corrija a inspeção original.');
      const match=comparisonAsset_(corrected,table,found,record);
      const get=header=>found.row[table.headers.indexOf(header)];
      const config=ASSET_TABS[candidate.tab],date=dateKey_(get(config.date||'Data_Ultima_Inspecao'));
      if(date>record.data||(date===record.data&&String(get('Versao_Inspecao')||'')>record.updated)){
        throw Error('O cadastro foi atualizado por uma vistoria mais recente.');
      }
      if(!field&&(!match?.sameStation||(!match.sameSerial&&!match.samePatr)||!match.sameModel||!match.sameCategory||match.patrDiff)){
        throw Error('A série ou patrimônio precisa identificar uma única unidade do mesmo modelo e POP. Abra a comparação para conferir.');
      }
      for(const header of Object.keys(patch)){
        const col=table.headers.indexOf(header);
        if(col<0||table.sheet.getRange(found.index,col+1).getFormulas()[0][0])throw Error(header+': confira a coluna ou fórmula na planilha.');
      }
      rowChange=writeAssetPatch_(table,found.index,patch,[],true);
    }
    const before={value:form.value,serial:form.serial,patr:form.patr,central:rowChange?.before};
    const after={...adjustment,central:rowChange?.after};
    appendAssetEvents_([[eventId,new Date(),id,record.codigoPop,candidate.tab,issue[5],
      'AJUSTE_PENDENCIA',issue[0]+'|'+user.email+'|'+reason,JSON.stringify(before),JSON.stringify(after),revision.assetAuditVersion||revision.hash]]);
    const pending=issues.length-1;
    revision.assets={...revision.assets,pending};
    setPrivate_('REVISION_'+hash_(id),JSON.stringify(revision));
    setPrivate_('DATA_VERSION',Utilities.getUuid());
    SpreadsheetApp.flush();
    return {ok:true,pending};
  });
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
    ['Transceivers',classifiedTransceivers_(record)],
    ['Climatização',record.equipamentos?.climatizadores],
    ['Retificadores',record.equipamentos?.retificadoras],
    ['DIOs',record.equipamentos?.dios],
    ['Bancos de baterias',banks],
    ['Baterias',banks.flatMap(bank=>bank.baterias||[])]
  ].filter(([,items])=>Array.isArray(items)&&items.length).map(([label,items])=>({
    label,items:items.map(item=>({
      name:String(label==='Transceivers'&&item.tipo==='GPON'&&item.modelo
        ? item.modelo+' · GPON' : item.modelo||item.identificacao||item.tipo||'Sem identificação').slice(0,130),
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

function stationTransceivers_(input,user){
  if(!['GESTAO','OPERACAO'].includes(user.role))throw Error('Consulta indisponível para este perfil.');
  const code=String(input.stationCode??'').trim();
  const station=stations_().find(item=>item.code===code&&!item.inactive&&!item.duplicate);
  if(!station)throw Error('Selecione um POP ativo do cadastro.');
  const table=assetTable_('Ativos');
  // Valores exibidos preservam zeros à esquerda dos identificadores legados.
  const rows=table.sheet.getRange(1,1,table.values.length,table.width).getDisplayValues();
  const fields=['Fabricante','Modelo','Nº Série','Patrimônio','Equipamento'];
  const columns=fields.map(field=>table.headers.indexOf(field));
  const result=[];
  for(const row of rows.slice(1)){
    if(!sameAssetStation_(row,table.headers,{codigoPop:code,nome:station.name},ASSET_TABS.Ativos))continue;
    const [fabricante,modelo,serie,patrimonio,equipamento]=columns.map(col=>String(row[col]||'').trim());
    const type=normalizeAsset_(equipamento);
    if(!/^TRANSCEIVER\b/.test(type)||(!modelo&&!serie&&!patrimonio))continue;
    const tipo=/ELETRIC|RJ[ -]?45/.test(type)?'Elétrico (RJ45)':(type.match(/\b(GPON|QSFP28|QSFP\+|SFP\+|SFP|OUTRO)(?=\s|$)/)?.[1]||'');
    result.push({fabricante,modelo,tipo:tipo==='OUTRO'?'Outro':tipo,serie:identityTokens_(serie,'S:').length?serie:'',
      patrimonio:identityTokens_(patrimonio,'P:').length?patrimonio:''});
  }
  return {ok:true,stationCode:code,items:result.sort((a,b)=>a.modelo.localeCompare(b.modelo))};
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
        serial:get('Nº Série'),asset:get('Patrimônio'),status:get('Status'),observation:get('Observações')};
    });
    return {label:tab,items};
  }).filter(group=>group.items.length);
  return {ok:true,groups};
}

function assetCandidateKey_(candidate){
  return JSON.stringify([candidate.tab,candidate.label,candidate.item?.id,candidate.serial,candidate.patr]);
}
function similarAssetModel_(left,right){
  if(Math.min(left.length,right.length)<6||Math.abs(left.length-right.length)>1||left===right)return false;
  if(left.length>right.length)[left,right]=[right,left];
  let i=0,j=0,edited=false;
  while(i<left.length&&j<right.length){
    if(left[i]!==right[j]){
      if(edited)return false;
      edited=true;
      if(left.length<right.length){j++;continue;}
    }
    i++;j++;
  }
  return true;
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
  const sameModel=Boolean(model&&model===oldModel);
  const makerDiff=Boolean(maker&&oldMaker&&maker!==oldMaker);
  const sameCategory=candidate.tab!=='Ativos'||normalizeAsset_(candidate.values.Categoria)===normalizeAsset_(get('Categoria'));
  const similarModel=sameStation&&sameCategory&&!sameModel&&similarAssetModel_(model,oldModel);
  const bankLabel=candidate.tab==='Controle_Baterias'&&candidate.label&&normalizeAsset_(candidate.label)===normalizeAsset_(get('Descrição'));
  const score=(sameRef?32:0)+(sameSerial?16:0)+(samePatr?8:0)+(sameStation&&(sameModel||bankLabel)?4:0)+(similarModel?2:0);
  if(!score)return null;
  const basis=[sameRef&&'Vínculo anterior',sameRawSerial&&'Série igual',(sameSerial&&!sameRawSerial)&&'Série equivalente com zeros à esquerda',
    samePatr&&'Patrimônio igual',sameModel&&'Modelo igual',similarModel&&'Modelo parecido',bankLabel&&'Banco com a mesma identificação'].filter(Boolean);
  const date=dateKey_(get(config.date||'Data_Ultima_Inspecao'));
  return {entry,score,sameStation,sameModel,sameRef,sameSerial,samePatr,serialDiff,patrDiff,makerDiff,sameCategory,
    newer:date>record.data||(date===record.data&&String(get('Versao_Inspecao')||'')>record.updated),paddedSerial,
    display:{station,model:get('Modelo'),maker:get('Fabricante'),serial:get('Nº Série'),patr:get('Patrimônio'),
      rowNumber:entry.index,equipment:get('Equipamento'),makerDiff,categoryDiff:!sameCategory,
      name:get('Descrição'),quantity:get('Quantidade'),gas:get('Carga Gás'),installed:dateKey_(get('Data Instalação')),basis,serialDiff,patrDiff,
      otherStation:!sameStation}};
}

function assetComparisonData_(id,user){
  if(!/^INSP-[A-Za-z0-9-]+$/.test(id||'')||user.role!=='GESTAO'||!recordOwner_(id))throw Error('Conferência indisponível.');
  const revision=recordRevision_(id);
  if(!revision?.payloadId)throw Error('O inventário arquivado desta inspeção está indisponível.');
  const rows=assetAuditRows_(id),issues=openAssetIssues_(id,revision,rows);
  const record=readJsonFile_(revision.payloadId);
  const {candidates}=assetCandidatesWithAdjustments_(record,rows);
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
    const identity=candidate.key||assetCandidateKey_(candidate);
    const sameLabelCount=candidates.filter(item=>item.tab===candidate.tab&&item.label===candidate.label).length;
    const related=issues.filter(issue=>{
      // Nos envios recentes a pendência identifica a unidade, mesmo quando o modelo se repete.
    const savedIdentity=assetIssueCandidateKey_(issue);
      if(savedIdentity)return issue[4]===candidate.tab&&savedIdentity===identity;
      if(sameLabelCount>1&&issue[4]===candidate.tab&&issue[7].startsWith(prefix)){
        const table=tables[candidate.tab]||(tables[candidate.tab]=assetTable_(candidate.tab));
        try{findAssetRow_(table,candidate,record);}
        catch(error){return issue[7]===prefix+error.message;}
        return false;
      }
      return issue[4]===candidate.tab
      ? issue[7].startsWith(prefix)||(!issue[7].startsWith(candidate.tab+' · ')&&candidate.tab!=='Ativos')
      : candidate.tab==='Controle_Baterias'&&!issue[4]&&issue[7].endsWith(': '+candidate.label);
    });
    if(!related.length)continue;
    const table=tables[candidate.tab]||(tables[candidate.tab]=assetTable_(candidate.tab));
    const matches=table.values.slice(1).map((row,i)=>comparisonAsset_(candidate,table,{row,index:i+2},record))
      .filter(Boolean).sort((a,b)=>b.score-a.score);
    const identityIssues=related.filter(issue=>issue[7].startsWith(prefix)&&/série diverge|mais de um equipamento|fabricante divergente/i.test(issue[7]));
    const hasSerial=identityTokens_(candidate.serial,'S:').length===1;
    const shown=matches.slice(0,8);
    for(const match of shown){
      const stableIdentity=match.sameRef||match.sameSerial||match.samePatr;
      const elsewhere=matches.some(other=>other!==match&&(other.sameSerial||other.samePatr));
      const uniqueCandidate=sameLabelCount===1;
      const permitted=candidate.tab==='Ativos'&&uniqueCandidate&&identityIssues.length===1&&match.sameStation&&!match.newer&&!elsewhere;
      if(permitted&&stableIdentity&&!match.serialDiff&&!match.patrDiff&&match.sameModel&&match.sameCategory){
        match.operation=match.makerDiff?'keepMaker':'link';
      }
      if(permitted&&!match.makerDiff&&match.sameCategory&&hasSerial&&match.serialDiff&&!match.paddedSerial&&!match.patrDiff&&(match.samePatr||match.sameModel))match.operation='replace';
      if(match.operation){
        match.issue=identityIssues[0];
        match.token=hash_(JSON.stringify([id,revision.hash,match.issue[0],identity,match.entry.row,match.operation]));
      }
    }
    comparisons.push({candidate,table,matches:shown,matchCount:matches.length,related});
  }
  return {record,revision,issues,comparisons};
}

function compareInspectionAssets_(input,user){
  const data=assetComparisonData_(input.inspectionId,user);
  return {ok:true,items:data.comparisons.map(({candidate,matches,matchCount,related})=>({
    tab:candidate.tab,label:candidate.label,station:data.record.nome,equipment:candidate.values.Equipamento,model:candidate.values.Modelo,maker:candidate.values.Fabricante,
    serial:candidate.serial,patr:candidate.patr,quantity:candidate.values.Quantidade,
    gas:candidate.values['Carga Gás'],installed:candidate.values['Data Instalação'] instanceof Date
      ? dateKey_(candidate.values['Data Instalação']) : candidate.values['Data Instalação']?._invalidDate,
    issues:related.map(issue=>issue[7]),matchCount,
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
    if(match.operation==='keepMaker')delete patch.Fabricante;
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
