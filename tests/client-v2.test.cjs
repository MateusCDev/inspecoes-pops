const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const clientScripts=['inspection-photos.js','google-sync.js','google-features.js']
 .map(file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8')).join('\n');
test('trocar de sessão durante a preparação de uma foto não envia dados com a outra chave',async()=>{
 let resolvePhoto;const sent=[];
 const r={id:'INSP-CLIENT-1',finalizedAt:'2026-11-17T12:00:00Z',updated:'2026-11-17T12:00:00Z',photos:[{id:'PH-1',name:'teste'}]};
 const c=vm.createContext({console,Blob,TextEncoder,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},records:[r],view:'resumo',cur:()=>r,saveAll:()=>true,render(){},alert(){},getPhoto:async()=>({blob:new Blob(['foto'],{type:'image/jpeg'})}),fileToDataUrl:()=>new Promise(ok=>resolvePhoto=ok),fetch:async(_url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:false,error:'unexpected'})}}});
 vm.runInContext(clientScripts+'\ngoogleAccessKey="chave-original";googleUser={email:"a@example.test",role:"OPERACAO"};',c);
 const pending=c.googleSendV2(r);await new Promise(ok=>setImmediate(ok));
 vm.runInContext('googleSession++;googleAccessKey="outra-chave";googleUser={email:"b@example.test",role:"OPERACAO"};',c);resolvePhoto('data:image/jpeg;base64,UERG');
 assert.equal(await pending,false);assert.equal(sent.length,0);
});

test('reenvio acompanha a revisão anterior e não confirma alterações ainda locais',async()=>{
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
 vm.runInContext(clientScripts+'\ngoogleAccessKey="chave-teste";googleUser={email:"a@example.test",role:"OPERACAO"};',c);
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

test('fotos antigas acima do limite são otimizadas para os dois modos de envio',async()=>{
 const largest=new Blob([new Uint8Array(8*1024*1024)],{type:'image/jpeg'});
 const small=new Blob(['foto'],{type:'image/jpeg'});
 for(const stagedPhotos of [true,false]){
  const photos=[{id:'small',name:'etiqueta'},...['a','b','c'].map(id=>({id,name:id}))];
  const record={id:'INSP-CLIENT-3',finalizedAt:'2026-11-25T12:00:00Z',updated:'2026-11-25T12:00:00Z',photos};
  const prepared=[],submitted=[],savedSizes=[];
  const c=vm.createContext({
   console,Blob,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},
   window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},
   view:'resumo',cur:()=>record,saveAll:()=>true,render(){},alert:message=>assert.fail(message),
   getPhoto:async id=>({blob:id==='small'?small:largest}),
   fileToDataUrl:async blob=>'data:image/jpeg;base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64'),
   fetch:async(_url,{body})=>{
    assert.ok(Buffer.byteLength(body)<15*1024*1024);
    const request=JSON.parse(body);
    if(request.action==='photo')savedSizes.push(Buffer.from(request.data.split(',')[1],'base64').length);
    if(request.action==='submit')submitted.push(request.record);
    return {ok:true,json:async()=>request.action==='photo'
     ?{ok:true,photo:{id:request.photoId,fileId:'drive-'+request.photoId,signature:'confirmed'}}
     :{ok:true,inspectionId:record.id,pdfUrl:'https://drive.google.com/file/d/teste/view',receivedAt:record.updated}};
   },
   testStaged:stagedPhotos,testCompress:async(blob,limit)=>{
    prepared.push({size:blob.size,limit});
    return new Blob([new Uint8Array(limit)],{type:'image/jpeg'});
   }
  });
  vm.runInContext(clientScripts+'\ngoogleUser={email:"ops@example.test"};googleAccessKey="teste";googleCapabilities.stagedPhotos=testStaged;compressImage=testCompress;',c);
  assert.equal(await c.googleSend(record),true);
  assert.equal(prepared.length,3);
  assert.ok(prepared.every(photo=>photo.size===largest.size&&photo.limit<=160*1024));
  assert.equal(submitted.length,1);
  assert.deepEqual(submitted[0].photoFiles.map(photo=>photo.id),photos.map(photo=>photo.id));
  assert.ok(!('googleProgress' in submitted[0]));
  if(stagedPhotos)assert.deepEqual(savedSizes,[small.size,...prepared.map(photo=>photo.limit)]);
  else assert.equal(Buffer.from(submitted[0].photoFiles[0].data.split(',')[1],'base64').length,small.size);
  assert.equal(record.syncState,'sincronizado');
 }
});

