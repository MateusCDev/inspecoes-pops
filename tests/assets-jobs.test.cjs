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

test('Gestão consulta equipamentos da inspeção arquivada sem alterar os ativos centrais',()=>{
 const h=harness(),record=climateRecord(h);
 record.invTransceivers=[{id:'TX-FICTICIO',tipo:'SFP+',serie:'TX-1'}];
 assert.equal(h.send(record).ok,true);
 const action={action:'inspectionAssets',inspectionId:record.id};
 assert.equal(h.request(action).ok,false);
 assert.equal(h.request(action,'other').ok,false);
 const inventory=h.request(action,'manager');
 assert.equal(inventory.ok,true);
 assert.deepEqual(inventory.groups.map(group=>group.label),['Transceivers','Climatização']);
 assert.equal(inventory.groups[1].items[0].name,'AC100');
});

function switchWithSerial(h, serial){
 const r=h.record();
 r.inventory=[{id:'SW1',tipo:'Switch',marca:'Datacom',modelo:'DM4170',serial,patrimonio:'16380',confirmacao:'Confirmado na etiqueta'}];
 return r;
}

test('série com zeros à esquerda e mesmo patrimônio atualiza o mesmo ativo',()=>{
 const h=harness(),record=switchWithSerial(h,'0004519107');
 h.asset('Ativos',{Local:record.nome,Categoria:'Switch',Fabricante:'Datacom',Modelo:'DM4170','Nº Série':4519107,Patrimônio:16380});
 const result=h.send(record);
 assert.equal(result.assets.pending,0);
 assert.equal(h.assets.Ativos.length,2);
 assert.equal(value(h,'Ativos',1,'Nº Série'),'0004519107');
 assert.equal(h.audit.some(row=>row[6]==='SUBSTITUIDO'),false);
});

test('Gestão compara a divergência e confirma a troca com auditoria; Operação fica sem acesso',()=>{
 const h=harness(),r=switchWithSerial(h,'SERIE-NOVA');
 const old=h.asset('Ativos',{Local:r.nome,Categoria:'Switch',Fabricante:'Datacom',Modelo:'DM4170','Nº Série':'SERIE-ANTIGA',Patrimônio:16380});
 const report=h.send(r);
 assert.equal(report.assets.pending,1);
 const compare={action:'compareInspectionAssets',inspectionId:r.id};
 assert.equal(h.request(compare).ok,false);
 const items=h.request(compare,'manager').items;
 assert.equal(items[0].matches[0].serial,'SERIE-ANTIGA');
 assert.equal(items[0].matches[0].operation,'replace');
 const decision={action:'applyAssetDecision',inspectionId:r.id,decisionToken:items[0].matches[0].token,reason:'Confirmado na OS fictícia'};
 assert.equal(h.request(decision).ok,false);
 old[h.assets.Ativos[0].indexOf('Observações')]='Nota adicionada depois da comparação';
 assert.match(h.request(decision,'manager').error,/mudou/);
 decision.decisionToken=h.request(compare,'manager').items[0].matches[0].token;
 assert.equal(h.request(decision,'manager').action,'SUBSTITUIDO');
 assert.equal(value(h,'Ativos',1,'Nº Série'),'SERIE-NOVA');
 assert.equal(h.request({action:'assetIssues',inspectionId:r.id},'manager').issues.length,0);
 assert.equal(h.request({action:'status',inspectionId:r.id},'manager').pdfUrl,report.pdfUrl);
 assert.equal(h.request(decision,'manager').ok,false);
 const event=h.audit.find(row=>row[6]==='SUBSTITUIDO');
 assert.match(event[7],/gestor.*OS fictícia/);
 assert.match(event[8],/SERIE-ANTIGA/);
 assert.match(event[9],/SERIE-NOVA/);
});

test('banco incompleto é comparado, mas a contagem central exige conferência física',()=>{
 const h=harness(),r=h.record();
 h.asset('Controle_Baterias',{'Estação':r.nome,'Descrição':'Banco 01','Modelo':'B150','Quantidade':4,'Status':'NORMAL'});
 r.invBatteryBanks=[{id:'B',identificacao:'Banco 01',baterias:[{id:'B1',modelo:'B150'}]}];
 assert.ok(h.send(r).ok);
 const request={action:'centralBatteryBanks'};
 assert.equal(h.request(request).ok,false);
 assert.equal(h.request(request,'manager').banks[0].quantity,'4');
 const compare=h.request({action:'compareInspectionAssets',inspectionId:r.id},'manager');
 assert.equal(compare.items[0].quantity,1);
 assert.equal(compare.items[0].matches[0].quantity,4);
 assert.equal(compare.items[0].matches[0].operation,undefined);
});

