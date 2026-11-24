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