test('repete somente a requisição interrompida e continua consultando depois de receber',async()=>{
 const record={id:'INSP-CLIENT-4',finalizedAt:'2026-11-25T12:00:00Z',updated:'2026-11-25T12:00:00Z',
  photos:[{id:'PH-1',name:'etiqueta.jpg'}]};
 const attempts={photo:0,submit:0,status:0};
 const bodies={photo:[],submit:[]};
 const pending={ok:true,pending:true,inspectionId:record.id,hash:'mesma-revisao'};
 const c=vm.createContext({
  console,Blob,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},
  window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},
  view:'resumo',cur:()=>record,records:[record],saveAll:()=>true,render(){},alert:message=>assert.fail(message),
  setTimeout:callback=>queueMicrotask(callback),getPhoto:async()=>({blob:new Blob(['foto'],{type:'image/jpeg'})}),
  fileToDataUrl:async()=> 'data:image/jpeg;base64,Zm90bw==',
  fetch:async(_url,{body})=>{
   const {action}=JSON.parse(body);
   if(action==='process')return {ok:true,json:async()=>({ok:false})};
   attempts[action]++;
   bodies[action]?.push(body);
   if(attempts[action]===1)throw new TypeError('Load failed');
   const result=action==='photo'?{ok:true,photo:{id:'PH-1',fileId:'drive-foto',signature:'assinada'}}:
    action==='submit'?pending:{ok:true,inspectionId:record.id,pdfUrl:'https://drive.google.com/file/d/teste/view'};
   return {ok:true,json:async()=>result};
  }
 });
 vm.runInContext(clientScripts+'\ngoogleUser={email:"ops@example.test"};googleAccessKey="teste";',c);
 assert.equal(await c.googleSendV2(record),true);
 assert.equal(record.syncState,'processando');
 assert.deepEqual(attempts,{photo:2,submit:2,status:0});
 assert.equal(bodies.photo[0],bodies.photo[1]);
 assert.equal(bodies.submit[0],bodies.submit[1]);
 await c.googlePollJobs();
 assert.equal(record.syncState,'processando');
 assert.match(record.googleProgress,/consulta ao PDF será retomada/);
 await c.googlePollJobs();
 assert.equal(record.syncState,'sincronizado');
 assert.deepEqual(attempts,{photo:2,submit:2,status:2});
});

test('falhas repetidas deixam a inspeção e o progresso disponíveis para reenvio',async()=>{
 const record={id:'INSP-CLIENT-5',finalizedAt:'2026-11-25T12:00:00Z',updated:'2026-11-25T12:00:00Z',
  photos:[{id:'PH-1',name:'etiqueta.jpg'}]};
 let attempts=0, saved;
 const c=vm.createContext({
  console,Blob,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},
  window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},
  view:'resumo',cur:()=>record,saveAll:()=>{saved=structuredClone(record);return true;},render(){},alert:message=>assert.fail(message),
  setTimeout:callback=>queueMicrotask(callback),getPhoto:async()=>({blob:new Blob(['foto'],{type:'image/jpeg'})}),
  fileToDataUrl:async()=> 'data:image/jpeg;base64,Zm90bw==',
  fetch:async()=>{attempts++;throw new TypeError('Load failed');}
 });
 vm.runInContext(clientScripts+'\ngoogleUser={email:"ops@example.test"};googleAccessKey="teste";',c);
 assert.equal(await c.googleSendV2(record),false);
 assert.equal(attempts,2);
 assert.equal(saved.syncState,'pendente');
 assert.match(saved.googleError,/foto 1 de 1.*Reenviar esta inspeção/);
 assert.equal(saved.photos[0].id,'PH-1');
});

test('login aproveita stations retornado pela sessão em uma única chamada',async()=>{
 const {harness}=require('./support/gas.cjs');
 const h=harness();
 const plain=h.request({action:'session'});
 assert.equal(plain.ok,true);
 assert.equal(plain.stations,undefined);
 const combined=h.request({action:'session',includeStations:true});
 assert.equal(combined.ok,true);
 assert.ok(Array.isArray(combined.stations)&&combined.stations.length>0);

 const actions=[];
 const c=vm.createContext({
  console,Blob,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},
  window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:false},
  records:[],view:'home',activeId:null,photosCache:new Map(),loadAll:()=>[],render(){},
  fetch:async(_url,{body})=>{
   const req=JSON.parse(body);
   actions.push(req.action);
   return {ok:true,json:async()=>h.request(req)};
  }
 });
 vm.runInContext(clientScripts,c);
 const button={disabled:false,isConnected:true};
 const form={elements:{key:{value:'chave-teste'}},querySelector:()=>button};
 await c.googleLogin(form);
 assert.deepEqual(actions,['session','dashboard']);
 assert.ok(vm.runInContext('googleStations.length',c)>0);
});

test('envio de fotos v2 sobe até 3 fotos em paralelo preservando a ordem final',async()=>{
 const photos=['p1','p2','p3','p4','p5'].map(id=>({id,name:id+'.jpg'}));
 const record={id:'INSP-CLIENT-6',finalizedAt:'2026-11-27T12:00:00Z',updated:'2026-11-27T12:00:00Z',photos};
 let active=0,peak=0,submitted=null;
 const resolvers=[];
 const c=vm.createContext({
  console,Blob,cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/mock/exec'}},
  window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},navigator:{onLine:true},
  view:'resumo',cur:()=>record,records:[record],saveAll:()=>true,render(){},alert:message=>assert.fail(message),
  getPhoto:async()=>({blob:new Blob(['foto'],{type:'image/jpeg'})}),
  fileToDataUrl:async()=> 'data:image/jpeg;base64,Zm90bw==',
  fetch:async(_url,{body})=>{
   const req=JSON.parse(body);
   if(req.action==='photo'){
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>resolvers.push(()=>{active--;resolve();}));
    return {ok:true,json:async()=>({ok:true,photo:{id:req.photoId,fileId:'drive-'+req.photoId,signature:'sig'}})}
   }
   if(req.action==='submit')submitted=req.record;
   return {ok:true,json:async()=>({ok:true,inspectionId:record.id,pdfUrl:'https://drive.google.com/file/d/teste/view',receivedAt:record.updated})};
  }
 });
 vm.runInContext(clientScripts+'\ngoogleUser={email:"ops@example.test"};googleAccessKey="teste";',c);
 const sending=c.googleSendV2(record);
 for(let step=0;step<20;step++){
  await new Promise(ok=>setImmediate(ok));
  while(resolvers.length)resolvers.shift()();
 }
 assert.equal(await sending,true);
 assert.equal(peak,3);
 assert.deepEqual(submitted.photoFiles.map(p=>p.id),photos.map(p=>p.id));
});
