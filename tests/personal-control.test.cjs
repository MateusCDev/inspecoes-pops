const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/central-setor/app.js','utf8');
const code=source.slice(source.indexOf('function normalizeControlUrl'),source.indexOf('function safeLink'));
function profile(value){const context=vm.createContext({URL,CONTROL_KEY:'personal',localStorage:{getItem:()=>value}});vm.runInContext(code,context);return context;}
test('cada perfil resolve seu próprio controle e não existe um destino pessoal padrão para colegas',()=>{
 assert.equal(profile('https://docs.google.com/spreadsheets/d/PLANILHA_UM/edit').personalControl(),'https://docs.google.com/spreadsheets/d/PLANILHA_UM/edit');
 assert.equal(profile('https://docs.google.com/spreadsheets/d/PLANILHA_DOIS/edit').personalControl(),'https://docs.google.com/spreadsheets/d/PLANILHA_DOIS/edit');
 assert.equal(profile(null).personalControl(),'');
 const base=vm.runInNewContext(source.slice(0,source.indexOf('const categories='))+'baseAccesses');
 assert.equal(base.find(x=>x.personal).url,undefined);
});
test('preserva a aba e remove o seletor de conta sem aceitar outro domínio',()=>{
 const p=profile(null);assert.equal(p.normalizeControlUrl('https://docs.google.com/spreadsheets/u/2/d/PLANILHA/edit?authuser=2&gid=42#gid=42'),'https://docs.google.com/spreadsheets/d/PLANILHA/edit?gid=42#gid=42');
 for(const value of ['https://outro.example.com/planilha','javascript:alert(1)','https://p:s@docs.google.com/spreadsheets/d/ABC/edit'])assert.throws(()=>p.normalizeControlUrl(value));
 assert.equal(profile('javascript:alert(1)').personalControl(),'');
});
