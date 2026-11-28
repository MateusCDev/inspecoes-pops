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
  // 6 FO (2 pontas) + 12 FO (2 pontas + 2*2 CTOs + 1 ponta + 2 CEO) + 4 extras = 15
  assert.equal(quantity('Olhal reto M12'),15);
  assert.equal(quantity('Alça pré-formada para cabo de 06 a 12 FO'),15);
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

test('calcula orçamento óptico GPON/XGS-PON, cascata desbalanceada e aviso não bloqueante',()=>{
  const ctx=model();
  const okBudget=ctx.calculateOpticalBudget({
    optClass:'gpon_c',optDistanceKm:3,optSplit1:'1:8',optSplit2:'1:16',
    optSplices:6,optConnectors:4,optMargin:3
  });
  assert.equal(okBudget.active,true);
  assert.equal(okBudget.fiberLossDb,1.05);
  assert.equal(okBudget.split1Db,10.5);
  assert.equal(okBudget.split2Db,13.8);
  assert.equal(okBudget.passiveDb,2.6);
  assert.equal(okBudget.rawLossDb,27.95);
  assert.equal(okBudget.totalLossDb,30.95);
  assert.equal(okBudget.headroomDb,1.05);
  assert.equal(okBudget.rxPowerDbm,-24.95);
  assert.equal(okBudget.status,'ok');

  const cascadeBudget=ctx.calculateOpticalBudget({
    optClass:'gpon_cpp',optDistanceKm:2,optSplit1:'10/90',optSplit2:'1:8',
    optCascadeCount:3,optCascadeRatio:'10/90',optSplices:4,optConnectors:4,optMargin:3
  });
  assert.equal(cascadeBudget.cascadeDb,2.1);
  assert.equal(cascadeBudget.status,'ok');

  const failResult=ctx.calculateFttx({
    cables:{12:{meters:4000,cto:2}},poles:80,ctoPoles:2,
    optClass:'gpon_b',optSplit1:'1:8',optSplit2:'1:16',optSplices:8,optConnectors:4,optMargin:3
  });
  assert.equal(failResult.optical.status,'fail');
  assert.equal(failResult.alerts.length,0);
  assert.ok(failResult.warnings.some(w=>/Orçamento óptico acima do limite/.test(w.text)));
});

test('dimensiona portas PON, valida vão médio, fecho de poste guia e contingência em ferragens',()=>{
  const ctx=model();
  const base=ctx.calculateFttx({
    cables:{12:{meters:1200,cto:6}},poles:24,asPoles:18,ctoPoles:6,guidePoles:6,
    cto16:6,ponRatio:'64',includeGuideBuckle:true,contingencyPct:10,
    splitConn8:2,bolt:20,sleeve:50
  });
  const qty=name=>base.groups.flatMap(g=>g.items).find(i=>i[0]===name)?.[2];
  assert.equal(base.ctoPorts,96);
  assert.equal(base.ponRatio,64);
  assert.equal(base.ponPortsNeeded,2);
  assert.equal(base.avgSpan,50);
  assert.equal(base.warnings.length,0);
  // Ferragens e consumíveis recebem +10%, enquanto cabo, CTO e splitter mantêm quantidade exata
  assert.equal(qty('Cabo óptico 12 FO'),1200+6*22+100);
  assert.equal(qty('CTO 1:16 (16 portas)'),6);
  assert.equal(qty('Splitter 1:8 conectorizado SC/APC'),2);
  assert.equal(qty('Parafuso'),22);
  assert.equal(qty('Tubete protetor de emenda'),55);
  assert.equal(qty('Fecho de aço 3/4″ para postes sem CTO e sem BAP'),7);

  const highDensity=ctx.calculateFttx({cables:{12:{meters:1000,cto:6}},poles:20,ctoPoles:6,cto16:6,ponRatio:'128'});
  assert.equal(highDensity.ponPortsNeeded,1);

  const longSpan=ctx.calculateFttx({cables:{12:{meters:900}},poles:10});
  assert.equal(longSpan.avgSpan,90);
  assert.ok(longSpan.warnings.some(w=>/supera 80 m/.test(w.text)));

  const shortSpan=ctx.calculateFttx({cables:{12:{meters:100}},poles:10});
  assert.equal(shortSpan.avgSpan,10);
  assert.ok(shortSpan.warnings.some(w=>/abaixo de 15 m/.test(w.text)));
});

test('estima ferragens pelo trajeto e converte quantidades para embalagens de almoxarifado',()=>{
  const ctx=model();
  const patch=ctx.fttxEstimateHardware({
    poles:30,asPoles:25,dielectricGroups:4,
    cables:{12:{meters:800,cto:3,endCto:1},24:{meters:500,ceo:2}}
  });
  assert.deepEqual({...patch},{
    bolt:25,bapSupport:25,extraEyelets:8,
    loopSmall:2*3+1+2,
    loop24:2*2+2
  });

  assert.equal(ctx.fttxPackSummary('Cabo óptico 12 FO',2500),'≈ 2 bobinas de 2.000 m');
  assert.equal(ctx.fttxPackSummary('Fita de aço 3/4″',25),'≈ 1 rolo de 25 m');
  assert.equal(ctx.fttxPackSummary('Fita de aço 3/4″ para postes sem CTO e sem BAP',26),'≈ 2 rolos de 25 m');
  assert.equal(ctx.fttxPackSummary('Fecho de aço 3/4″ para postes sem CTO e sem BAP',10),'≈ 1 pacote de 100 un');
  assert.equal(ctx.fttxPackSummary('Tubete protetor de emenda',150),'≈ 2 pacotes de 100 un');
  assert.equal(ctx.fttxPackSummary('CTO 1:16 (16 portas)',4),'');
});

