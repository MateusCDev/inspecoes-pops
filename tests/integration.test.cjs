const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=require('node:path').join(__dirname,'..');
const {harness}=require('./support/gas.cjs');
test('rejeita chave antes de criar aba/arquivo',()=>{const h=harness();assert.equal(h.send(h.record(),'invalid').ok,false);assert.equal(h.rows.length,0);assert.equal(h.files.size,0)});
test('grava, repete sem duplicar, atualiza a mesma linha e rejeita versão antiga',()=>{
 const h=harness(),r=h.record();const first=h.send(r);assert.equal(first.ok,true);assert.equal(h.rows.length,2);assert.equal(h.rows[0].length,h.rows[1].length);assert.equal(h.files.size,3);
 const retry=h.send(r);assert.equal(retry.pdfUrl,h.rows[1][h.rows[0].indexOf('pdf_url')]);assert.equal(h.files.size,3);
 r.updated='2026-11-16T12:00:00Z';r.checks['EL-01'].status='NC';assert.equal(h.send(r).ok,true);assert.equal(h.rows.length,2);assert.equal(h.files.size,6);
 r.updated='2026-11-16T10:00:00Z';assert.equal(h.send(r).ok,false);
});
test('não grava linha quando falha PDF',()=>{const h=harness();h.setFailPdf();assert.equal(h.send(h.record()).ok,false);assert.equal(h.rows.length,0);assert.equal(h.files.size,1)});
test('valida campos e presença das fotos; neutraliza fórmulas',()=>{
 const h=harness(),r=h.record();r.photos=[{id:'foto1'}];assert.equal(h.send(r).ok,false);r.photos=[];r.observacoes='=IMPORTXML("https://example.com")';assert.equal(h.send(r).ok,true);assert.match(h.rows[1][h.rows[0].indexOf('observacoes')],/^'=/);
 r.id='invalid';assert.equal(h.send(r).ok,false);
});
test('status desconhecidos são separados; denominador usa apenas C e NC',()=>{
 const h=harness(),r=h.record();r.checks['EL-02']={status:'NA'};r.checks['EL-03']={status:'erro'};assert.equal(h.send(r).ok,true);
 const value=k=>h.rows[1][h.rows[0].indexOf(k)];assert.equal(value('itens_conformes'),1);assert.equal(value('itens_nao_conformes'),0);assert.equal(value('itens_status_desconhecido'),1);
 assert.equal(value('total_itens'),value('itens_conformes')+value('itens_nao_conformes')+value('itens_nao_aplicaveis')+value('itens_nao_verificados')+value('itens_status_desconhecido'));
});
function frontend(fetch){
 const r={id:'INSP-T',finalizedAt:'yes',updated:'version1',photos:[]};
 const c=vm.createContext({cfg:{mode:'google',google:{endpoint:'https://script.google.com/macros/s/test/exec'}},window:{addEventListener(){}},document:{addEventListener(){}},records:[r],navigator:{onLine:true},saveAll:()=>true,render(){},alert(){},Blob,fetch});
 vm.runInContext(fs.readFileSync(root+'/public/inspection-photos.js','utf8')+'\n'+fs.readFileSync(root+'/public/google-sync.js','utf8')+'\n'+fs.readFileSync(root+'/public/google-features.js','utf8')+'\ngoogleAccessKey="valid";googleUser={email:"tecnico@voanet.com.br",role:"OPERACAO"};',c);return {c,r};
}
test('frontend só confirma depois de retorno válido',async()=>{
 const h=frontend(async()=>({ok:true,json:async()=>({ok:false,error:'negado'})}));assert.equal(await h.c.googleSend(h.r),false);assert.equal(h.r.syncState,'erro');
 const h2=frontend(async()=>({ok:true,json:async()=>({ok:true,inspectionId:'OUTRO',pdfUrl:'https://drive.google.com/file/d/1'})}));assert.equal(await h2.c.googleSend(h2.r),false);
});
test('edição durante envio permanece pendente',async()=>{
 let complete;const h=frontend(()=>new Promise(ok=>complete=ok));const pending=h.c.googleSend(h.r);await new Promise(ok=>setImmediate(ok));h.r.updated='version2';complete({ok:true,json:async()=>({ok:true,inspectionId:h.r.id,pdfUrl:'https://drive.google.com/file/d/test',receivedAt:'now'})});assert.equal(await pending,true);assert.equal(h.r.syncState,'pendente');
});
test('gestor consulta equipe e operador consulta somente registros próprios',()=>{
 const h=harness(),first=h.record(),second={...h.record(),id:'INSP-TEST-02'};
 assert.equal(h.send(first).ok,true);assert.equal(h.send(second,'other').ok,true);
 assert.equal(h.request({action:'list'},'manager').items.length,2);
 assert.equal(h.request({action:'list'}).items.length,1);
 assert.equal(h.request({action:'list',role:'GESTAO'},'other').items[0].id,second.id);
});
test('operador não pode sobrescrever nem baixar PDF de outro operador',()=>{
 const h=harness(),r=h.record();h.send(r);const count=h.files.size;
 assert.equal(h.send(r,'other').ok,false);
 assert.equal(h.request({action:'pdf',inspectionId:r.id},'other').ok,false);
 assert.equal(h.files.size,count);
 assert.equal(h.request({action:'pdf',inspectionId:r.id}).base64,Buffer.from('PDF').toString('base64'));
});
test('autoria é privada: modificar coluna da planilha não muda permissões',()=>{
 const h=harness(),r=h.record();r.ownerEmail='outro@voanet.com.br';h.send(r);
 h.rows[1][h.rows[0].indexOf('operador_envio')]='outro@voanet.com.br';
 assert.equal(h.request({action:'list'},'other').items.length,0);
 assert.equal(h.request({action:'list'}).items[0].owner,'tecnico@voanet.com.br');
});
test('desativação e chaves antigas são rejeitadas pelo serviço',()=>{
 const h=harness();assert.equal(h.request({action:'session'}).user.role,'OPERACAO');
 h.access[1][2]=false;assert.equal(h.request({action:'session'}).code,'AUTH');
 h.props.TOKEN_HASHES=JSON.stringify({[h.digest('legacy')]:'operador-anonimo'});
 assert.equal(h.request({action:'list'},'legacy').code,'AUTH');
});
test('resposta de envio após sair não altera a sessão seguinte',async()=>{
 let complete;const h=frontend(()=>new Promise(ok=>complete=ok)),pending=h.c.googleSend(h.r);
 await new Promise(ok=>setImmediate(ok));vm.runInContext('googleSession++;',h.c);
 complete({ok:true,json:async()=>({ok:true,inspectionId:h.r.id,pdfUrl:'https://drive.google.com/file/d/test',receivedAt:'now'})});
 assert.equal(await pending,false);assert.notEqual(h.r.syncState,'sincronizado');
});
test('link e data adulterados na planilha não controlam PDF ou versão privada',()=>{
 const h=harness(),r=h.record();h.send(r);
 h.rows[1][h.rows[0].indexOf('pdf_url')]='https://drive.google.com/file/d/unrelated-private-file/view';
 h.rows[1][h.rows[0].indexOf('updated')]='2099-01-01T00:00:00Z';
 assert.equal(h.request({action:'pdf',inspectionId:r.id}).ok,true);
 assert.equal(h.send(r).ok,true);
 r.updated='2026-11-17T12:00:00Z';assert.equal(h.send(r).ok,true);
});
test('reemissão gera chave vinculada ao cadastro e revoga a anterior',()=>{
 const h=harness(),logs=[];h.c.console={log:x=>logs.push(x)};
 h.c.Utilities.getUuid=()=>crypto.randomUUID();h.access[1][3]=true;
 h.c.createOperatorKey();
 const token=logs[0].split('Chave individual: ')[1];
 assert.equal(h.request({action:'session'},token).user.email,'tecnico@voanet.com.br');
 assert.equal(h.request({action:'session'},'valid').code,'AUTH');
 assert.equal(h.access[1][3],false);
});
test('prazo segue criticidade do cadastro e data da vistoria, sem aceitar prazo forjado',()=>{
 const h=harness(),r=h.record();r.data='2026-11-17';r.schedulePeriod=180;r.scheduleDueDate='2099-01-01';
 const high=h.send(r);assert.equal(high.schedule.days,45);assert.equal(high.schedule.dueDate,'2027-01-01');
 const med={...r,id:'INSP-MED-1',codigoPop:'TEST-MED'};
 const result=h.send(med);assert.equal(result.schedule.days,90);assert.equal(result.schedule.dueDate,'2027-02-15');
});
test('cada nova inspeção recalcula o ciclo sem apagar o histórico',()=>{
 const h=harness(),r=h.record();r.data='2026-11-17';h.send(r);
 const next={...r,id:'INSP-NEXT-1',data:'2026-12-10'};
 assert.equal(h.send(next).schedule.dueDate,'2027-01-24');assert.equal(h.rows.length,3);
});
test('Cordebras sai do escopo e Base Nova continua com o código compartilhado',()=>{
 const h=harness(),r=h.record();r.codigoPop='PCAM.021';r.nome='POP Cordebras';assert.equal(h.send(r).ok,false);
 r.nome='POP 46 Base Nova';const result=h.send(r);assert.equal(result.ok,true);assert.equal(result.schedule.days,90);
 const catalog=h.request({action:'stations'}).stations;assert.equal(catalog.find(s=>s.name==='POP Cordebras').inactive,true);assert.equal(catalog.find(s=>s.name==='POP 46 Base Nova').duplicate,false);
});
test('POPs SWAP ficam fora do escopo de inspeções (por nome ou coluna no cadastro)',()=>{
 const h=harness();
 h.stations.push(['POP-SW1','POP Parceiro SWAP','','Teste','','','','','ALTA','']);
 h.stations.push(['POP-SW2','POP Estação Terceira','SWAP','Teste','','','','','MEDIA','']);
 const catalog=h.request({action:'stations'}).stations;
 assert.equal(catalog.find(s=>s.code==='POP-SW1').swap,true);
 assert.equal(catalog.find(s=>s.code==='POP-SW1').inactive,true);
 assert.equal(catalog.find(s=>s.code==='POP-SW2').swap,true);
 assert.equal(catalog.find(s=>s.code==='POP-SW2').inactive,true);
 const r=h.record();r.codigoPop='POP-SW1';r.nome='POP Parceiro SWAP';
 const blocked1=h.send(r);assert.equal(blocked1.ok,false);assert.match(blocked1.error,/SWAP/);
 r.codigoPop='POP-SW2';r.nome='POP Estação Terceira';
 const blocked2=h.send(r);assert.equal(blocked2.ok,false);assert.match(blocked2.error,/SWAP/);
});
test('data impossível, código ausente ou criticidade sem regra são rejeitados',()=>{
 const h=harness(),r=h.record();r.data='2026-02-30';assert.equal(h.send(r).ok,false);
 r.data='2026-02-28';r.codigoPop='';assert.equal(h.send(r).ok,false);
 r.codigoPop='TEST-HIGH';h.stations[1][8]='BAIXA';assert.equal(h.send(r).ok,false);
});

test('Gestão consulta ações recebidas de um operador com os dados arquivados e fallback legado',()=>{
 const h=harness(),r=h.record();
 const action={titulo:'Identificar circuitos',acao:'Etiquetar os disjuntores',prioridade:'P2',responsavel:'O&M',prazo:'2026-11-30',status:'Pendente',evidencia:'EL-01'};
 r.issues=[action];
 assert.equal(h.send(r).ok,true);
 const query={action:'inspectionActionPlan',inspectionId:r.id};
 const dashboard=h.request({action:'dashboard'},'manager');
 assert.equal(dashboard.items[0].issues,1);
 assert.deepEqual(h.request(query,'manager').issues,[action]);
 assert.equal(h.request(query).ok,false);
 assert.equal(h.request(query,'other').ok,false);
 assert.equal(h.request({...query,inspectionId:'INSP-INEXISTENTE'},'manager').ok,false);

 const column=h.rows[0].indexOf('pendencias_json');
 h.rows[1][column]='[]';
 assert.deepEqual(h.request(query,'manager').issues,[action]);
 delete h.props['REVISION_'+h.digest(r.id)];
 h.rows[1][column]=JSON.stringify([action]);
 assert.deepEqual(h.request(query,'manager').issues,[action]);
});
