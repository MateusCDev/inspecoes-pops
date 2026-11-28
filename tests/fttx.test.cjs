const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {structuredPrice,baixadaPrice}=require('../tools/refresh-fttx-prices.cjs');

function model(){
  const ctx=vm.createContext({document:{addEventListener(){}}});
  for(const file of ['fttx-catalog.js','fttx.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),ctx);
  }
  return ctx;
}

test('soma as reservas por bitola e calcula ferragens por poste sem duplicar plaquetas',()=>{
  const ctx=model();
  const result=ctx.calculateFttx({cables:{6:{meters:499},12:{meters:1000,cto:2,endCto:1,ceo:1}},
    poles:40,asPoles:30,ctoPoles:3,guidePoles:5,extraEyelets:4,dielectricGroups:2,cep:1,strand:210.5,
    extras:{'Duto PEAD':60.25}});
  const quantity=name=>result.groups.flatMap(group=>group.items).find(item=>item[0]===name)?.[2];
  assert.equal(result.reserveTotal,176.5);
  assert.equal(result.cableTotal,1675.5);
  assert.equal(result.cables[0].routeReserve,0);
  assert.equal(quantity('Olhal reto M12'),7);
  assert.equal(quantity('Plaqueta de identificação do cabo'),40);
  assert.equal(quantity('Abraçadeira BAP'),30);
  assert.equal(quantity('Anel guia AGFE para postes sem CTO e sem BAP'),10);
  assert.equal(quantity('Fita de aço 3/4″ para postes sem CTO e sem BAP'),7.5);
  assert.equal(quantity('Suporte dielétrico'),2);
  assert.equal(quantity('Fecho de aço 3/4″'),6);
  assert.equal(quantity('Anel guia AGFE'),18);
  assert.equal(quantity('Conjunto de reserva técnica para caixa de emenda'),2);
  assert.equal(quantity('Alça pré-formada para cordoalha'),2);
  assert.equal(quantity('Cordoalha'),210.5);
  assert.equal(quantity('Duto PEAD'),60.25);
  assert.equal(result.alerts.length,0);
});

test('sinaliza postes inconsistentes e não estima preço ausente como zero',()=>{
  const ctx=model();
  assert.ok(ctx.calculateFttx({poles:8,asPoles:6,guidePoles:3}).alerts.length);
  assert.equal(ctx.fttxEstimate('Item sem preço',2).cents,null);
  vm.runInContext("fttxReferences={Cabo:{price:1.2345,store:'Fornecedor'}}; fttxDraft.prices={Cabo:'2'};",ctx);
  assert.equal(ctx.fttxEstimate('Cabo',15.5).cents,3100);
  vm.runInContext('delete fttxDraft.prices.Cabo;',ctx);
  assert.equal(ctx.fttxEstimate('Cabo',15.5).cents,1913);
});

test('usa somente a oferta em BRL, em estoque e da página do produto correto',()=>{
  const product='https://example.test/produtos/cabo';
  const build=(url,currency,stock,price)=>'<script type="application/ld+json">'+
    JSON.stringify({'@type':'Product',offers:{url,price,priceCurrency:currency,availability:'https://schema.org/'+stock}})+'</script>';
  const html=build('https://example.test/relacionado','BRL','InStock',1)+
    build(product,'USD','InStock',20)+build(product,'BRL','OutOfStock',30)+build(product,'BRL','InStock',50);
  assert.equal(structuredPrice(html,product),50);
  assert.equal(structuredPrice(build(product,'BRL','OutOfStock',20),product),null);
  const sample='<div class="codigo estoque"><i>Em estoque</i></div><span class="precoCor">R$ 1.234,56</span><div class="comprar foo">';
  assert.equal(baixadaPrice(sample),1234.56);
  assert.equal(baixadaPrice(sample.replace('codigo estoque','codigo semestoque')),null);
});

test('detalha CTOs por capacidade, calcula portas e inclui splitters/adaptadores no modo CTO vazia',()=>{
  const ctx=model();
  const emptyMode=ctx.calculateFttx({
    cables:{12:{meters:500,cto:4,endCto:2}},
    poles:20,ctoPoles:6,
    cto8:2,cto16:3,ctoPre16:1,ctoAssembly:'vazia'
  });
  const qty=name=>emptyMode.groups.flatMap(g=>g.items).find(i=>i[0]===name)?.[2];
  assert.equal(emptyMode.ctoTotal,6);
  assert.equal(emptyMode.ctoPorts,2*8+3*16+1*16);
  assert.equal(qty('CTO 1:8 (8 portas)'),2);
  assert.equal(qty('CTO 1:16 (16 portas)'),3);
  assert.equal(qty('CTO pré-conectorizada 1:16'),1);
  assert.equal(qty('CTO'),undefined);
  assert.equal(qty('Splitter 1:8 conectorizado SC/APC'),2);
  assert.equal(qty('Splitter 1:16 conectorizado SC/APC'),3);
  assert.equal(qty('Adaptador SC/APC'),2*8+3*16);
  assert.equal(emptyMode.alerts.length,0);

  const mountedMode=ctx.calculateFttx({
    cables:{12:{meters:500,cto:4,endCto:2}},
    poles:20,ctoPoles:6,
    cto8:2,cto16:3,ctoPre16:1,ctoAssembly:'montada'
  });
  const mountedQty=name=>mountedMode.groups.flatMap(g=>g.items).find(i=>i[0]===name)?.[2];
  assert.equal(mountedQty('Splitter 1:8 conectorizado SC/APC'),undefined);
  assert.equal(mountedQty('Adaptador SC/APC'),undefined);

  const mismatch=ctx.calculateFttx({
    cables:{12:{meters:500,cto:4}},
    poles:10,ctoPoles:4,cto8:2,cto16:1
  });
  assert.ok(mismatch.alerts.some(msg=>/soma das CTOs por capacidade/.test(msg)));
});

test('suporta todos os splitters conectorizados, sem conector, desbalanceados, CEOs e cabos 48/72 FO',()=>{
  const ctx=model();
  const result=ctx.calculateFttx({
    cables:{48:{meters:1000,ceo:2},72:{meters:500,ceo:1}},
    poles:30,loop48:10,loop72:6,
    ceo24:1,ceo48:2,
    splitConn2:2,splitConn4:1,splitConn8:3,splitConn16:2,splitConn32:1,
    split2:1,split4:2,split8:1,split16:1,split32:1,
    splitUnb10:2,splitUnbConn20:3
  });
  const qty=name=>result.groups.flatMap(g=>g.items).find(i=>i[0]===name)?.[2];
  assert.equal(qty('Cabo óptico 48 FO'),1140);
  assert.equal(qty('Cabo óptico 72 FO'),570);
  assert.equal(qty('Alça pré-formada para cabo de 48 FO'),10);
  assert.equal(qty('Alça pré-formada para cabo de 72 FO'),6);
  assert.equal(qty('CEO 24 FO'),1);
  assert.equal(qty('CEO 48 FO'),2);
  assert.equal(qty('Splitter 1:2 conectorizado SC/APC'),2);
  assert.equal(qty('Splitter 1:4 conectorizado SC/APC'),1);
  assert.equal(qty('Splitter 1:8 conectorizado SC/APC'),3);
  assert.equal(qty('Splitter 1:16 conectorizado SC/APC'),2);
  assert.equal(qty('Splitter 1:32 conectorizado SC/APC'),1);
  assert.equal(qty('Splitter 1:2 sem conector'),1);
  assert.equal(qty('Splitter 1:4 sem conector'),2);
  assert.equal(qty('Splitter 1:32 sem conector'),1);
  assert.equal(qty('Splitter desbalanceado 10/90 sem conector'),2);
  assert.equal(qty('Splitter desbalanceado 20/80 conectorizado SC/APC'),3);
  assert.equal(result.alerts.length,0);

  // Referência de preço reaproveitada para nomes padronizados
  vm.runInContext("fttxReferences={'Splitter 1:8':{price:32.9,store:'Loja'},'CEO':{price:166.58,store:'Loja'},'CTO':{price:96.9,store:'Loja'}}; fttxDraft={ctoAssembly:'vazia'};",ctx);
  assert.equal(ctx.fttxEstimate('Splitter 1:8 sem conector',2).unit,32.9);
  assert.equal(ctx.fttxEstimate('CEO 24 FO',1).unit,166.58);
  assert.equal(ctx.fttxEstimate('CTO 1:16 (16 portas)',1).unit,96.9);
  vm.runInContext("fttxDraft={ctoAssembly:'montada'};",ctx);
  assert.equal(ctx.fttxEstimate('CTO 1:16 (16 portas)',1).unit,null);

  // Validação de soma de CEOs e estimativa de tubetes
  const ceoMismatch=ctx.calculateFttx({cables:{48:{meters:500,ceo:2}},poles:10,ceo24:1});
  assert.ok(ceoMismatch.alerts.some(msg=>/soma das CEOs por capacidade/.test(msg)));
  assert.equal(ctx.fttxEstimatedSleeves({cables:{12:{cto:2,ceo:1}},split8:1,splitUnb10:1}),9+3+12+4);
});
