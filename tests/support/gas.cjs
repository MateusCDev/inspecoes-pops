const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const root=path.join(__dirname,'../..');
function harness(){
 const rows=[],files=new Map(),byId=new Map(),cache=new Map();let id=0,failPdf=false,lock=false,propertyReads=0,locksDuringPdf=[];
 const metadata=['ID_Ativo','Codigo_POP','Data_Ultima_Inspecao','ID_Ultima_Inspecao','Versao_Inspecao'];
 const assets={Ativos:[['Local','Categoria','Equipamento','Fabricante','Modelo','Status','Observações','Nº Série','Patrimônio',...metadata]],
 'Climatização_Voanet':[['Estação','Tipo Local','Fabricante','Modelo','BTUs','Tipo','Nº Série','Tipo de Gás','Carga Gás','Data Instalação','Última Manutenção','Próxima Manutenção','Última Medição Corrente','Última Medição Temperatura','Protocolo referencia','Patrimônio',...metadata]],
 Controle_Baterias:[['Estação','Tecnologia','Fabricante','Modelo','Quantidade','Patrimônio','Descrição','Ano Fabricante','Data Instalação','Tempo de Uso (meses)','Tempo em operação (meses)','Última Teste','Próxima Teste','Autonomia (h)','Tensão Nominal (V)','Capacidade (Ah)','Status','Observações','Nº Série',...metadata]],
 Retificadores:[['Estação','Modelo','Fabricante','IP','Módulos','Corrente (A) (TOTAL)','Capacidade Atual (A)','Status','Tensão (V)','UR 01','UR 02','UR 03','UR 04','Consumo (Ah)','Data de Verficação','Proxima Verificação','Observações','Condição dos módulos','Nº Série','Patrimônio',...metadata]]};
 assets.Retificadores[0]=assets.Retificadores[0].filter(h=>h!=='Data_Ultima_Inspecao');
 const fleet=[['Tipo de registro','ID do registro','ID do veículo','Placa','Descrição','Data','Status']];
 const accessAudit=[['Momento','Gestor','Operador','Acao']];
 const audit=[['ID_Evento','Momento','ID_Inspecao','Codigo_POP','Aba','ID_Ativo','Acao','Detalhe','Antes_JSON','Depois_JSON','Versao_Processamento']];
 const validation={};
 function table(data,name='Inspecoes_POPs'){
  const width=()=>Math.max(1,data[0]?.length||1);
  const sheet={getLastColumn:width,getMaxColumns:()=>500,getLastRow:()=>data.length,getMaxRows:()=>1000,getName:()=>name,setFrozenRows(){},setColumnWidths(){},insertRowsAfter(){},insertRowsBefore(row,count){data.splice(row-1,0,...Array.from({length:count},()=>Array(width()).fill('')));if(validation[name])validation[name].splice(row-1,0,...Array.from({length:count},()=>[]));},
  getRange(row,col,n=1,w=1){if(typeof row==='string'){const match=row.match(/^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/);const number=s=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);col=number(match[1]);n=Number(match[4])-Number(match[2])+1;w=number(match[3])-col+1;row=Number(match[2]);}const range={_row:row,_col:col,_sheet:sheet,
   getValue(){return this.getValues()[0][0]},setValue(value){return this.setValues([[value]])},
   setValues(values){values.forEach((line,i)=>{data[row-1+i]||=[];line.forEach((v,j)=>data[row-1+i][col-1+j]=v)});return this},
   getValues(){return Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>data[row-1+i]?.[col-1+j]??''))},
   getDisplayValues(){return this.getValues().map(r=>r.map(String))},
   getFormulas(){return this.getValues().map(r=>r.map(v=>typeof v==='string'&&v.startsWith('=')?v:''))},getFormulasR1C1(){return this.getFormulas()},setFormulasR1C1(values){return this.setValues(values)},
   getDataValidations(){return Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>validation[name]?.[row-1+i]?.[col-1+j]||null))},
   clearContent(){return this.setValues(Array.from({length:n},()=>Array(w).fill('')))},
   copyTo(destination,type){if(type==='VALIDATION'){validation[name]||=[];validation[name][destination._row-1]=this.getDataValidations()[0].slice();}return this},
   setNumberFormat(){return this},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this},createFilter(){},
   createTextFinder(value){return {matchEntireCell(){return this},findAll(){return data.flatMap((r,i)=>i>=row-1&&i<row-1+n&&r[col-1]===value?[{getRow:()=>i+1}]:[])}}}
  };return range;}};return sheet;
 }
 const access=[['email','perfil','ativo','emitir_chave'],['tecnico@voanet.com.br','OPERACAO',true,false],['outro@voanet.com.br','OPERACAO',true,false],['gestor@voanet.com.br','GESTAO',true,false]];
 const stations=[['Código','Nome da Estação','','Cidade','','','','','Criticidade',''],['TEST-HIGH','POP fictício','','Teste','','','','','ALTA',''],['TEST-MED','POP médio','','Teste','','','','','MEDIA',''],['PCAM.021','POP Cordebras','','Teste','','','','','MEDIA',''],['PCAM.021','POP 46 Base Nova','','Teste','','','','','MEDIA','']];
 const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
 const props={FLEET_FOLDER_ID:'dossier',UPLOAD_SECRET:'test-secret',TOKEN_HASHES:JSON.stringify(Object.fromEntries([['valid','tecnico@voanet.com.br'],['other','outro@voanet.com.br'],['manager','gestor@voanet.com.br']].map(([token,email])=>[digest(token),{email}])))};
 function blob(data,mime='text/plain',name='blob'){const buffer=Buffer.isBuffer(data)?data:Array.isArray(data)?Buffer.from(data):Buffer.from(String(data));return {getBytes:()=>[...buffer],getDataAsString:()=>buffer.toString(),getContentType:()=>mime,getName:()=>name,_data:buffer};}
 function makeFile(name,data='PDF'){const fileId=String(++id),value=data?._data?data:blob(data);const f={getId:()=>fileId,getName:()=>name,getSize:()=>value.getBytes().length,getBlob:()=>value,getUrl:()=>`https://drive.google.com/file/d/${fileId}/view`,setTrashed:()=>files.delete(name)};files.set(name,f);byId.set(fileId,f);return f}
 const c=vm.createContext({console,Date,Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},getUuid:()=>crypto.randomUUID(),computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],computeHmacSha256Signature:(s,key)=>[...crypto.createHmac('sha256',key).update(s).digest()],base64Encode:bytes=>Buffer.from(bytes).toString('base64'),base64Decode:s=>[...Buffer.from(s,'base64')],newBlob:blob,formatDate:d=>d.toISOString().slice(0,10)},
 PropertiesService:{getScriptProperties:()=>({getProperties:()=>{propertyReads++;return {...props}},getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})},
 ContentService:{MimeType:{JSON:1},createTextOutput:text=>({text,setMimeType(){return this}})},
 SpreadsheetApp:{CopyPasteType:{PASTE_FORMAT:'FORMAT',PASTE_DATA_VALIDATION:'VALIDATION'},openById:()=>({getSheetByName:name=>name==='Acessos_Inspecoes_POPs'?table(access,name):name==='POPs'?table(stations,name):name==='Frota'?table(fleet,name):name==='Historico_Ativos_POPs'?table(audit,name):name==='Historico_Acessos_POPs'?table(accessAudit,name):name==='FONTES'?table([['Tipo Local','','','Tecnologia'],['POP','','','ION DE SODIO'],['LOJA','','','AGM'],['','','','CHUMBO-ÁCIDO (VRLA)'],['','','','LÍTIO (LiFePO4)'],['','','','GEL']],name):assets[name]?table(assets[name],name):table(rows,name)}),flush(){}},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
 LockService:{getScriptLock:()=>({tryLock:()=>{if(lock)return false;lock=true;return true},hasLock:()=>lock,releaseLock:()=>{lock=false}})},
 DriveApp:{Access:{PRIVATE:1},getFileById:key=>byId.get(key)||({getSharingAccess:()=>1}),getFolderById:()=>({getSharingAccess:()=>1,getFilesByName:name=>({hasNext:()=>files.has(name),next:()=>files.get(name)}),createFile(name,data){if(name?._data)return makeFile(name.getName(),name);return makeFile(name,data)}})},MimeType:{PLAIN_TEXT:1}});
 vm.runInContext(['schema.gs','Code.gs','report.gs','access.gs','scheduling.gs','runtime.gs','staging.gs','jobs.gs','dashboard.gs','assets.gs','access-admin.gs','fleet.gs'].map(f=>fs.readFileSync(root+'/apps-script/'+f,'utf8')).join('\n'),c);
 c.createPdf_=(_r,_folder,name)=>{locksDuringPdf.push(lock);if(failPdf)throw Error('falha PDF');return makeFile(name+'.pdf')};
 const request=(data,token='valid')=>JSON.parse(c.doPost({postData:{contents:JSON.stringify({version:1,...data,token})}}).text);
 const send=(record,token='valid')=>request({record},token);
 const record=()=>({id:'INSP-TEST-01',codigoPop:'TEST-HIGH',nome:'POP fictício',inspetor:'Teste',data:'2026-11-16',created:'2026-11-16T10:00:00Z',updated:'2026-11-16T11:00:00Z',finalizedAt:'2026-11-16T11:00:00Z',checks:{'EL-01':{status:'C'}},photos:[],photoFiles:[],issues:[],inventory:[]});
 function asset(tab,values){const row=assets[tab][0].map(h=>values[h]??'');assets[tab].push(row);return row;}
 function rule(tab,row,column,allowed){validation[tab]||=[];validation[tab][row-1]||=[];validation[tab][row-1][assets[tab][0].indexOf(column)]={getCriteriaType:()=> 'VALUE_IN_LIST',getCriteriaValues:()=>[allowed]};}
 return {c,rows,fleet,files,send,request,record,access,props,digest,stations,assets,audit,accessAudit,asset,rule,locksDuringPdf,propertyReads:()=>propertyReads,setFailPdf:()=>failPdf=true,clearFailPdf:()=>failPdf=false};
}
module.exports={harness};
