const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/gas.cjs');
function catalogHarness(){
 const h=harness(),files=new Map();let writes=0,invited=false;
 const originalGet=h.c.DriveApp.getFileById;
 h.c.DriveApp.getFileById=id=>files.get(id)||originalGet(id);
 h.c.DriveApp.createFile=blob=>{writes++;let data=blob.getDataAsString();const file={getId:()=> 'private-catalog',getSharingAccess:()=>1,getViewers:()=>invited?[{}]:[],getEditors:()=>[],getBlob:()=>({getDataAsString:()=>data}),setContent(value){writes++;data=value;return file;}};files.set(file.getId(),file);return file;};
 return Object.assign(h,{catalogFiles:files,writes:()=>writes,inviteViewer:()=>invited=true});
}
const link=(id='LINK-12345678')=>({id,name:'Sistema interno',description:'Uso da gestão',category:'Sistemas',url:'https://interno.example.com/painel',icon:'',archived:false,darkIcon:false});
test('o catálogo nunca é entregue a uma chave inválida ou ao perfil Operação',()=>{
 const h=catalogHarness();
 assert.equal(h.request({action:'linkCatalogLoad'},'invalid').code,'AUTH');
 assert.equal(h.request({action:'linkCatalogLoad',role:'GESTAO'},'valid').ok,false);
 assert.equal(h.request({action:'linkCatalogSave',revision:0,items:[link()]},'valid').ok,false);
 assert.equal(h.writes(),0);
 const saved=h.request({action:'linkCatalogSave',revision:0,items:[link()]},'manager');
 assert.equal(saved.ok,true);assert.equal(saved.revision,1);
 const denied=h.request({action:'linkCatalogLoad'},'valid');
 assert.equal(denied.ok,false);assert.equal(JSON.stringify(denied).includes(link().url),false);
 assert.equal(h.request({action:'linkCatalogLoad'},'manager').items[0].url,link().url);
});
test('resposta interrompida não duplica gravação e versões antigas não sobrescrevem outro gestor',()=>{
 const h=catalogHarness(),first=h.request({action:'linkCatalogSave',revision:0,items:[link()]},'manager');
 assert.equal(first.revision,1);assert.equal(h.writes(),1);
 assert.equal(h.request({action:'linkCatalogSave',revision:0,items:[link()]},'manager').revision,1);assert.equal(h.writes(),1);
 const conflict=h.request({action:'linkCatalogSave',revision:0,items:[link(),link('LINK-ABCDEFGH')]},'manager');
 assert.equal(conflict.code,'CONFLICT');assert.equal(h.request({action:'linkCatalogLoad'},'manager').items.length,1);
});
test('arquivar e restaurar preserva o link sem apagar o registro',()=>{
 const h=catalogHarness();h.request({action:'linkCatalogSave',revision:0,items:[link()]},'manager');
 const archived=h.request({action:'linkCatalogSave',revision:1,items:[{...link(),archived:true}]},'manager');
 assert.equal(archived.items[0].archived,true);assert.equal(archived.items[0].url,link().url);
 const restored=h.request({action:'linkCatalogSave',revision:2,items:[link()]},'manager');assert.equal(restored.items[0].archived,false);
});
test('bloqueia endereços ativos, credenciais no endereço, SVG e identificadores repetidos',()=>{
 for(const patch of [{url:'javascript:alert(1)'},{url:'https://usuario:senha@site.example/'},{icon:'data:image/svg+xml;base64,PHN2Zz4='},{category:'Inválida'}]){
  const h=catalogHarness();assert.equal(h.request({action:'linkCatalogSave',revision:0,items:[{...link(),...patch}]},'manager').ok,false);assert.equal(h.writes(),0);
 }
 const h=catalogHarness();assert.equal(h.request({action:'linkCatalogSave',revision:0,items:[link(),link()]},'manager').ok,false);
});
test('convites diretos no Drive bloqueiam a leitura do catálogo pelo serviço',()=>{
 const h=catalogHarness();h.request({action:'linkCatalogSave',revision:0,items:[link()]},'manager');h.inviteViewer();
 assert.equal(h.request({action:'linkCatalogLoad'},'manager').ok,false);
});
