const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/gas.cjs');
const value=(h,tab,row,header)=>h.assets[tab][row][h.assets[tab][0].indexOf(header)];
function climateRecord(h){const r=h.record();r.inventoryReview={climatizadores:'alterado'};r.equipamentos={climatizadores:[{id:'AC-1',marca:'Gree',modelo:'AC100',serie:'SER-AC-1',capacidade:'12000',estado:'Operacional'}]};return r;}
test('atualiza climatização e Ativos sem apagar datas de manutenção ou fórmulas',()=>{
 const h=harness();h.asset('Climatização_Voanet',{'Estação':'POP fictício','Fabricante':'Gree','Modelo':'AC100','Nº Série':'SER-AC-1','BTUs':9000,'Data Instalação':'2022-01-01','Última Manutenção':'2026-01-15','Próxima Manutenção':'=K2+90'});
 h.asset('Ativos',{'Local':'POP fictício','Categoria':'Ar-condicionado','Fabricante':'Gree','Modelo':'AC100','Nº Série':'SER-AC-1'});
 const result=h.send(climateRecord(h));assert.equal(result.ok,true);assert.equal(result.assets.updated,2);
 assert.equal(value(h,'Climatização_Voanet',1,'BTUs'),12000);assert.equal(value(h,'Climatização_Voanet',1,'Data Instalação'),'2022-01-01');assert.equal(value(h,'Climatização_Voanet',1,'Última Manutenção'),'2026-01-15');assert.equal(value(h,'Climatização_Voanet',1,'Próxima Manutenção'),'=K2+90');
 assert.equal(h.assets['Climatização_Voanet'].length,2);assert.equal(value(h,'Ativos',1,'Status'),'Operacional');assert.ok(h.audit.length>1);
});
test('novo ativo não duplica no reenvio e uma inspeção antiga não sobrescreve a nova',()=>{
 const h=harness(),r=climateRecord(h);assert.equal(h.send(r).ok,true);assert.equal(h.assets['Climatização_Voanet'].length,2);
 const count=h.audit.length;h.send(r);assert.equal(h.audit.length,count);
 const old={...r,id:'INSP-OLD-1',data:'2026-01-01',updated:'2026-11-16T12:00:00Z',equipamentos:{climatizadores:[{...r.equipamentos.climatizadores[0],capacidade:6000}]}};
 assert.ok(h.send(old).assets.pending>=1);assert.equal(value(h,'Climatização_Voanet',1,'BTUs'),12000);
});
test('ambiguidade ou série em outro POP vira pendência sem alterar linhas existentes',()=>{
 const h=harness();h.asset('Climatização_Voanet',{'Estação':'Outro POP','Modelo':'AC100','Fabricante':'Gree','Nº Série':'SER-AC-1','BTUs':9000});
 const result=h.send(climateRecord(h));assert.ok(result.assets.pending>=1);assert.equal(value(h,'Climatização_Voanet',1,'BTUs'),9000);
});
test('preserva validação de fabricante e as fórmulas de retificação',()=>{
 const h=harness();h.asset('Retificadores',{'Estação':'POP fictício','Modelo':'REC1','Fabricante':'XPS','Nº Série':'R1','Status':'=IF(G2>0,"NORMAL","CRITICO")','Capacidade Atual (A)':'=F2/E2'});h.rule('Retificadores',2,'Fabricante',['XPS','Emerson']);
 const r=h.record();r.inventoryReview={retificadoras:'alterado'};r.equipamentos={retificadoras:[{modelo:'REC1',serie:'R1',fabricante:'Delta',urInstaladas:'4',capacidadeCC:'200',tensao:'48'}]};
 const result=h.send(r);assert.equal(result.ok,true);assert.ok(result.assets.pending>=1);assert.equal(value(h,'Retificadores',1,'Fabricante'),'XPS');assert.equal(value(h,'Retificadores',1,'Capacidade Atual (A)'),'=F2/E2');
});
test('banco conferido atualiza cadastro sem fingir teste ou apagar fórmulas de vida útil',()=>{
 const h=harness();h.asset('Controle_Baterias',{'Estação':'POP fictício','Fabricante':'Moura','Modelo':'B150','Patrimônio':'P1, P2','Quantidade':2,'Última Teste':'2025-12-01','Status':'=IF(J2>46,"CRITICO","NORMAL")'});
 const r=h.record();r.invBatteryBanks=[{identificacao:'Banco 01',cadastroCompleto:true,tensao:'24',capacidade:'150',baterias:[{id:'B1',patrimonio:'P1',serie:'S1',modelo:'B150',fabricante:'Moura',tecnologia:'AGM'},{id:'B2',patrimonio:'P2',serie:'S2',modelo:'B150',fabricante:'Moura',tecnologia:'AGM'}]}];r.batteryReview={B1:'mantida',B2:'mantida'};
 const result=h.send(r);assert.equal(result.ok,true);assert.equal(value(h,'Controle_Baterias',1,'Última Teste'),'2025-12-01');assert.equal(value(h,'Controle_Baterias',1,'Status'),'=IF(J2>46,"CRITICO","NORMAL")');assert.equal(value(h,'Controle_Baterias',1,'Tensão Nominal (V)'),24);
});
test('banco parcialmente inventariado não reduz a quantidade cadastrada',()=>{
 const h=harness();h.asset('Controle_Baterias',{'Estação':'POP fictício','Fabricante':'Moura','Modelo':'B150','Patrimônio':'P1, P2, P3, P4','Quantidade':4});
 const r=h.record();r.invBatteryBanks=[{identificacao:'Banco 01',baterias:[{id:'B1',patrimonio:'P1',serie:'S1',modelo:'B150',fabricante:'Moura'}]}];r.batteryReview={B1:'mantida'};
 assert.ok(h.send(r).assets.pending>=1);assert.equal(value(h,'Controle_Baterias',1,'Quantidade'),4);
});
test('data opcional inválida vira pendência sem bloquear o recebimento da inspeção',()=>{
 const h=harness(),r=climateRecord(h);r.equipamentos.climatizadores[0].instalacao='2026-02-30';const result=h.send(r);assert.equal(result.ok,true);assert.ok(result.assets.pending>=1);
});
test('fila confirma recebimento antes do PDF e conversão não segura o bloqueio global',()=>{
 const h=harness(),r=h.record();const receipt=h.request({action:'submit',record:r,queue:true});assert.equal(receipt.pending,true);assert.equal(h.rows.length,0);
 h.c.processQueue();const done=h.request({action:'status',inspectionId:r.id});assert.equal(done.ok,true);assert.equal(done.pending,undefined);assert.equal(h.rows.length,2);assert.deepEqual(h.locksDuringPdf,[false]);
});
test('consulta consolidada usa uma página de histórico e mantém as métricas completas',()=>{
 const h=harness();h.rows.push(h.c.headers_());
 for(let i=1;i<=120;i++){const r={...h.record(),id:'INSP-'+i},owner=i%2?'tecnico@voanet.com.br':'outro@voanet.com.br';h.props['OWNER_'+h.digest(r.id)]=owner;h.rows.push(h.c.row_(r,{},owner,'hash'));}
 let reads=h.propertyReads();const manager=h.request({action:'dashboard'},'manager');assert.equal(manager.summary.total,120);assert.equal(manager.items.length,50);assert.ok(h.propertyReads()-reads<=2);
 const own=h.request({action:'dashboard'});assert.equal(own.summary.total,60);assert.ok(own.items.every(r=>r.owner==='tecnico@voanet.com.br'));
 const next=h.request({action:'list',cursor:manager.nextCursor},'manager');assert.equal(next.items.length,50);assert.ok(!next.items.some(r=>manager.items.some(x=>x.id===r.id)));
});
test('referências de fotos são assinadas e não podem ser transferidas a outro autor',()=>{
 const h=harness(),r=h.record();const staged=h.request({action:'photo',inspectionId:r.id,photoId:'PH-1',data:'data:image/jpeg;base64,UERG'});assert.equal(staged.ok,true);
 r.photos=[{id:'PH-1'}];r.photoFiles=[staged.photo];assert.equal(h.send(r,'other').ok,false);
 r.photoFiles=[{...staged.photo,fileId:'outro-arquivo'}];assert.equal(h.send(r).ok,false);
 r.photoFiles=[staged.photo];assert.equal(h.send(r).ok,true);
});
test('coluna de série redundante impede a consolidação ambígua, preservando a inspeção',()=>{
 const h=harness();h.assets['Climatização_Voanet'][0].push('Numero_Serie');const result=h.send(climateRecord(h));assert.equal(result.ok,true);assert.ok(result.assets.pending>=1);assert.equal(h.assets['Climatização_Voanet'].length,1);
});