test('pendência de série legada oferece vínculo quando a divergência é só de zeros',()=>{
 const h=harness(),r=switchWithSerial(h,'0004519107');
 const legacy=h.asset('Ativos',{Local:r.nome,Categoria:'Switch',Fabricante:'Datacom',Modelo:'DM4170','Nº Série':4519107,Patrimônio:16380});
 assert.equal(h.send(r).assets.pending,0);
 legacy[h.assets.Ativos[0].indexOf('Nº Série')]=4519107;
 const revision=JSON.parse(h.props['REVISION_'+h.digest(r.id)]);
 const detail='Ativos · DM4170: A série diverge da identificação já cadastrada; confirme a substituição com a gestão.';
 h.audit.push(['legado',new Date(),r.id,r.codigoPop,'Ativos','','PENDENCIA',detail,'{}','{}',revision.hash]);
 const compare={action:'compareInspectionAssets',inspectionId:r.id};
 const match=h.request(compare,'manager').items[0].matches[0];
 assert.equal(match.operation,'link');
 assert.ok(match.basis.includes('Série equivalente com zeros à esquerda'));
 const result=h.request({action:'applyAssetDecision',inspectionId:r.id,decisionToken:match.token,reason:'Identificação confirmada na etiqueta'},'manager');
 assert.equal(result.action,'VINCULADO');
 assert.equal(value(h,'Ativos',1,'Nº Série'),'0004519107');
});

test('nova linha mantém campos opcionais vazios e recupera fórmulas ausentes na linha modelo',()=>{
 const h=harness(),r=climateRecord(h);
 const tab='Climatização_Voanet';
 const nextMaintenance='=IF(RC[-1]="";"";RC[-1]+120)';
 h.asset(tab,{'Estação':'Outra estação','Próxima Manutenção':nextMaintenance});
 h.asset(tab,{'Estação':'Terceira estação'});
 r.equipamentos.climatizadores[0].serie='N/A';
 r.equipamentos.climatizadores[0].patrimonio='PAT-01';
 assert.equal(h.send(r).assets.pending,0);
 assert.equal(value(h,tab,2,'Nº Série'),'');
 assert.equal(value(h,tab,2,'Última Manutenção'),'');
 assert.equal(value(h,tab,2,'Próxima Manutenção'),nextMaintenance);
 assert.equal(value(h,tab,2,'Patrimônio'),'PAT-01');
});

test('banco com série repetida para patrimônios diferentes não grava ativos duplicados',()=>{
 const h=harness(),r=h.record();
 const bank={identificacao:'Banco 01',cadastroCompleto:true,baterias:[
  {id:'B1',serie:'S1',patrimonio:'P1',modelo:'B150',fabricante:'Moura'},
  {id:'B2',serie:'s1 ',patrimonio:'P2',modelo:'B150',fabricante:'Moura '}
 ]};
 r.invBatteryBanks=[bank];r.batteryReview={B1:'mantida',B2:'mantida'};
 h.asset('Controle_Baterias',{'Estação':r.nome,'Fabricante':'Moura','Modelo':'B150','Patrimônio':'P1, P2','Descrição':'Referência das etiquetas'});
 const blocked=h.send(r);
 assert.equal(blocked.ok,true);
 assert.match(blocked.assets.warnings[0],/Série ou patrimônio repetido/);
 assert.equal(h.assets.Ativos.length,1);
 assert.equal(value(h,'Controle_Baterias',1,'Nº Série'),'');
 bank.baterias[1].serie='S2';
 r.updated='2026-11-16T11:10:00Z';
 const repaired=h.send(r);
 assert.equal(repaired.assets.pending,0);
 assert.equal(value(h,'Controle_Baterias',1,'Descrição'),'Referência das etiquetas');
 assert.equal(value(h,'Controle_Baterias',1,'Nº Série'),'S1, S2');
});

test('corrige Outro em porta GPON de OLT sem alterar os outros tipos ou o envio original',()=>{
 const h=harness(),r=h.record();
 r.inventory=[{id:'OLT-1',tipo:'OLT DA1',modelo:'DM4615',serial:'OLT-S1',confirmacao:'Confirmado na etiqueta'}];
 r.inventoryReview={transceivers:'alterado'};
 r.invTransceivers=[
  {id:'TX1',tipo:'Outro',modelo:'M1',serie:'S1',equipamentoId:'OLT-1',porta:'GPON 1/1/1',estado:'Instalado'},
  {id:'TX2',tipo:'Outro',modelo:'M2',serie:'S2',equipamentoId:'OLT-1',porta:'Ten-Gigabit-ethernet 1/1/1'},
  {id:'TX3',tipo:'SFP+',modelo:'M3',serie:'S3',equipamentoId:'OLT-1',porta:'GPON 1/1/3'}
 ];
 assert.equal(h.send(r).ok,true);
 const inventory=JSON.parse(h.rows[1][h.rows[0].indexOf('inventario_json')]);
 assert.deepEqual(inventory.transceivers.map(item=>item.tipo),['GPON','Outro','SFP+']);
 const detail=h.request({action:'inspectionAssets',inspectionId:r.id},'manager');
 assert.equal(detail.groups.find(g=>g.label==='Transceivers').items[0].name,'M1 · GPON');
 const central=h.request({action:'centralAssetsForInspection',inspectionId:r.id},'manager');
 const transceiver=central.groups.find(g=>g.label==='Ativos').items.find(item=>item.serial==='S1');
 assert.equal(transceiver.status,'');
 assert.equal(transceiver.observation,'Situação na vistoria: Instalado.');
 assert.equal(h.request({action:'reprocessAssets',inspectionId:r.id},'manager').pending,true);
 assert.equal(h.request({action:'process',inspectionId:r.id},'manager').ok,true);
 const assets=h.assets.Ativos;
 const gear=row=>row[assets[0].indexOf('Equipamento')];
 assert.deepEqual(assets.slice(1).map(gear).filter(g=>g.startsWith('Transceiver')).sort(),
  ['Transceiver GPON','Transceiver Outro','Transceiver SFP+']);
 assert.equal(r.invTransceivers[0].tipo,'Outro');
});

