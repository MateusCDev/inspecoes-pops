const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('trocar de sessão durante a preparação de uma foto não envia dados com a outra chave',async()=>{
 const root=path.join(__dirname,'..');let resolvePhoto;const sent=[];
 const r={id:'INSP-CLIENT-1',finalizedAt:'2026-11-17T12:00:00Z',updated:'2026-11-17T12:00:00Z',photos:[{id:'PH-1',name:'teste'}]};
 const c=vm.createContext({console,Blob,TextEncoder,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},records:[r],view:'resumo',cur:()=>r,saveAll:()=>true,render(){},alert(){},getPhoto:async()=>({blob:new Blob(['foto'])}),fileToDataUrl:()=>new Promise(ok=>resolvePhoto=ok),fetch:async(_url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:false,error:'unexpected'})}}});
 vm.runInContext(fs.readFileSync(root+'/public/google-sync.js','utf8')+'\n'+fs.readFileSync(root+'/public/google-features.js','utf8')+'\ngoogleAccessKey="chave-original";googleUser={email:"a@example.test",role:"OPERACAO"};',c);
 const pending=c.googleSendV2(r);await new Promise(ok=>setImmediate(ok));
 vm.runInContext('googleSession++;googleAccessKey="outra-chave";googleUser={email:"b@example.test",role:"OPERACAO"};',c);resolvePhoto('data:image/jpeg;base64,UERG');
 assert.equal(await pending,false);assert.equal(sent.length,0);
});

test('reenvio acompanha a revisão anterior e não confirma alterações ainda locais',async()=>{
 const root=path.join(__dirname,'..');
 const record={id:'INSP-CLIENT-2',finalizedAt:'2026-11-21T20:11:26Z',updated:'2026-11-23T12:20:00Z',photos:[]};
 const calls=[],alerts=[];
 const prior={ok:true,inspectionId:record.id,hash:'revisao-anterior'};
 let pending=true;
 const c=vm.createContext({
  console,Blob,TextEncoder,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},
  window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},
  records:[record],view:'resumo',cur:()=>record,saveAll:()=>true,render(){},alert:message=>alerts.push(message),
  fetch:async(_url,options)=>{
   const {action}=JSON.parse(options.body);
   calls.push(action);
   return {ok:true,json:async()=>action==='submit'
    ? {ok:false,error:'Envio não concluído: A versão anterior ainda está em processamento. Aguarde sua conclusão.'}
    : pending
     ? {...prior,pending:true}
     : {...prior,pdfUrl:'https://drive.google.com/file/d/teste/view',receivedAt:'2026-11-23T12:21:00Z'}};
  }
 });
 vm.runInContext(fs.readFileSync(root+'/public/google-sync.js','utf8')+'\n'+fs.readFileSync(root+'/public/google-features.js','utf8')+'\ngoogleAccessKey="chave-teste";googleUser={email:"a@example.test",role:"OPERACAO"};',c);
 assert.equal(await c.googleSendV2(record),true);
 assert.deepEqual(calls,['submit','status']);
 assert.equal(record.syncState,'processando');
 assert.equal(record.googleSubmittedVersion,null);
 assert.deepEqual(alerts,[]);

 await c.googleFinalize();
 assert.deepEqual(calls,['submit','status','status']);
 assert.equal(record.finalizedAt,'2026-11-21T20:11:26Z');
 assert.equal(record.updated,'2026-11-23T12:20:00Z');

 pending=false;
 await c.googlePollJobs();
 assert.equal(record.syncState,'pendente');
 assert.match(record.googleProgress,/versão anterior foi concluída/);
});