test('importa KML com cabos por bitola, postes, CTOs comuns/ponta, CEO e CEP',()=>{
  const ctx=model();
  const kml=`<?xml version="1.0" encoding="UTF-8"?>
  <kml><Document>
    <Folder><name>Cabos 24 FO Backbone</name>
      <Placemark><name>Trecho Principal</name><LineString><coordinates>-46.633308,-23.550520,0 -46.633308,-23.559513,0</coordinates></LineString></Placemark>
    </Folder>
    <Folder><name>Distribuição</name>
      <Placemark><name>Cabo 12FO Rua A</name><LineString><coordinates>-46.633308,-23.550520,0 -46.638200,-23.550520,0</coordinates></LineString></Placemark>
    </Folder>
    <Folder><name>Postes</name>
      <Placemark><name>P-01</name><Point><coordinates>-46.6333,-23.5505,0</coordinates></Point></Placemark>
      <Placemark><name>P-02</name><Point><coordinates>-46.6333,-23.5510,0</coordinates></Point></Placemark>
    </Folder>
    <Folder><name>Caixas</name>
      <Placemark><name>CTO-01</name><Point><coordinates>-46.6333,-23.5515,0</coordinates></Point></Placemark>
      <Placemark><name>CTO-02 Ponta</name><Point><coordinates>-46.6333,-23.5520,0</coordinates></Point></Placemark>
      <Placemark><name>CEO-01 48FO</name><Point><coordinates>-46.6333,-23.5525,0</coordinates></Point></Placemark>
      <Placemark><name>CEP-01</name><Point><coordinates>-46.6333,-23.5530,0</coordinates></Point></Placemark>
    </Folder>
  </Document></kml>`;
  const parsed=ctx.parseFttxKml(kml);
  assert.equal(parsed.lineCount,2);
  assert.ok(parsed.cables[24]>990&&parsed.cables[24]<1010);
  assert.ok(parsed.cables[12]>490&&parsed.cables[12]<510);
  assert.equal(parsed.poles,2);
  assert.equal(parsed.cto,1);
  assert.equal(parsed.endCto,1);
  assert.equal(parsed.ceo,1);
  assert.equal(parsed.cep,1);
});

test('calcula alças pré-formadas automaticamente na construção, aceita ajuste manual e resolve referências de CTO/plaqueta',()=>{
  const ctx=model();
  const auto=ctx.calculateFttx({
    cables:{12:{meters:800,cto:3,endCto:1},24:{meters:500,ceo:2}},
    poles:26,ctoPoles:4,extraEyelets:2
  });
  const qty=res=>name=>res.groups.flatMap(g=>g.items).find(i=>i[0]===name)?.[2];
  // 12 FO (dominante): 2*3 + 1 + 2 (pontas) + 2 (olhais extras) = 11; 24 FO: 2*2 + 2 = 6; Olhais totais = 17
  assert.equal(qty(auto)('Alça pré-formada para cabo de 06 a 12 FO'),11);
  assert.equal(qty(auto)('Alça pré-formada para cabo de 24 FO'),6);
  assert.equal(qty(auto)('Olhal reto M12'),17);

  // Sobrescrita manual prevalece (inclusive 0 explícito)
  const manual=ctx.calculateFttx({
    cables:{12:{meters:800,cto:3}},poles:20,ctoPoles:3,loopSmall:'20'
  });
  assert.equal(qty(manual)('Alça pré-formada para cabo de 06 a 12 FO'),20);

  // Desativando automático sem preencher gera aviso não bloqueante
  const noLoops=ctx.calculateFttx({cables:{12:{meters:500}},poles:10,autoLoops:false});
  assert.equal(qty(noLoops)('Alça pré-formada para cabo de 06 a 12 FO'),undefined);
  assert.equal(noLoops.alerts.length,0);
  assert.ok(noLoops.warnings.some(w=>/Nenhuma alça pré-formada/.test(w.text)));

  // Referências de plaquetas e CTO montada vs vazia
  vm.runInContext(`fttxReferences={
    'Plaqueta de identificação do cabo':{price:1.33,store:'Loja'},
    'CTO':{price:96.9,store:'Loja'},
    'CTO 1:16 (16 portas)':{price:131.91,store:'Loja'}
  }; fttxDraft={ctoAssembly:'montada'};`,ctx);
  assert.equal(ctx.fttxEstimate('Plaqueta de CTO',2).unit,1.33);
  assert.equal(ctx.fttxEstimate('Plaqueta de caixa de emenda',1).unit,1.33);
  assert.equal(ctx.fttxEstimate('CTO 1:16 (16 portas)',1).unit,131.91);
  vm.runInContext("fttxDraft={ctoAssembly:'vazia'};",ctx);
  assert.equal(ctx.fttxEstimate('CTO 1:16 (16 portas)',1).unit,96.9);
  assert.equal(ctx.fttxEstimate('CTO 1:8 (8 portas)',1).unit,96.9);
});