test('climatização fora do escopo e medições omitidas preservam as últimas leituras',()=>{
 const h=harness();
 h.asset('Climatização_Voanet',{'Estação':'POP fictício','Modelo':'AC100','Fabricante':'Gree','Nº Série':'SER-AC-1',
   'Última Medição Temperatura':24,'Última Medição Corrente':3.4});
 const r=climateRecord(h),unit=r.equipamentos.climatizadores[0];
 Object.assign(unit,{temperatura:'Não medido',corrente:' N/A '});
 const sent=h.send(r);
 assert.equal(sent.ok,true);
 assert.equal(sent.assets.pending,0);
 assert.equal(value(h,'Climatização_Voanet',1,'Última Medição Temperatura'),24);
 assert.equal(value(h,'Climatização_Voanet',1,'Última Medição Corrente'),3.4);
 const skipped=climateRecord(h);
 skipped.id='INSP-CLIMA-FORA';
 skipped.inventoryReview.climatizadores='fora_escopo';
 skipped.inventory=[{id:'AC-GERAL',tipo:'Ar-condicionado',confirmacao:'Confirmado na etiqueta',estado:'Crítico',serial:'SER-AC-1'}];
 Object.assign(skipped.equipamentos.climatizadores[0],{temperatura:'23 ºC',corrente:'4,2'});
 assert.equal(h.send(skipped).assets.pending,0);
 assert.equal(value(h,'Ativos',1,'Status'),'Operacional');
 assert.equal(value(h,'Climatização_Voanet',1,'Última Medição Temperatura'),24);
 assert.equal(value(h,'Climatização_Voanet',1,'Última Medição Corrente'),3.4);
 assert.equal(h.c.validatedAssetValue_(null,'23,5 ºC','Última Medição Temperatura'),23.5);
 assert.throws(()=>h.c.validatedAssetValue_(null,'gelado','Última Medição Temperatura'),/numérico/);
});

test('Gestão vê modelo parecido sem vincular e pode confirmar identidade exata mantendo fabricante',()=>{
 const h=harness();
 const r=h.record();
 r.inventoryReview={equipamentos:'alterado'};
 r.inventory=[
  {id:'A1',tipo:'Outro',marca:'Outro fabricante',modelo:'Kit fans OLT UR1',patrimonio:'32444'},
  {id:'A2',tipo:'Outro',marca:'Outro fabricante',modelo:'DIO 48F.O',serial:'ID-DIO'},
  {id:'A3',tipo:'Switch',marca:'Datacom',modelo:'Sem identificação',serial:'Sem número de série'}
 ];
 h.asset('Ativos',{'Local':'POP fictício','Categoria':'Outro','Equipamento':'Refrigeração','Fabricante':'Datacom','Modelo':'Kit Fans Olt UR','Patrimônio':'32444'});
 h.asset('Ativos',{'Local':'POP fictício','Categoria':'Outro','Equipamento':'DIO','Fabricante':'XPS','Modelo':'Dio 48 F.O','Nº Série':'ID-DIO'});
 const result=h.send(r);
 assert.equal(result.ok,true);
 assert.equal(result.assets.pending,3);
 assert.equal(h.assets.Ativos.length,3);
 const compare={action:'compareInspectionAssets',inspectionId:r.id};
 const items=h.request(compare,'manager').items;
 const fan=items.find(item=>item.model==='Kit fans OLT UR1').matches[0];
 assert.ok(fan.basis.includes('Modelo parecido'));
 assert.equal(fan.rowNumber,2);
 assert.equal(fan.operation,undefined);
 const dio=items.find(item=>item.model==='DIO 48F.O').matches[0];
 assert.equal(dio.makerDiff,true);
 assert.equal(dio.operation,'keepMaker');
 const decision={action:'applyAssetDecision',inspectionId:r.id,decisionToken:dio.token,reason:'Identidade conferida na etiqueta'};
 assert.equal(h.request(decision,'manager').action,'VINCULADO');
 assert.equal(value(h,'Ativos',2,'Fabricante'),'XPS');
 assert.equal(h.request({action:'assetIssues',inspectionId:r.id},'manager').issues.length,2);
});