test('climatização aceita datas brasileiras e converte explicitamente quilogramas para gramas',()=>{
 const h=harness(),r=climateRecord(h);
 Object.assign(r.equipamentos.climatizadores[0],{instalacao:'21/11/2026',cargaGas:'625g'});
 const sent=h.send(r);
 assert.equal(sent.ok,true);
 assert.equal(sent.assets.pending,0);
 assert.equal(value(h,'Climatização_Voanet',1,'Carga Gás'),625);
 assert.equal(value(h,'Climatização_Voanet',1,'Data Instalação').toISOString(),'2026-11-21T12:00:00.000Z');
 assert.equal(h.c.validatedAssetValue_(null,'0,625 kg','Carga Gás'),625);
 assert.throws(()=>h.c.validatedAssetValue_(null,'R-410A','Carga Gás'),/Informe a carga/);
 assert.deepEqual({...h.c.assetDate_('31/02/2026')},{_invalidDate:'31/02/2026'});
});

test('reprocessamento mostra somente as pendências atuais e conserva o PDF e a auditoria anterior',()=>{
 const h=harness(),r=climateRecord(h);
 const sent=h.send(r);
 assert.equal(sent.ok,true);
 const revision=h.props['REVISION_'+h.digest(r.id)];
 const version=JSON.parse(revision).hash;
 h.audit.push(['registro antigo',new Date(),r.id,r.codigoPop,'Climatização_Voanet','','PENDENCIA','Valor anterior rejeitado','','',version]);
 const list={action:'assetIssues',inspectionId:r.id};
 assert.equal(h.request(list,'manager').issues.length,1);
 const reprocessed=h.request({action:'reprocessAssets',inspectionId:r.id},'manager');
 assert.equal(reprocessed.pending,true);
 const done=h.request({action:'process',inspectionId:r.id},'manager');
 assert.equal(done.ok,true);
 assert.equal(done.pdfUrl,sent.pdfUrl);
 assert.equal(h.request(list,'manager').issues.length,0);
 assert.equal(h.audit.some(row=>row[0]==='registro antigo'),true);
});
