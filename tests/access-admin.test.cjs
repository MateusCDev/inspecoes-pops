const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/gas.cjs');
test('somente Gestão lista pessoas e gera chaves; o cadastro novo é sempre Operação',()=>{
 const h=harness();assert.equal(h.request({action:'users'}).ok,false);assert.equal(h.request({action:'manageOperator',email:'novo@voanet.com.br',operation:'issue'}).ok,false);
 const issued=h.request({action:'manageOperator',email:'novo@voanet.com.br',operation:'issue'},'manager');assert.equal(issued.ok,true);assert.ok(issued.token);
 const profile=h.request({action:'session'},issued.token);assert.equal(profile.user.role,'OPERACAO');assert.equal(profile.user.email,'novo@voanet.com.br');
 assert.equal(JSON.stringify(h.request({action:'users'},'manager')).includes(issued.token),false);assert.equal(JSON.stringify(h.accessAudit).includes(issued.token),false);
});
test('reemissão invalida chave antiga e desativação preserva as inspeções',()=>{
 const h=harness();h.send(h.record());
 const issued=h.request({action:'manageOperator',email:'tecnico@voanet.com.br',operation:'issue'},'manager');assert.equal(issued.ok,true);assert.equal(h.request({action:'session'},'valid').code,'AUTH');assert.equal(h.request({action:'session'},issued.token).ok,true);
 assert.equal(h.request({action:'manageOperator',email:'tecnico@voanet.com.br',operation:'deactivate'},'manager').ok,true);
 assert.equal(h.request({action:'session'},issued.token).code,'AUTH');assert.equal(h.rows.length,2);assert.equal(h.request({action:'dashboard'},'manager').summary.total,1);
});
test('a interface de operadores não altera gestores nem promove um novo gestor',()=>{
 const h=harness();assert.equal(h.request({action:'manageOperator',email:'gestor@voanet.com.br',operation:'issue'},'manager').ok,false);
 assert.equal(h.request({action:'manageOperator',email:'novo@voanet.com.br',operation:'issue',role:'GESTAO'},'manager').ok,false);
 assert.equal(h.request({action:'manageOperator',email:'=formula@voanet.com.br',operation:'issue'},'manager').ok,false);
 assert.equal(h.request({action:'session'},'manager').user.role,'GESTAO');
});
