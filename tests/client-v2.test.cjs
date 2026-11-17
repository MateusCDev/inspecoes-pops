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
