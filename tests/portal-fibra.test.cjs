const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/portal.js','utf8');
function make(role, query='') {
  const elements = {};
  function element(id) { return elements[id] ||= { hidden:false, dataset:{}, children:[], innerHTML:'', textContent:'', append(child){this.children.push(child);child.parent=this}, hasChildNodes(){return this.children.length>0}, replaceChildren(){this.children=[]}, addEventListener(){}, setAttribute(){}, removeAttribute(){}}; }
  const links=['central','inspecoes','frota','fttx','fibra'].map(name=>({dataset:{module:name}, hidden:false,setAttribute(){},removeAttribute(){}}));
  element('.portal-tabs').querySelectorAll=()=>links;
  element('.portal-tabs').querySelector=()=>null;
  const listeners={};
  const location={href:'https://mateuscdev.github.io/inspecoes-pops/'+query, origin:'https://mateuscdev.github.io', hash:''};
  const document={currentScript:{src:'https://mateuscdev.github.io/inspecoes-pops/portal.js?v=test'},body:{dataset:{}},getElementById:element,querySelector:element,addEventListener(type,cb){listeners[type]=cb},createElement(){return {remove(){this.removed=true},className:'',title:'',src:''}}};
  const context={document,location,URL,console,googleUser:role?{role,email:'teste@example.com'}:null,googleCentralBusy:false,googleCentralItems:[],googleCentralUpdated:false,googleSummary:null,records:[],esc:String,fmt:String,googleCentralStatus:()=>'',isGoogleMode:()=>true,mountFttx:()=>{},googleLogout:()=>{},history:{pushState(_a,_b,url){location.href=String(url)}},window:{scrollY:0,scrollTo(){},addEventListener(){}},Object};
  vm.runInNewContext(source,context);
  return {context,elements,links};
}
test('Fibra Import abre dentro da central para usuários autenticados',()=>{
 for(const role of ['GESTAO','OPERACAO']){
  const {elements,links}=make(role,'?modulo=fibra');
  const pane=elements['portal-fibra-pane'];
  assert.equal(pane.hidden,false);
  assert.equal(pane.children.length,1);
  assert.equal(pane.children[0].src,'https://mateuscdev.github.io/fibra-import/');
  assert.equal(elements.app.hidden,true);
  assert.equal(links.find(x=>x.dataset.module==='fibra').hidden,false);
 }
});
test('sem sessão, Fibra Import não é carregado dentro do portal',()=>{
 const {elements}=make(null,'?modulo=fibra');
 assert.equal(elements['portal-fibra-pane'].hidden,true);
 assert.equal(elements['portal-fibra-pane'].children.length,0);
 assert.equal(elements.app.hidden,false);
});
test('encerrar a sessão remove o módulo carregado',()=>{
 const {elements,context}=make('GESTAO','?modulo=fibra');
 const frame=elements['portal-fibra-pane'].children[0];
 context.googleUser=null;context.window.VOANET_PORTAL.refresh();
 assert.equal(frame.removed,true);
 assert.equal(elements['portal-fibra-pane'].hidden,true);
});
