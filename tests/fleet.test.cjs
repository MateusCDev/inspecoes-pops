const {test} = require('node:test');
const assert = require('node:assert/strict');
const {harness} = require('./support/gas.cjs');

function empty() {
  return {vehicles:[],drivers:[],inspections:[],issues:[],handovers:[],settings:{weeklyDay:1},version:4};
}

test('Frota usa a chave de Gestão, atualiza a guia e mantém o acervo em armazenamento privado', () => {
  const {request,fleet} = harness();
  assert.equal(request({action:'fleetLoad'}).ok,false);
  assert.equal(request({action:'fleetLoad'},'chave-inválida').code,'AUTH');
  const initial = request({action:'fleetLoad'},'manager');
  assert.equal(initial.version,0);
  const state = empty();
  state.drivers.push({id:'d01',name:'Condutor de teste',license:'CNH de teste'});
  state.vehicles.push({id:'v01',plate:'ABC1D23',model:'Modelo',status:'Disponível',driverId:'d01',
    crlv:'data:application/pdf;base64,JVBERg=='});
  const write = {action:'fleetSave',revision:0,state};
  assert.equal(request(write).ok,false);
  const saved = request(write,'manager');
  assert.equal(saved.version,1);
  assert.equal(saved.audit[0].actor,'gestor@voanet.com.br');
  assert.deepEqual(fleet[1],['Veículo','v01','v01','ABC1D23','Cadastro de veículo','','Disponível']);
  assert.equal(fleet.length,2);
  assert.doesNotMatch(JSON.stringify(fleet), /CNH|JVBERg|Condutor/);
  assert.equal(request(write,'manager').version,1);
  assert.deepEqual(request({action:'fleetLoad'},'manager').state.drivers,state.drivers);

  const next = structuredClone(state);
  next.vehicles[0].status='Indisponível';
  assert.equal(request({...write,state:next},'manager').code,'FLEET_CONFLICT');
  assert.equal(request({...write,revision:1,state:next},'manager').version,2);
  assert.equal(fleet[1][6],'Indisponível');
});

test('Frota rejeita conteúdo de anexo ativo e identificador impróprio', () => {
  const {request,fleet} = harness();
  const state = empty();
  state.vehicles.push({id:"id com ' aspas",model:'Teste',plate:'ABC1D23',status:'Disponível'});
  const write = {action:'fleetSave',revision:0,state};
  assert.match(request(write,'manager').error,/ID de frota inválido/);
  state.vehicles[0].id='v01';
  state.vehicles[0].crlv='data:image/svg+xml;base64,AAAA';
  assert.match(request(write,'manager').error,/Formato de anexo inválido/);
  assert.equal(fleet.length,1);
});

test('Frota repete uma gravação interrompida sem criar nova revisão', () => {
  const {c,request,props,fleet} = harness();
  const state = empty();
  state.vehicles.push({id:'v01',plate:'ABC1D23',model:'Teste',status:'Disponível'});
  const write = {action:'fleetSave',revision:0,state};
  const flush = c.SpreadsheetApp.flush;
  c.SpreadsheetApp.flush = () => { throw Error('Falha de simulação'); };
  assert.match(request(write,'manager').error,/Falha de simulação/);
  assert.ok(props.FLEET_PENDING);
  assert.equal(request({action:'fleetLoad'},'manager').version,0);
  c.SpreadsheetApp.flush = flush;
  assert.equal(request(write,'manager').version,1);
  assert.equal(props.FLEET_PENDING,undefined);
  assert.equal(fleet[1][1],'v01');
});
