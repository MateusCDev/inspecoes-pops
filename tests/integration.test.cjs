const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=require('node:path').join(__dirname,'..');
function harness(){
 const rows=[],files=new Map(); let id=0, failPdf=false, lock=false;
 const table={getMaxColumns:()=>500,getLastRow:()=>rows.length,getMaxRows:()=>1000,getName:()=> 'Inspecoes_POPs',setFrozenRows(){},setColumnWidths(){},
 getRange(row,col,n,width){return {setValues(values){for(let i=0;i<values.length;i++)rows[row-1+i]=values[i];return this},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this},createFilter(){},getValues(){return rows.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+width))},createTextFinder(value){return {matchEntireCell(){return this},findAll(){return rows.flatMap((r,i)=>i && r[0]===value ? [{getRow:()=>i+1}] : [])}}}}}};
 const props={TOKEN_HASHES:JSON.stringify({[crypto.createHash('sha256').update('valid').digest('hex')]:'teste'})};
 const c=vm.createContext({console,Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()]},
 PropertiesService:{getScriptProperties:()=>({getProperties:()=>props})},
 ContentService:{MimeType:{JSON:1},createTextOutput:text=>({text,setMimeType(){return this}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>table}),flush(){}},
 LockService:{getScriptLock:()=>({tryLock:()=>{lock=true;return true},hasLock:()=>lock,releaseLock:()=>{lock=false}})},
 DriveApp:{getFolderById:()=>({getFilesByName:name=>({hasNext:()=>files.has(name),next:()=>files.get(name)}),createFile(name){return makeFile(name)}})},MimeType:{PLAIN_TEXT:1}});
 function makeFile(name){const f={getUrl:()=>`https://drive.google.com/file/d/${++id}/view`,setTrashed:()=>files.delete(name)};files.set(name,f);return f}
 vm.runInContext(fs.readFileSync(root+'/apps-script/schema.gs','utf8')+'\n'+fs.readFileSync(root+'/apps-script/Code.gs','utf8'),c);
 c.createPdf_=(_r,_folder,name)=>{if(failPdf)throw Error('falha PDF');return makeFile(name+'.pdf')};
 const send=(record,token='valid')=>JSON.parse(c.doPost({postData:{contents:JSON.stringify({version:1,token,record})}}).text);
 const record=()=>({id:'INSP-TEST-01',nome:'POP fictício',inspetor:'Teste',data:'2026-11-16',created:'2026-11-16T10:00:00Z',updated:'2026-11-16T11:00:00Z',finalizedAt:'2026-11-16T11:00:00Z',checks:{'EL-01':{status:'C'}},photos:[],photoFiles:[],issues:[],inventory:[]});
 return {c,rows,files,send,record,setFailPdf:()=>failPdf=true};
}
test('rejeita chave antes de criar aba/arquivo',()=>{const h=harness();assert.equal(h.send(h.record(),'invalid').ok,false);assert.equal(h.rows.length,0);assert.equal(h.files.size,0)});
test('grava, repete sem duplicar, atualiza a mesma linha e rejeita versão antiga',()=>{
 const h=harness(),r=h.record();const first=h.send(r);assert.equal(first.ok,true);assert.equal(h.rows.length,2);assert.equal(h.rows[0].length,h.rows[1].length);assert.equal(h.files.size,2);
 const retry=h.send(r);assert.equal(retry.pdfUrl,h.rows[1][h.rows[0].indexOf('pdf_url')]);assert.equal(h.files.size,2);
 r.updated='2026-11-16T12:00:00Z';r.checks['EL-01'].status='NC';assert.equal(h.send(r).ok,true);assert.equal(h.rows.length,2);assert.equal(h.files.size,4);
 r.updated='2026-11-16T10:00:00Z';assert.equal(h.send(r).ok,false);
});
test('não grava linha quando falha PDF',()=>{const h=harness();h.setFailPdf();assert.equal(h.send(h.record()).ok,false);assert.equal(h.rows.length,1);assert.equal(h.files.size,0)});
test('valida campos e presença das fotos; neutraliza fórmulas',()=>{
 const h=harness(),r=h.record();r.photos=[{id:'foto1'}];assert.equal(h.send(r).ok,false);r.photos=[];r.nome='=IMPORTXML("https://example.com")';assert.equal(h.send(r).ok,true);assert.match(h.rows[1][h.rows[0].indexOf('nome')],/^'=/);
 r.id='invalid';assert.equal(h.send(r).ok,false);
});
test('status desconhecidos são separados; denominador usa apenas C e NC',()=>{
 const h=harness(),r=h.record();r.checks['EL-02']={status:'NA'};r.checks['EL-03']={status:'erro'};assert.equal(h.send(r).ok,true);
 const value=k=>h.rows[1][h.rows[0].indexOf(k)];assert.equal(value('itens_conformes'),1);assert.equal(value('itens_nao_conformes'),0);assert.equal(value('itens_status_desconhecido'),1);
 assert.equal(value('total_itens'),value('itens_conformes')+value('itens_nao_conformes')+value('itens_nao_aplicaveis')+value('itens_nao_verificados')+value('itens_status_desconhecido'));
});
function frontend(fetch){
 const r={id:'INSP-T',finalizedAt:'yes',updated:'version1',photos:[]};
 const c=vm.createContext({cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/test/exec'}},window:{addEventListener(){}},document:{addEventListener(){}},records:[r],navigator:{onLine:true},saveAll:()=>true,render(){},alert(){},Blob,fetch,portableRecord:async r=>JSON.parse(JSON.stringify({...r,photoFiles:[]}))});
 vm.runInContext(fs.readFileSync(root+'/public/google-sync.js','utf8')+'\ngoogleAccessKey="valid";',c);return {c,r};
}
test('frontend só confirma depois de retorno válido',async()=>{
 const h=frontend(async()=>({ok:true,json:async()=>({ok:false,error:'negado'})}));assert.equal(await h.c.googleSend(h.r),false);assert.equal(h.r.syncState,'erro');
 const h2=frontend(async()=>({ok:true,json:async()=>({ok:true,inspectionId:'OUTRO',pdfUrl:'https://drive.google.com/file/d/1'})}));assert.equal(await h2.c.googleSend(h2.r),false);
});
test('edição durante envio permanece pendente',async()=>{
 let complete;const h=frontend(()=>new Promise(ok=>complete=ok));const pending=h.c.googleSend(h.r);await new Promise(ok=>setImmediate(ok));h.r.updated='version2';complete({ok:true,json:async()=>({ok:true,inspectionId:h.r.id,pdfUrl:'https://drive.google.com/file/d/test',receivedAt:'now'})});assert.equal(await pending,true);assert.equal(h.r.syncState,'pendente');
});
