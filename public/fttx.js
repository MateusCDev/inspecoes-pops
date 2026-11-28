'use strict';

const FTTX_FIBERS=[6,12,24,36,48,72];
const FTTX_STEPS=[
  ['Lançamento','fttx-project-heading'],
  ['CTO','fttx-cto-heading'],
  ['CEO / CEP','fttx-box-heading'],
  ['Revisão e exportação','fttx-list-heading']
];
const FTTX_CABLE_FIELDS=[['meters','Cabo lançado (m)'],['cto','CTOs comuns'],['endCto','CTOs de ponta'],['ceo','CEOs']];
const FTTX_ROUTE_FIELDS=[
  ['poles','Postes no trajeto','Conte cada poste uma vez. O sistema inclui uma plaqueta de cabo por poste.'],
  ['asPoles','Postes com cabo AS','Conte os postes com cabo autossustentado (AS). O sistema inclui uma abraçadeira BAP por poste.']
];
const FTTX_ROUTE_DETAILS=[
  ['guidePoles','Postes com guia, sem CTO e sem BAP','Inclui 2 anéis guia e 1,5 m de fita de aço por poste informado.'],
  ['dielectricGroups','Grupos de três postes aptos para dielétrico','Informe um grupo por suporte, com olhal nas pontas e dielétrico no meio. Confira curvas, vegetação e vãos longos.'],
  ['extraEyelets','Olhais adicionais','Some os demais olhais nas curvas, cruzamentos e pontas dos grupos dielétricos. O sistema já inclui automaticamente 2 olhais nas pontas de cada cabo, 2 por CTO comum, 1 por CTO de ponta e 2 por CEO.'],
  ['bolt','Parafusos','Informe quantos serão usados na montagem prevista.'],
  ['bapSupport','Suportes para BAP','Conte os suportes conforme os pontos de fixação do trajeto.']
];
const FTTX_LOOP_FIELDS=[
  ['loopSmall','Alças pré-formadas de 06 a 12 FO','Ancoragem para cabos de 6 a 12 fibras (ex.: ASU80 6,4–7,4 mm).'],
  ['loop24','Alças pré-formadas de 24 FO','Ancoragem para cabo de 24 fibras (ex.: AS80 9,4–10,1 mm).'],
  ['loop36','Alças pré-formadas de 36 FO','Ancoragem para cabo de 36 fibras (ex.: AS80 10,8–11,6 mm).'],
  ['loop48','Alças pré-formadas de 48 FO','Ancoragem para cabo de 48 fibras.'],
  ['loop72','Alças pré-formadas de 72 FO','Ancoragem para cabo de 72 fibras (ex.: AS80 12,4–13,5 mm).']
];
const FTTX_CTO_MODELS=[
  ['cto8','CTO 1:8 (8 portas)',8,false],
  ['cto16','CTO 1:16 (16 portas)',16,false],
  ['cto24','CTO 1:24 (24 portas)',24,false],
  ['ctoPre8','CTO pré-conectorizada 1:8',8,true],
  ['ctoPre16','CTO pré-conectorizada 1:16',16,true]
];
const FTTX_CEO_MODELS=[
  ['ceo24','CEO 24 FO'],
  ['ceo48','CEO 48 FO'],
  ['ceo72','CEO 72 FO'],
  ['ceo144','CEO 144 FO']
];
const FTTX_SPLITTERS_CONNECTORIZED=[
  ['splitConn2','Splitter 1:2 conectorizado SC/APC',3],
  ['splitConn4','Splitter 1:4 conectorizado SC/APC',5],
  ['splitConn8','Splitter 1:8 conectorizado SC/APC',9],
  ['splitConn16','Splitter 1:16 conectorizado SC/APC',17],
  ['splitConn32','Splitter 1:32 conectorizado SC/APC',33]
];
const FTTX_SPLITTERS_BARE=[
  ['split2','Splitter 1:2 sem conector',3],
  ['split4','Splitter 1:4 sem conector',5],
  ['split8','Splitter 1:8 sem conector',9],
  ['split16','Splitter 1:16 sem conector',17],
  ['split32','Splitter 1:32 sem conector',33]
];
const FTTX_UNBALANCED_RATIOS=['5/95','10/90','15/85','20/80','30/70','40/60','50/50'];
const FTTX_SPLITTERS_UNBALANCED_BARE=FTTX_UNBALANCED_RATIOS.map(ratio=>[
  'splitUnb'+ratio.split('/')[0],`Splitter desbalanceado ${ratio} sem conector`,3
]);
const FTTX_SPLITTERS_UNBALANCED_CONN=FTTX_UNBALANCED_RATIOS.map(ratio=>[
  'splitUnbConn'+ratio.split('/')[0],`Splitter desbalanceado ${ratio} conectorizado SC/APC`,3
]);
const FTTX_BOX_FIELDS=[
  ['cep','CEPs','Informe as caixas de emenda de passagem previstas.'],
  ['tray','Bandejas de emenda','Some as bandejas previstas nas caixas.'],
  ['strand','Cordoalha medida no projeto (m)','Estime a metragem no traçado considerando os pontos previstos a cada 100 m.'],
  ['sleeve','Tubetes protetores de emenda','Conte os protetores das emendas previstas (ou use o atalho de estimativa).'],
  ['blanket','Mantas para CEO','Some as mantas previstas para as caixas de emenda.']
];

const FTTX_OPTICAL_CLASSES={
  gpon_b:{label:'GPON B+ (28 dB)',budgetDb:28,txMinDbm:1.5,rxSensDbm:-28},
  gpon_c:{label:'GPON C+ (32 dB)',budgetDb:32,txMinDbm:3.0,rxSensDbm:-30},
  gpon_cpp:{label:'GPON C++ (35 dB)',budgetDb:35,txMinDbm:6.0,rxSensDbm:-32},
  xgs_n1:{label:'XGS-PON N1 (29 dB)',budgetDb:29,txMinDbm:2.0,rxSensDbm:-28},
  xgs_n2:{label:'XGS-PON N2 (31 dB)',budgetDb:31,txMinDbm:4.0,rxSensDbm:-28}
};
const FTTX_OPTICAL_SPLITS=[
  ['none','Nenhum (0 dB)',0],
  ['1:2','Balanceado 1:2 (3,7 dB)',3.7],
  ['1:4','Balanceado 1:4 (7,3 dB)',7.3],
  ['1:8','Balanceado 1:8 (10,5 dB)',10.5],
  ['1:16','Balanceado 1:16 (13,8 dB)',13.8],
  ['1:32','Balanceado 1:32 (17,2 dB)',17.2],
  ['1:64','Balanceado 1:64 (20,5 dB)',20.5],
  ['5/95','Desbalanceado 5/95 · saída 5% (14,0 dB)',14.0],
  ['10/90','Desbalanceado 10/90 · saída 10% (10,8 dB)',10.8],
  ['15/85','Desbalanceado 15/85 · saída 15% (8,9 dB)',8.9],
  ['20/80','Desbalanceado 20/80 · saída 20% (7,6 dB)',7.6],
  ['30/70','Desbalanceado 30/70 · saída 30% (5,8 dB)',5.8],
  ['40/60','Desbalanceado 40/60 · saída 40% (4,5 dB)',4.5],
  ['50/50','Desbalanceado 50/50 (3,7 dB)',3.7]
];
const FTTX_CASCADE_THRU_DB={
  '5/95':0.45,'10/90':0.70,'15/85':0.95,'20/80':1.25,'30/70':1.90,'40/60':2.65,'50/50':3.70
};
const FTTX_CONTINGENCY_ITEMS=new Set([
  'Olhal reto M12','Parafuso','Suporte para BAP','Suporte dielétrico',
  'Alça pré-formada para cabo de 06 a 12 FO','Alça pré-formada para cabo de 24 FO',
  'Alça pré-formada para cabo de 36 FO','Alça pré-formada para cabo de 48 FO',
  'Alça pré-formada para cabo de 72 FO','Alça pré-formada para cordoalha',
  'Plaqueta de identificação do cabo','Plaqueta de CTO','Plaqueta de caixa de emenda',
  'Anel guia AGFE','Anel guia AGFE para postes sem CTO e sem BAP',
  'Fita de aço 3/4″','Fita de aço 3/4″ para postes sem CTO e sem BAP',
  'Fecho de aço 3/4″','Fecho de aço 3/4″ para postes sem CTO e sem BAP',
  'Abraçadeira BAP','Tubete protetor de emenda',
  'Manta para CEO','Adaptador SC/APC'
]);
const FTTX_PACK_RULES=[
  [/^Cabo óptico /,2000,'bobina','bobinas','2.000 m'],
  [/^Fita de aço 3\/4″/,25,'rolo','rolos','25 m'],
  [/^Fecho de aço 3\/4″/,100,'pacote','pacotes','100 un'],
  [/^(?:Parafuso|Suporte para BAP|Suporte dielétrico)$/,10,'pacote','pacotes','10 un'],
  [/^Alça pré-formada para cordoalha$/,100,'pacote','pacotes','100 un'],
  [/^Cordoalha$/,500,'rolo','rolos','500 m'],
  [/^Tubete protetor de emenda$/,100,'pacote','pacotes','100 un']
];

const fttxQuantityFormat=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const fttxCurrency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fttxUnitPrice=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:4});
let fttxDraft={},fttxDraftKey='',fttxSaveError=false;
let fttxReferences={},fttxReferenceStatus='Consultando referências públicas…';

function fttxQuantity(value,decimal=false){
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0)return 0;
  return decimal?Math.round((number+Number.EPSILON)*100)/100:Math.floor(number);
}

function fttxPackSummary(name,quantity){
  if(!Number.isFinite(quantity)||quantity<=0)return '';
  for(const [pattern,size,singular,plural,sizeLabel] of FTTX_PACK_RULES){
    if(pattern.test(name)){
      const packs=Math.ceil(quantity/size);
      return `≈ ${packs} ${packs===1?singular:plural} de ${sizeLabel}`;
    }
  }
  return '';
}

function fttxApplyContingency(name,unit,qty,pct){
  if(!pct||qty<=0||!FTTX_CONTINGENCY_ITEMS.has(name))return qty;
  if(unit==='un')return Math.ceil(Math.round(qty*(100+pct))/100);
  return Math.round((qty*(100+pct))/10+Number.EPSILON)/10;
}

function calculateOpticalBudget(draft,routeTotal=0){
  const classKey=Object.hasOwn(FTTX_OPTICAL_CLASSES,draft.optClass)?draft.optClass:'gpon_c';
  const cls=FTTX_OPTICAL_CLASSES[classKey];
  const split1Key=draft.optSplit1||'none';
  const split2Key=draft.optSplit2||'none';
  const cascadeCount=fttxQuantity(draft.optCascadeCount);
  const cascadeRatio=Object.hasOwn(FTTX_CASCADE_THRU_DB,draft.optCascadeRatio)?draft.optCascadeRatio:'10/90';
  const customKm=fttxQuantity(draft.optDistanceKm,true);
  const active=split1Key!=='none'||split2Key!=='none'||cascadeCount>0||customKm>0;
  const distanceKm=customKm>0?customKm:Math.round((routeTotal/1000)*100)/100;
  const splitLoss=key=>FTTX_OPTICAL_SPLITS.find(([id])=>id===key)?.[2]??0;
  const splices=draft.optSplices===''||draft.optSplices===undefined?6:fttxQuantity(draft.optSplices);
  const connectors=draft.optConnectors===''||draft.optConnectors===undefined?4:fttxQuantity(draft.optConnectors);
  const marginDb=draft.optMargin===''||draft.optMargin===undefined?3:fttxQuantity(draft.optMargin,true);
  const fiberLossDb=Math.round(distanceKm*0.35*100)/100;
  const split1Db=splitLoss(split1Key);
  const split2Db=splitLoss(split2Key);
  const cascadeDb=Math.round(cascadeCount*(FTTX_CASCADE_THRU_DB[cascadeRatio]||0)*100)/100;
  const passiveDb=Math.round((splices*0.1+connectors*0.5)*100)/100;
  const rawLossDb=Math.round((fiberLossDb+split1Db+split2Db+cascadeDb+passiveDb)*100)/100;
  const totalLossDb=Math.round((rawLossDb+marginDb)*100)/100;
  const rxPowerDbm=Math.round((cls.txMinDbm-rawLossDb)*100)/100;
  const headroomDb=Math.round((cls.budgetDb-totalLossDb)*100)/100;
  const status=headroomDb>=1?'ok':headroomDb>=0?'warn':'fail';
  const statusLabel=status==='ok'?'Aprovado':status==='warn'?'No limite':'Acima do limite';
  return {
    active,classKey,classLabel:cls.label,budgetDb:cls.budgetDb,distanceKm,
    fiberLossDb,split1Db,split2Db,cascadeDb,passiveDb,marginDb,
    rawLossDb,totalLossDb,rxPowerDbm,headroomDb,status,statusLabel
  };
}

function fttxEstimatedSleeves(draft){
  const get=field=>fttxQuantity(draft[field]);
  const ceoTotal=FTTX_FIBERS.reduce((sum,fibers)=>sum+fttxQuantity(draft.cables?.[fibers]?.ceo),0);
  const ctoTotal=FTTX_FIBERS.reduce((sum,fibers)=>sum+fttxQuantity(draft.cables?.[fibers]?.cto)+fttxQuantity(draft.cables?.[fibers]?.endCto),0);
  const preCto=get('ctoPre8')+get('ctoPre16');
  const bareSplitSplices=[...FTTX_SPLITTERS_BARE,...FTTX_SPLITTERS_UNBALANCED_BARE]
    .reduce((sum,[field,,splices])=>sum+get(field)*splices,0);
  const conventionalCto=Math.max(0,ctoTotal-preCto);
  return bareSplitSplices+12*ceoTotal+2*conventionalCto;
}

function fttxAutoLoops(draft){
  const loopMap={6:'loopSmall',12:'loopSmall',24:'loop24',36:'loop36',48:'loop48',72:'loop72'};
  const loops={loopSmall:0,loop24:0,loop36:0,loop48:0,loop72:0};
  let dominantField='',maxMeters=-1;
  for(const fibers of FTTX_FIBERS){
    const row=draft.cables?.[fibers]||{};
    const meters=fttxQuantity(row.meters,true),cto=fttxQuantity(row.cto),endCto=fttxQuantity(row.endCto),ceo=fttxQuantity(row.ceo);
    if(meters>0||cto>0||endCto>0||ceo>0){
      const anchors=2*cto+endCto+2*ceo+(meters>0?2:0);
      const field=loopMap[fibers];
      loops[field]+=anchors;
      if(meters>maxMeters){maxMeters=meters;dominantField=field;}
    }
  }
  const extraEyelets=fttxQuantity(draft.extraEyelets);
  if(extraEyelets>0&&dominantField)loops[dominantField]+=extraEyelets;
  return loops;
}

function fttxEstimateHardware(draft){
  const get=field=>fttxQuantity(draft[field]);
  const asPoles=get('asPoles')||get('poles');
  const dielectricGroups=get('dielectricGroups');
  const patch={};
  if(asPoles>0){
    patch.bolt=asPoles;
    patch.bapSupport=asPoles;
  }
  if(dielectricGroups>0)patch.extraEyelets=2*dielectricGroups;
  const loops=fttxAutoLoops(draft);
  for(const [field,val] of Object.entries(loops)){
    if(val>0)patch[field]=val;
  }
  return patch;
}

function calculateFttx(draft){
  let ctoTotal=0,ceoTotal=0,cableTotal=0,reserveTotal=0,routeTotal=0,cableAnchors=0;
  const cables=FTTX_FIBERS.map(fibers=>{
    const row=draft.cables?.[fibers]||{};
    const meters=fttxQuantity(row.meters,true),cto=fttxQuantity(row.cto),endCto=fttxQuantity(row.endCto),ceo=fttxQuantity(row.ceo);
    const ctoReserve=22*cto+12.5*endCto,ceoReserve=20*ceo,routeReserve=50*Math.floor(meters/500);
    const reserve=ctoReserve+ceoReserve+routeReserve;
    const total=fttxQuantity(meters+reserve,true);
    if(meters>0||cto>0||endCto>0||ceo>0)cableAnchors+=2*cto+endCto+2*ceo+(meters>0?2:0);
    ctoTotal+=cto+endCto;
    ceoTotal+=ceo;
    routeTotal+=meters;
    reserveTotal+=reserve;
    cableTotal+=total;
    return {fibers,meters,ctoReserve,ceoReserve,routeReserve,reserve,total};
  });
  const get=(field,decimal)=>fttxQuantity(draft[field],decimal);
  const cep=get('cep'),guidePoles=get('guidePoles'),poles=get('poles'),ctoPoles=get('ctoPoles'),asPoles=get('asPoles');
  const contingencyPct=[5,10].includes(Number(draft.contingencyPct))?Number(draft.contingencyPct):0;
  const includeGuideBuckle=draft.includeGuideBuckle===true||draft.includeGuideBuckle==='true';
  const autoLoops=draft.autoLoops!==false&&draft.autoLoops!=='false';
  const estimatedLoops=fttxAutoLoops(draft);
  const loopQty=field=>{
    const raw=draft[field];
    if(raw!==undefined&&raw!==null&&String(raw).trim()!=='')return get(field);
    return autoLoops?estimatedLoops[field]:0;
  };
  const resolvedLoops={
    loopSmall:loopQty('loopSmall'),loop24:loopQty('loop24'),loop36:loopQty('loop36'),
    loop48:loopQty('loop48'),loop72:loopQty('loop72')
  };
  const totalCableLoops=Object.values(resolvedLoops).reduce((sum,val)=>sum+val,0);

  const ctoBreakdown=FTTX_CTO_MODELS.map(([field,label,ports,pre])=>({field,label,ports,pre,qty:get(field)}));
  const ctoTypedTotal=ctoBreakdown.reduce((sum,entry)=>sum+entry.qty,0);
  const ctoPorts=ctoBreakdown.reduce((sum,entry)=>sum+entry.qty*entry.ports,0);
  const ctoAssembly=draft.ctoAssembly==='vazia'?'vazia':'montada';
  const ctoItems=[];
  if(ctoTypedTotal>0){
    for(const entry of ctoBreakdown)ctoItems.push([entry.label,'un',entry.qty]);
    if(ctoAssembly==='vazia'){
      const cto8Qty=get('cto8'),cto16Qty=get('cto16'),cto24Qty=get('cto24');
      if(cto8Qty>0)ctoItems.push(['Splitter 1:8 conectorizado SC/APC','un',cto8Qty]);
      if(cto16Qty>0)ctoItems.push(['Splitter 1:16 conectorizado SC/APC','un',cto16Qty]);
      const adapters=8*cto8Qty+16*cto16Qty+24*cto24Qty;
      if(adapters>0)ctoItems.push(['Adaptador SC/APC','un',adapters]);
    }
  }else{
    ctoItems.push(['CTO','un',ctoTotal]);
  }

  const ceoBreakdown=FTTX_CEO_MODELS.map(([field,label])=>({field,label,qty:get(field)}));
  const ceoTypedTotal=ceoBreakdown.reduce((sum,entry)=>sum+entry.qty,0);
  const ceoItems=ceoTypedTotal>0
    ? ceoBreakdown.map(entry=>[entry.label,'un',entry.qty])
    : [['CEO','un',ceoTotal]];

  const splitterItems=[
    ...FTTX_SPLITTERS_CONNECTORIZED.map(([field,label])=>[label,'un',get(field)]),
    ...FTTX_SPLITTERS_BARE.map(([field,label])=>[label,'un',get(field)]),
    ...FTTX_SPLITTERS_UNBALANCED_CONN.map(([field,label])=>[label,'un',get(field)]),
    ...FTTX_SPLITTERS_UNBALANCED_BARE.map(([field,label])=>[label,'un',get(field)])
  ];

  const guideBuckles=includeGuideBuckle?guidePoles:0;
  const baseEyelets=cableAnchors||ctoPoles;
  const groups=[
    {title:'Lançamento',items:[
      ...cables.map(c=>['Cabo óptico '+String(c.fibers).padStart(2,'0')+' FO','m',c.total]),
      ['Olhal reto M12','un',baseEyelets+get('extraEyelets')],
      ['Parafuso','un',get('bolt')],
      ['Suporte para BAP','un',get('bapSupport')],
      ['Alça pré-formada para cabo de 06 a 12 FO','un',resolvedLoops.loopSmall],
      ['Alça pré-formada para cabo de 24 FO','un',resolvedLoops.loop24],
      ['Alça pré-formada para cabo de 36 FO','un',resolvedLoops.loop36],
      ['Alça pré-formada para cabo de 48 FO','un',resolvedLoops.loop48],
      ['Alça pré-formada para cabo de 72 FO','un',resolvedLoops.loop72],
      ['Suporte dielétrico','un',get('dielectricGroups')],
      ['Plaqueta de identificação do cabo','un',poles],
      ['Anel guia AGFE para postes sem CTO e sem BAP','un',2*guidePoles],
      ['Fita de aço 3/4″ para postes sem CTO e sem BAP','m',1.5*guidePoles],
      ['Fecho de aço 3/4″ para postes sem CTO e sem BAP','un',guideBuckles],
      ['Abraçadeira BAP','un',asPoles]
    ]},
    {title:'Montagem de CTO',items:[
      ...ctoItems,
      ['Plaqueta de CTO','un',ctoTotal],
      ['Fita de aço 3/4″','m',3*ctoTotal],
      ['Fecho de aço 3/4″','un',2*ctoTotal],
      ['Anel guia AGFE','un',6*ctoTotal]
    ]},
    {title:'Montagem de CEO / CEP e Splitters',items:[
      ...ceoItems,['CEP','un',cep],['Bandeja de caixa de emenda','un',get('tray')],
      ...splitterItems,
      ['Alça pré-formada para cordoalha','un',2*ceoTotal],
      ['Conjunto de reserva técnica para caixa de emenda','un',ceoTotal+cep],
      ['Cordoalha','m',get('strand',true)],['Plaqueta de caixa de emenda','un',ceoTotal+cep],
      ['Tubete protetor de emenda','un',get('sleeve')],['Manta para CEO','un',get('blanket')]
    ]},
    ...FTTX_CATALOG.map(([title,items])=>({title,items:items.map(([name,unit])=>[name,unit,getExtra(name,unit)])}))
  ].map(group=>({
    ...group,
    items:group.items
      .map(([name,unit,qty])=>[name,unit,fttxApplyContingency(name,unit,qty,contingencyPct)])
      .filter(item=>item[2]>0)
  }));
  function getExtra(name,unit){return fttxQuantity(draft.extras?.[name],unit!=='un');}
  const issues=[];
  const warnings=[];
  if(Math.max(asPoles,ctoPoles,guidePoles)>poles||guidePoles+Math.max(asPoles,ctoPoles)>poles){
    issues.push({step:1,text:'Confira os totais. Os postes com CTO, cabo AS ou guia precisam caber no total de postes do trajeto.'});
  }
  if(ctoTotal&&(!ctoPoles||ctoPoles>ctoTotal)){
    issues.push({step:2,text:'Informe de 1 a '+ctoTotal+' postes com CTO. Se for uma caixa por poste, use o atalho na etapa CTO.'});
  }else if(ctoPoles&&!ctoTotal){
    issues.push({step:2,text:'Informe quantas CTOs comuns e de ponta há em cada bitola.'});
  }
  if(ctoTypedTotal>0&&ctoTypedTotal!==ctoTotal){
    issues.push({step:2,text:`A soma das CTOs por capacidade (${ctoTypedTotal}) precisa coincidir com o total de CTOs do trajeto (${ctoTotal}).`});
  }
  if(ceoTypedTotal>0&&ceoTypedTotal!==ceoTotal){
    issues.push({step:3,text:`A soma das CEOs por capacidade (${ceoTypedTotal}) precisa coincidir com o total de CEOs do trajeto (${ceoTotal}).`});
  }
  if(get('dielectricGroups')&&poles<3){
    issues.push({step:1,text:'Confira os suportes dielétricos. Cada grupo informado precisa de pelo menos três postes no trajeto.'});
  }
  const avgSpan=routeTotal>0&&poles>0?Math.round((routeTotal/poles)*10)/10:null;
  if(avgSpan!==null&&avgSpan>80){
    warnings.push({step:1,text:`Vão médio de ${fttxQuantityFormat.format(avgSpan)} m supera 80 m (padrão AS80/ASU80). Confira a contagem de postes ou especifique cabo AS120/AS200.`});
  }else if(avgSpan!==null&&avgSpan<15){
    warnings.push({step:1,text:`Vão médio de ${fttxQuantityFormat.format(avgSpan)} m está abaixo de 15 m. Confira a metragem lançada e o número de postes.`});
  }
  if(routeTotal>0&&totalCableLoops===0){
    warnings.push({step:1,text:'Nenhuma alça pré-formada informada para os cabos lançados. Ative o cálculo automático ou informe as quantidades por bitola.'});
  }
  const optical=calculateOpticalBudget(draft,routeTotal);
  if(optical.active&&optical.status==='fail'){
    warnings.push({step:3,text:`Orçamento óptico acima do limite (${optical.totalLossDb.toFixed(2)} dB > ${optical.budgetDb} dB em ${optical.classLabel}). Revise splitters ou classe SFP.`});
  }
  const ponRatio=String(draft.ponRatio)==='128'?128:64;
  const ponPortsNeeded=ctoPorts>0?Math.ceil(ctoPorts/ponRatio):0;
  return {
    cables,groups,ctoTotal,ceoTotal,ctoPorts,ponRatio,ponPortsNeeded,avgSpan,optical,contingencyPct,
    autoLoops,estimatedLoops,resolvedLoops,
    cableTotal:fttxQuantity(cableTotal,true),reserveTotal,routeTotal:fttxQuantity(routeTotal,true),
    issues,warnings,alerts:issues.map(issue=>issue.text)
  };
}

// ===== KML / KMZ Parser (OZmap / Google Earth) =====
function fttxHaversineMeters(lat1,lon1,lat2,lon2){
  const toRad=d=>d*Math.PI/180,R=6371000;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}

function fttxLineLengthMeters(coordsText){
  const pts=String(coordsText||'').trim().split(/\s+/).map(token=>{
    const [lon,lat]=token.split(',').map(Number);
    return Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null;
  }).filter(Boolean);
  let total=0;
  for(let i=1;i<pts.length;i++)total+=fttxHaversineMeters(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);
  return total;
}

function fttxDetectFiberGauge(text){
  const normalized=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const match=normalized.match(/\b0?(6|12|24|36|48|72)\s*(?:FO|F\b|FIBRAS?)\b/);
  return match?Number(match[1]):12;
}

function parseFttxKml(kmlText){
  const source=String(kmlText||'');
  const cables={};
  let cto=0,endCto=0,ceo=0,cep=0,poles=0,ignoredPoints=0,lineCount=0;
  const stripTags=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').trim();
  const folderStack=[];
  const tokenRe=/<Folder\b[^>]*>|<\/Folder>|<Placemark\b[^>]*>[\s\S]*?<\/Placemark>|<name\b[^>]*>[\s\S]*?<\/name>/gi;
  let m;
  while((m=tokenRe.exec(source))!==null){
    const tok=m[0];
    if(/^<Folder\b/i.test(tok)){folderStack.push('');continue;}
    if(/^<\/Folder>/i.test(tok)){folderStack.pop();continue;}
    if(/^<name\b/i.test(tok)){
      if(folderStack.length&&!folderStack[folderStack.length-1])folderStack[folderStack.length-1]=stripTags(tok);
      continue;
    }
    const pmNameMatch=tok.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i);
    const pmDescMatch=tok.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i);
    const name=pmNameMatch?stripTags(pmNameMatch[1]):'';
    const desc=pmDescMatch?stripTags(pmDescMatch[1]):'';
    const context=[...folderStack,name,desc].filter(Boolean).join(' ');
    const norm=context.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

    const lineMatches=[...tok.matchAll(/<LineString\b[^>]*>[\s\S]*?<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi)];
    if(lineMatches.length){
      const gauge=fttxDetectFiberGauge(context);
      let meters=0;
      for(const lm of lineMatches)meters+=fttxLineLengthMeters(lm[1]);
      if(meters>0){
        cables[gauge]=(cables[gauge]||0)+meters;
        lineCount++;
      }
      continue;
    }
    if(/<Point\b/i.test(tok)){
      if(/\bcto\b|caixa\s+de\s+atendimento/.test(norm)){
        if(/\bponta\b|\bfinal\b|\bterminal\b/.test(norm))endCto++;
        else cto++;
      }else if(/\bceo\b|caixa\s+de\s+emenda/.test(norm)){
        ceo++;
      }else if(/\bcep\b/.test(norm)){
        cep++;
      }else if(/\bpostes?\b|\bpoles?\b/.test(norm)||/^p[-_ ]?\d+$/i.test(name.trim())){
        poles++;
      }else{
        ignoredPoints++;
      }
    }
  }
  const roundedCables={};
  for(const [gauge,meters] of Object.entries(cables))roundedCables[gauge]=Math.round(meters*100)/100;
  return {cables:roundedCables,cto,endCto,ceo,cep,poles,lineCount,ignoredPoints};
}

async function extractKmlFromKmz(buffer){
  const bytes=new Uint8Array(buffer);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=0;
  while(offset+30<=bytes.length){
    if(view.getUint32(offset,true)!==0x04034b50)break;
    const method=view.getUint16(offset+8,true);
    const compSize=view.getUint32(offset+18,true);
    const nameLen=view.getUint16(offset+26,true);
    const extraLen=view.getUint16(offset+28,true);
    const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+nameLen));
    const dataStart=offset+30+nameLen+extraLen;
    let dataEnd=dataStart+compSize;
    if(compSize===0&&(view.getUint16(offset+6,true)&8)){
      // Data descriptor fallback: find next local/central header signature
      let scan=dataStart;
      while(scan+4<=bytes.length&&view.getUint32(scan,true)!==0x04034b50&&view.getUint32(scan,true)!==0x02014b50&&view.getUint32(scan,true)!==0x08074b50)scan++;
      dataEnd=scan;
    }
    if(/\.kml$/i.test(name)){
      const slice=bytes.subarray(dataStart,dataEnd);
      if(method===0)return new TextDecoder('utf-8').decode(slice);
      if(method===8&&typeof DecompressionStream==='function'){
        const stream=new Blob([slice]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(stream).text();
      }
      throw Error('Formato KMZ comprimido não suportado neste navegador. Exporte como KML.');
    }
    offset=dataEnd;
  }
  throw Error('Nenhum arquivo .kml encontrado dentro do KMZ.');
}

// ===== Saved Scenarios (Multiple Projects) =====
function fttxScenariosKey(){
  return 'voanet_fttx_scenarios_'+encodeURIComponent(googleUser?.email||'local');
}
function loadFttxScenarios(){
  try{
    const list=JSON.parse(localStorage.getItem(fttxScenariosKey())||'[]');
    return Array.isArray(list)?list:[];
  }catch(_){return [];}
}
function saveFttxScenarios(list){
  try{localStorage.setItem(fttxScenariosKey(),JSON.stringify(list.slice(0,25)));}catch(_){}
}
function renderFttxScenarios(){
  const list=loadFttxScenarios();
  if(!list.length)return '<p class="small muted">Nenhum cenário salvo ainda. Salve este projeto para comparar alternativas (ex.: CTO 1:16 vs. 1:8).</p>';
  return `<ul class="fttx-scenario-list">${list.map(item=>`<li>
    <div><strong>${esc(item.name)}</strong>
    <div class="small muted">${fttxQuantityFormat.format(item.cableTotal||0)} m cabo${item.ctoPorts?` · ${item.ctoPorts} portas`:''}${item.subtotal!=null?` · ${fttxCurrency.format(item.subtotal)}`:''}${item.costPerPort!=null?` (${fttxCurrency.format(item.costPerPort)}/porta)`:''}</div></div>
    <div class="btnrow">
      <button type="button" class="btn tiny primary" data-fttx-scenario-load="${esc(item.id)}">Abrir</button>
      <button type="button" class="btn tiny" data-fttx-scenario-dup="${esc(item.id)}">Duplicar</button>
      <button type="button" class="btn tiny danger" data-fttx-scenario-del="${esc(item.id)}">Excluir</button>
    </div>
  </li>`).join('')}</ul>`;
}

function loadFttxDraft(){
  const key='voanet_fttx_draft_'+encodeURIComponent(googleUser?.email||'local');
  if(key!==fttxDraftKey){
    fttxDraftKey=key;
    fttxSaveError=false;
    try{fttxDraft=JSON.parse(localStorage.getItem(key)||'{}')||{};}
    catch(_){fttxDraft={};fttxSaveError=true;}
  }
}

function openFttx(){
  if(!managementRoles.has(effectiveHomeRole()))return;
  loadFttxDraft();
  navigate('fttx');
  loadFttxReferences();
}

function mountFttx(pane){
  loadFttxDraft();
  pane.innerHTML=renderFttx();
  loadFttxReferences();
}

function fttxActive(){
  return isGoogleMode()
    ? googleUser?.role==='GESTAO'&&document.getElementById('portal-fttx-pane')?.hidden===false
    : view==='fttx';
}

async function loadFttxReferences(){
  try{
    const response=await fetch('./fttx-prices.json',{cache:'no-cache'});
    if(!response.ok)throw Error('Referências indisponíveis.');
    const {references}=await response.json();
    fttxReferences=references||{};
    const entries=Object.values(fttxReferences);
    const latest=entries.map(r=>r?.checkedOn||'').filter(Boolean).sort().pop();
    const dateNote=latest?` · última atualização em ${fmt(latest)}`:'';
    fttxReferenceStatus=`${entries.length} referências públicas atualizadas diariamente pelo portal${dateNote}. O almoxarifado confirma os preços de compra.`;
  }catch(_){
    fttxReferenceStatus='Referências públicas indisponíveis nesta consulta. Você pode informar preços estimados.';
  }
  if(fttxActive())updateFttxResults();
}

function fttxMaterialKey(name){
  return name.replace(' para postes sem CTO e sem BAP','');
}

function fttxLookupReference(key){
  if((key==='CTO 1:8 (8 portas)'||key==='CTO 1:16 (16 portas)')&&fttxDraft.ctoAssembly==='vazia'){
    return fttxReferences['CTO']||null;
  }
  if(fttxReferences[key])return fttxReferences[key];
  const bareSplitter=key.match(/^(Splitter 1:(?:2|8|16)) sem conector$/);
  if(bareSplitter&&fttxReferences[bareSplitter[1]])return fttxReferences[bareSplitter[1]];
  if(key==='CEO 24 FO'&&fttxReferences['CEO'])return fttxReferences['CEO'];
  if((key==='Plaqueta de CTO'||key==='Plaqueta de caixa de emenda')&&fttxReferences['Plaqueta de identificação do cabo']){
    return fttxReferences['Plaqueta de identificação do cabo'];
  }
  return null;
}

function fttxEstimate(name,quantity){
  const key=fttxMaterialKey(name),manual=fttxDraft.prices?.[key],reference=fttxLookupReference(key);
  if(manual!==undefined&&manual!==''&&Number.isFinite(Number(manual))&&Number(manual)>=0){
    const unit=Number(manual);
    return {unit,cents:Math.round(quantity*unit*100),source:'Estimativa manual'};
  }
  if(reference&&Number.isFinite(reference.price)&&reference.price>0){
    return {unit:reference.price,cents:Math.round(quantity*reference.price*100),source:reference.store,reference};
  }
  return {unit:null,cents:null,source:'Sem referência'};
}

function fttxPriceTable(groups){
  const materials=new Map();
  for(const {items} of groups){
    for(const [name,unit,qty] of items){
      const key=fttxMaterialKey(name),previous=materials.get(key);
      const {cents}=fttxEstimate(name,qty);
      materials.set(key,{unit,qty:(previous?.qty??0)+qty,cents:cents===null?null:(previous?.cents??0)+cents});
    }
  }
  if(!materials.size)return '';
  let missing=0,cents=0;
  const rows=[...materials].map(([name,{unit,qty,cents:lineCents}])=>{
    const quote=fttxEstimate(name,qty);
    quote.cents=lineCents;
    if(quote.cents===null)missing++;
    else cents+=quote.cents;
    const {reference}=quote;
    const pack=fttxPackSummary(name,qty);
    const source=reference&&/^https:\/\//.test(reference.url)
      ? `<a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">${esc(reference.store)}</a>
        <div class="small muted">${esc(reference.details||'')} · ${esc(fmt(reference.checkedOn))}</div>`
      : `<span>${esc(quote.source)}</span>`;
    return `<tr role="row"><th role="rowheader" scope="row">${esc(name)}</th><td role="cell">${fttxCellLabel('Quantidade')}${fttxQuantityFormat.format(qty)} ${unit}${pack?`<span class="fttx-pack-note">${esc(pack)}</span>`:''}</td>
      <td role="cell">${fttxCellLabel('Preço unitário')}<input type="number" min="0" step="0.0001" inputmode="decimal" class="fttx-price-input"
        aria-label="Preço unitário de ${esc(name)}" data-fttx-price="${esc(name)}"
        value="${esc(fttxDraft.prices?.[name]??'')}" placeholder="${quote.unit===null?'—':fttxUnitPrice.format(quote.unit)}"></td>
      <td role="cell" data-fttx-price-result>${fttxCellLabel('Subtotal')}<strong>${quote.cents===null?'—':fttxCurrency.format(quote.cents/100)}</strong></td>
      <td role="cell" data-fttx-price-result>${fttxCellLabel('Origem')}${source}</td></tr>`;
  }).join('');
  return `<details class="fttx-prices" ${fttxPriceOpen?'open':''}><summary id="fttx-prices-editor">Estimativa de materiais · ${cents||missing<materials.size?fttxCurrency.format(cents/100):'sem valores'}</summary>
    <p class="small muted">${fttxReferenceStatus} O valor digitado substitui a referência pública.</p>
    <div data-fttx-price-result>${missing?`<p class="fttx-alert">${missing} de ${materials.size} materiais sem preço. O subtotal cobre os itens com valor informado.</p>`:''}</div>
    <div class="table-scroll fttx-review-table"><table class="data-table fttx-price-table" role="table" aria-label="Preços de materiais">
      <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Material</th><th role="columnheader" scope="col">Quantidade</th><th role="columnheader" scope="col">Preço unitário</th><th role="columnheader" scope="col">Subtotal</th><th role="columnheader" scope="col">Origem</th></tr></thead>
      <tbody role="rowgroup">${rows}</tbody></table></div></details>`;
}

let fttxPriceOpen=true;
function updateFttxPrices(){
  const current=document.querySelector('.fttx-prices');
  if(!current)return;
  const next=document.createElement('template');
  const result=calculateFttx(fttxDraft);
  next.innerHTML=fttxResults(result);
  const selector='summary,[data-fttx-price-result]';
  const fresh=next.content.querySelector('.fttx-prices').querySelectorAll(selector);
  current.querySelectorAll(selector).forEach((node,index)=>node.replaceChildren(...fresh[index].childNodes));
  const inputs=next.content.querySelectorAll('[data-fttx-price]');
  current.querySelectorAll('[data-fttx-price]').forEach((node,index)=>{node.placeholder=inputs[index].placeholder;});
  updateFttxOverview(result);
  for(const selector of ['#fttx-cost-summary','.fttx-materials']){
    const fresh=next.content.querySelectorAll(selector);
    document.querySelectorAll(selector).forEach((node,index)=>node.replaceWith(fresh[index]));
  }
}

function currentFttxStep(){
  return [1,2,3,4].includes(fttxDraft.step)?fttxDraft.step:1;
}

function fttxOverview(result){
  const {items,missing,subtotal}=fttxCostRows(result.groups);
  const meters=value=>fttxQuantityFormat.format(value)+' m';
  const costPerPort=result.ctoPorts>0&&subtotal!==null?subtotal/result.ctoPorts:null;
  return `<dl class="fttx-overview">
    <div><dt>Trajeto</dt><dd>${meters(result.routeTotal)}</dd>${result.avgSpan!==null?`<small>Vão médio: ${fttxQuantityFormat.format(result.avgSpan)} m</small>`:''}</div>
    <div><dt>Cabo com reserva</dt><dd>${meters(result.cableTotal)}</dd>${result.ctoPorts>0?`<small>${fttxQuantityFormat.format(result.ctoPorts)} portas · ${result.ponPortsNeeded} PON (1:${result.ponRatio})</small>`:''}</div>
    <div><dt>Estimativa de materiais</dt><dd>${subtotal===null?'—':fttxCurrency.format(subtotal)}</dd>
    ${costPerPort!==null?`<small>${fttxCurrency.format(costPerPort)} / porta CTO</small>`:items.length&&missing?`<small>${missing} de ${items.length} linhas sem preço</small>`:''}</div>
  </dl>`;
}

function renderOpticalResult(optical){
  if(!optical.active)return '<p class="small muted">Selecione os splitters do pior enlace (CTO mais distante) para validar a potência óptica GPON / XGS-PON.</p>';
  return `<div class="fttx-optical-result fttx-optical-${optical.status}">
    <strong>${esc(optical.statusLabel)} · ${esc(optical.classLabel)}</strong>
    <div>Atenuação total (c/ margem de ${fttxQuantityFormat.format(optical.marginDb)} dB): <strong>${optical.totalLossDb.toFixed(2)} dB</strong> de ${optical.budgetDb} dB · Folga: <strong>${optical.headroomDb>=0?'+':''}${optical.headroomDb.toFixed(2)} dB</strong></div>
    <div>Potência estimada na CTO de ponta: <strong>${optical.rxPowerDbm.toFixed(2)} dBm</strong> · Fibra (${fttxQuantityFormat.format(optical.distanceKm)} km): ${optical.fiberLossDb.toFixed(2)} dB · Splitters: ${(optical.split1Db+optical.split2Db+optical.cascadeDb).toFixed(2)} dB · Fusões/conectores: ${optical.passiveDb.toFixed(2)} dB</div>
  </div>`;
}

function updateFttxOverview(result){
  const overview=document.getElementById('fttx-overview');
  if(overview)overview.innerHTML=fttxOverview(result);
  const portsBadge=document.getElementById('fttx-cto-ports-badge');
  if(portsBadge){
    portsBadge.hidden=result.ctoPorts<=0;
    portsBadge.textContent=`Capacidade: ${fttxQuantityFormat.format(result.ctoPorts)} portas · ${result.ponPortsNeeded} porta(s) PON (1:${result.ponRatio})`;
  }
  const optBox=document.getElementById('fttx-optical-output');
  if(optBox)optBox.innerHTML=renderOpticalResult(result.optical);
  for(const [field] of FTTX_LOOP_FIELDS){
    const input=document.getElementById('fttx-'+field);
    if(input){
      const est=result.estimatedLoops?.[field]||0;
      input.placeholder=result.autoLoops&&est>0?`Automático: ${est}`:'0';
    }
  }
}

function fttxIssues(result,step){
  const issues=step===4?result.issues:result.issues.filter(issue=>issue.step===step);
  const warnings=step===4?result.warnings:result.warnings.filter(w=>w.step===step);
  let html='';
  if(issues.length){
    html+=`<div class="fttx-alert"><strong>${step===4?'Ajuste os campos indicados para exportar':'Confira nesta etapa'}</strong>
      <ul>${issues.map(({text,step:target})=>`<li>${text}
      ${step===4?`<button type="button" class="btn tiny" data-fttx-step="${target}">Revisar ${FTTX_STEPS[target-1][0]}</button>`:''}
      </li>`).join('')}</ul></div>`;
  }
  if(warnings.length){
    html+=`<div class="fttx-warning-box"><strong>Avisos de engenharia (não bloqueiam exportação)</strong>
      <ul>${warnings.map(({text})=>`<li>${esc(text)}</li>`).join('')}</ul></div>`;
  }
  return html;
}

function fttxExtrasListHtml(){
  const entries=Object.entries(fttxDraft.extras||{}).filter(([,qty])=>Number(qty)>0);
  if(!entries.length)return '';
  const unitMap=new Map(FTTX_CATALOG.flatMap(([,items])=>items));
  return `<ul class="fttx-extras-list" aria-label="Materiais complementares adicionados">${entries.map(([name,qty])=>`<li>
    <span><strong>${esc(name)}</strong> · ${fttxQuantityFormat.format(Number(qty))} ${unitMap.get(name)||'un'}</span>
    <button type="button" class="btn danger tiny" data-fttx-remove-extra="${esc(name)}">Remover</button>
  </li>`).join('')}</ul>`;
}

function updateFttxResults(){
  const result=calculateFttx(fttxDraft);
  updateFttxOverview(result);
  document.querySelectorAll('[data-fttx-issues]').forEach(target=>{
    const message=fttxIssues(result,Number(target.dataset.fttxIssues));
    if(target.innerHTML!==message)target.innerHTML=message;
  });
  const extrasNode=document.getElementById('fttx-extras-list');
  if(extrasNode)extrasNode.innerHTML=fttxExtrasListHtml();
  const scenariosNode=document.getElementById('fttx-scenarios-list');
  if(scenariosNode)scenariosNode.innerHTML=renderFttxScenarios();
  if(currentFttxStep()!==4)return;
  const target=document.getElementById('fttx-results');
  if(!target)return;
  fttxPriceOpen=target.querySelector('.fttx-prices')?.open??fttxPriceOpen;
  target.innerHTML=fttxResults(result);
  const disabled=result.alerts.length>0||!result.groups.some(group=>group.items.length);
  document.querySelectorAll('[data-fttx-export]').forEach(button=>{button.disabled=disabled;});
}

function goFttxStep(step){
  const [label,headingId]=FTTX_STEPS[step-1];
  const heading=document.getElementById(headingId);
  fttxDraft.step=step;
  document.querySelectorAll('[data-fttx-panel]').forEach(panel=>{
    panel.hidden=Number(panel.dataset.fttxPanel)!==step;
  });
  document.querySelectorAll('.fttx-navigation [data-fttx-step]').forEach(button=>{
    if(Number(button.dataset.fttxStep)===step)button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  });
  document.getElementById('fttx-step-status').textContent=`Etapa ${step} de ${FTTX_STEPS.length} · ${label}`;
  if((step===2||step===3)&&FTTX_FIBERS.some(fibers=>fibers!==12&&fttxQuantity(fttxDraft.cables?.[fibers]?.meters,true)>0)){
    heading.closest('[data-fttx-panel]').querySelector('[data-fttx-other-cables]').open=true;
  }
  persistFttx();
  updateFttxResults();
  heading.focus({preventScroll:true});
  document.getElementById('fttx-overview').scrollIntoView({block:'start'});
}

function fttxStepActions(step){
  const next=['','Continuar para CTO','Continuar para CEO / CEP','Revisar lista'];
  return `<div class="fttx-step-actions">
    ${step>1?`<button type="button" class="btn" data-fttx-step="${step-1}">Voltar</button>`:''}
    ${step<4?`<button type="button" class="btn primary" data-fttx-step="${step+1}">${next[step]} →</button>`:''}
  </div>`;
}

function fttxInput(field,label,help='',decimal=false){
  return `<div class="fttx-field"><label for="fttx-${field}">${label}</label><input id="fttx-${field}" type="number"
    min="0" step="${decimal?'0.01':'1'}" inputmode="${decimal?'decimal':'numeric'}"
    ${help?`aria-describedby="fttx-help-${field}"`:''} value="${esc(fttxDraft[field]??'')}" data-fttx-field="${field}" placeholder="0">
    ${help?`<small id="fttx-help-${field}">${help}</small>`:''}</div>`;
}

function fttxCableInputs(fields){
  const inputGroup=fibers=>{
    const bitola=String(fibers).padStart(2,'0')+' FO';
    return `<fieldset class="fttx-cable-group"><legend>${bitola}</legend><div class="fttx-cable-inputs">${fields.map(field=>{
      const label=FTTX_CABLE_FIELDS.find(([key])=>key===field)[1],decimal=field==='meters';
      return `<label class="fttx-field"><span>${label}</span><input type="number" min="0" step="${decimal?'0.01':'1'}"
        inputmode="${decimal?'decimal':'numeric'}" aria-label="${label} · ${bitola}" data-fttx-fiber="${fibers}"
        data-fttx-field="${field}" value="${esc(fttxDraft.cables?.[fibers]?.[field]??'')}" placeholder="0"></label>`;
    }).join('')}</div></fieldset>`;
  };
  const otherFibers=FTTX_FIBERS.filter(fibers=>fibers!==12);
  const expanded=otherFibers.some(fibers=>[...fields,'meters'].some(field=>fttxQuantity(fttxDraft.cables?.[fibers]?.[field],true)>0));
  return `${inputGroup(12)}<details class="fttx-options" data-fttx-other-cables ${expanded?'open':''}><summary>Outras bitolas · 06, 24, 36, 48 e 72 FO</summary>
    <div class="fttx-other-cables">${otherFibers.map(inputGroup).join('')}</div></details>`;
}

function fttxStep(number,id,title){
  return `<h2 id="${id}" tabindex="-1" class="fttx-step"><span aria-hidden="true">${number}</span>${title}</h2>`;
}

function fttxCatalogOptions(query=''){
  const search=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=search(query.trim());
  const options=FTTX_CATALOG.map(([group,items])=>{
    const matches=items.filter(([name])=>search(group+' '+name).includes(term));
    return matches.length?`<optgroup label="${group}">${matches.map(([name,unit])=>
      `<option value="${esc(name)}" data-unit="${unit}">${name} · ${unit}</option>`).join('')}</optgroup>`:'';
  }).join('');
  return `<option value="">${options?'Selecione um material':'Nenhum material encontrado'}</option>${options}`;
}

function fttxCellLabel(label){
  return `<span class="fttx-cell-label" aria-hidden="true">${label}</span>`;
}

function fttxResults(result){
  const {cables,groups,optical}=result;
  const f=value=>fttxQuantityFormat.format(value);
  const shown=cables.filter(c=>c.total>0);
  const {items}=fttxCostRows(groups);
  const money=value=>value===null?'—':fttxCurrency.format(value);
  return `<div id="fttx-cost-summary" class="fttx-cost-summary">${fttxCostSummary(result)}</div>
  ${optical.active?`<section class="fttx-reservation"><h3>Validação óptica</h3>${renderOpticalResult(optical)}</section>`:''}
  ${shown.length?`<section class="fttx-reservation"><h3>Reserva por bitola</h3><div class="table-scroll fttx-review-table"><table class="data-table fttx-reserve-table" role="table" aria-label="Reserva por bitola">
    <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Bitola</th><th role="columnheader" scope="col">CTOs</th><th role="columnheader" scope="col">CEOs</th><th role="columnheader" scope="col">A cada 500 m</th><th role="columnheader" scope="col">Reserva</th><th role="columnheader" scope="col">Cabo total</th></tr></thead>
    <tbody role="rowgroup">${shown.map(c=>`<tr role="row"><th role="rowheader" scope="row">${String(c.fibers).padStart(2,'0')} FO</th>
      ${[['CTOs',c.ctoReserve],['CEOs',c.ceoReserve],['A cada 500 m',c.routeReserve],['Reserva',c.reserve],['Cabo total',c.total]]
        .map(([label,value])=>`<td role="cell">${fttxCellLabel(label)}${f(value)} m</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></section>`:''}
  ${items.length?groups.filter(group=>group.items.length).map(group=>{
    const rows=items.filter(item=>item.group===group.title);
    const priced=rows.filter(item=>item.subtotal!==null);
    const subtotal=priced.length?priced.reduce((sum,item)=>sum+Math.round(item.subtotal*100),0)/100:null;
    return `<section class="fttx-materials"><div class="fttx-stage-total"><h3>${group.title}</h3>
      <span>Subtotal estimado <strong>${money(subtotal)}</strong></span></div>
      <div class="table-scroll fttx-review-table"><table class="data-table fttx-budget-table" role="table" aria-label="${esc(group.title)}">
      <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Material</th><th role="columnheader" scope="col">Quantidade</th><th role="columnheader" scope="col">Preço unitário</th><th role="columnheader" scope="col">Subtotal</th></tr></thead>
      <tbody role="rowgroup">${rows.map(({name,unit,quantity,price,subtotal})=>{
        const pack=fttxPackSummary(name,quantity);
        return `<tr role="row"><th role="rowheader" scope="row">${esc(name)}</th>
        <td role="cell">${fttxCellLabel('Quantidade')}<strong>${f(quantity)} ${unit}</strong>${pack?`<span class="fttx-pack-note">${esc(pack)}</span>`:''}</td>
        <td role="cell">${fttxCellLabel('Preço unitário')}${price===null?'—':fttxUnitPrice.format(price)}</td>
        <td role="cell">${fttxCellLabel('Subtotal')}${money(subtotal)}</td></tr>`;
      }).join('')}</tbody>
      </table></div></section>`;
  }).join(''):'<p class="muted">Preencha os dados do projeto para gerar a lista de materiais.</p>'}
  ${fttxPriceTable(groups)}`;
}

function renderFttx(){
  const result=calculateFttx(fttxDraft),step=currentFttxStep();
  const panel=number=>`class="card fttx-panel" data-fttx-panel="${number}" ${step!==number?'hidden':''}`;
  const issues=number=>`<div data-fttx-issues="${number}" role="status">${fttxIssues(result,number)}</div>`;
  const hasUnbalanced=[...FTTX_SPLITTERS_UNBALANCED_CONN,...FTTX_SPLITTERS_UNBALANCED_BARE].some(([field])=>fttxQuantity(fttxDraft[field])>0);
  const hasCeoModels=FTTX_CEO_MODELS.some(([field])=>fttxQuantity(fttxDraft[field])>0);
  const splitOptions=selected=>FTTX_OPTICAL_SPLITS.map(([id,label])=>`<option value="${id}" ${(selected||'none')===id?'selected':''}>${label}</option>`).join('');
  return `<main class="shell fttx-shell">
    <header class="fttx-page-heading"><div><h1>Levantamento FTTx</h1>
      <p>Calcule metragem, orçamento óptico, portas PON, CTOs, CEOs e splitters para o almoxarifado.</p></div>
      <div class="btnrow">
        <button type="button" class="btn tiny primary" data-fttx-scenario-save>Salvar cenário</button>
        <button type="button" class="btn tiny danger" data-fttx-reset>Limpar levantamento</button>
        ${isGoogleMode()?'':button('home','Voltar à Gestão','tiny')}
      </div></header>
    <div id="fttx-overview">${fttxOverview(result)}</div>
    <div class="fttx-workspace">
      <aside class="fttx-wizard" aria-label="Progresso do levantamento">
        <div class="fttx-wizard-head">
          <p id="fttx-step-status">Etapa ${step} de ${FTTX_STEPS.length} · ${FTTX_STEPS[step-1][0]}</p>
          <p class="small muted" id="fttx-save" role="status">${fttxSaveError?'Armazenamento local indisponível.':'Rascunho neste dispositivo'}</p>
        </div>
        <nav class="fttx-navigation" aria-label="Etapas do levantamento">
          ${FTTX_STEPS.map(([label],index)=>`<button type="button" class="btn tiny" data-fttx-step="${index+1}" aria-label="${label}"
            ${index+1===step?'aria-current="step"':''}><span aria-hidden="true">${index+1}</span>
            <b>${label}</b>${index===3?'<b class="fttx-short-name" aria-hidden="true">Revisão</b>':''}</button>`).join('')}
        </nav>
      </aside>
      <div class="fttx-step-content">
        <section ${panel(1)} aria-labelledby="fttx-project-heading">
          ${fttxStep(1,'fttx-project-heading','Lançamento de cabo e postes')}
          ${issues(1)}
          <p class="fttx-panel-description">Use as quantidades previstas no mapa ou importe um KML/KMZ do OZmap ou Google Earth.</p>
          <label class="fttx-field fttx-project"><span>Nome do projeto</span><input maxlength="100" data-fttx-field="name" placeholder="Ex.: Expansão Curralinho" value="${esc(fttxDraft.name??'')}"></label>
          <details class="fttx-options">
            <summary>Importar traçado KML / KMZ (OZmap ou Google Earth)</summary>
            <p class="small muted">Lê o arquivo localmente no navegador para estimar metragem por bitola, postes, CTOs e CEOs. Você pode revisar tudo depois.</p>
            <div class="fttx-quick-bar">
              <input id="fttx-kml-file" type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz">
            </div>
            <p id="fttx-kml-status" class="small muted" role="status"></p>
          </details>
          <details class="fttx-options">
            <summary>Projetos e cenários salvos (${loadFttxScenarios().length})</summary>
            <div id="fttx-scenarios-list">${renderFttxScenarios()}</div>
          </details>
          <h3>Cabo por número de fibras (FO)</h3>
          <p class="small muted">Informe a metragem por bitola. O sistema calcula a reserva e valida o vão médio (padrão AS80/ASU80 até 80 m).</p>
          ${fttxCableInputs(['meters'])}
          <h3>Postes e abraçadeiras</h3>
          <div class="fttx-fields">${FTTX_ROUTE_FIELDS.map(([field,label,help])=>fttxInput(field,label,help)).join('')}</div>
          <div class="fttx-quick-bar">
            <button type="button" class="btn tiny fttx-suggestion" data-fttx-suggestion="asPoles">Usar todos os postes para cabo AS</button>
          </div>
          <div class="fttx-subsection">
            <h3>Alças pré-formadas de ancoragem</h3>
            <p class="small muted">Calculadas automaticamente em 1:1 com cada ancoragem/olhal (2 por CTO comum, 1 por CTO de ponta, 2 por CEO, 2 nas extremidades do cabo e 1 por olhal adicional). Digite um valor para substituir manualmente.</p>
            <label class="fttx-checkbox-inline">
              <input type="checkbox" data-fttx-checkbox="autoLoops" ${result.autoLoops?'checked':''}>
              Calcular alças pré-formadas automaticamente pelas ancoragens do trajeto
            </label>
            <div class="fttx-fields">${FTTX_LOOP_FIELDS.map(([field,label,help])=>{
              const est=result.estimatedLoops?.[field]||0;
              const ph=result.autoLoops&&est>0?`Automático: ${est}`:'0';
              return `<div class="fttx-field"><label for="fttx-${field}">${label}</label><input id="fttx-${field}" type="number"
                min="0" step="1" inputmode="numeric" aria-describedby="fttx-help-${field}" value="${esc(fttxDraft[field]??'')}"
                data-fttx-field="${field}" placeholder="${ph}"><small id="fttx-help-${field}">${help}</small></div>`;
            }).join('')}</div>
          </div>
          <details class="fttx-options" ${FTTX_ROUTE_DETAILS.some(([key])=>fttxQuantity(fttxDraft[key])>0)?'open':''}>
            <summary>Detalhar ferragens e ancoragem</summary>
            <p class="small muted">Preencha os itens que já consegue estimar pelo traçado ou use o atalho para pré-preencher ferragens de ancoragem.</p>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-estimate-hardware>Estimar ferragens pelo trajeto</button>
            </div>
            <label class="fttx-checkbox-inline">
              <input type="checkbox" data-fttx-checkbox="includeGuideBuckle" ${fttxDraft.includeGuideBuckle===true||fttxDraft.includeGuideBuckle==='true'?'checked':''}>
              Incluir 1 fecho de aço 3/4″ por poste sem CTO e sem BAP (para prender a fita de 1,5 m)
            </label>
            <div class="fttx-fields">${FTTX_ROUTE_DETAILS.map(([field,label,help])=>fttxInput(field,label,help)).join('')}</div>
          </details>
          ${fttxStepActions(1)}
        </section>
        <section ${panel(2)} aria-labelledby="fttx-cto-heading">
          ${fttxStep(2,'fttx-cto-heading','Montagem de CTO')}
          ${issues(2)}
          <p class="fttx-panel-description">Separe as caixas de atendimento comuns das de ponta na bitola do cabo que terá a reserva, e escolha os modelos de CTO abaixo.</p>
          ${fttxCableInputs(['cto','endCto'])}
          <div class="fttx-fields">${fttxInput('ctoPoles','Postes com CTO','Conte os postes distintos. Se duas caixas estiverem no mesmo poste, conte apenas um poste.')}</div>
          <button type="button" class="btn tiny fttx-suggestion" data-fttx-suggestion="ctoPoles">Estimar uma CTO por poste</button>
          <div class="fttx-subsection">
            <h3>Capacidade, fornecimento e dimensionamento PON</h3>
            <p class="small muted">Especifique quantas CTOs serão 1:8, 1:16, 1:24 ou pré-conectorizadas. A soma deve igualar o total de CTOs informadas acima.</p>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-cto-fill="cto8">Todas 1:8</button>
              <button type="button" class="btn tiny" data-fttx-cto-fill="cto16">Todas 1:16</button>
              <button type="button" class="btn tiny" data-fttx-cto-fill="ctoPre16">Todas pré-conectorizada 1:16</button>
              <span id="fttx-cto-ports-badge" class="fttx-ports-pill" ${result.ctoPorts>0?'':'hidden'}>Capacidade: ${fttxQuantityFormat.format(result.ctoPorts)} portas · ${result.ponPortsNeeded} porta(s) PON (1:${result.ponRatio})</span>
            </div>
            <div class="fttx-fields">
              ${FTTX_CTO_MODELS.map(([field,label])=>fttxInput(field,label)).join('')}
              <div class="fttx-field">
                <label for="fttx-ctoAssembly">Fornecimento das CTOs convencionais</label>
                <select id="fttx-ctoAssembly" data-fttx-field="ctoAssembly">
                  <option value="montada" ${fttxDraft.ctoAssembly!=='vazia'?'selected':''}>CTO já montada / equipada</option>
                  <option value="vazia" ${fttxDraft.ctoAssembly==='vazia'?'selected':''}>CTO vazia (incluir splitter SC/APC e adaptadores)</option>
                </select>
                <small>No modo vazia, CTO 1:8 e 1:16 somam automaticamente splitter conectorizado SC/APC e adaptadores SC/APC.</small>
              </div>
              <div class="fttx-field">
                <label for="fttx-ponRatio">Razão máxima por porta PON (OLT)</label>
                <select id="fttx-ponRatio" data-fttx-field="ponRatio">
                  <option value="64" ${String(fttxDraft.ponRatio)!=='128'?'selected':''}>1:64 (padrão GPON)</option>
                  <option value="128" ${String(fttxDraft.ponRatio)==='128'?'selected':''}>1:128 (alta densidade)</option>
                </select>
                <small>Usado para estimar quantas portas PON da OLT o projeto exige.</small>
              </div>
            </div>
          </div>
          <p class="small muted">Por caixa, o sistema inclui 1 plaqueta, 3 m de fita de aço, 2 fechos e 6 anéis guia. Nas ancoragens, entram 2 olhais e 2 alças por CTO comum e 1 olhal e 1 alça por CTO de ponta. A reserva é de 22 m por CTO comum e 12,5 m por CTO de ponta.</p>
          ${fttxStepActions(2)}
        </section>
        <section ${panel(3)} aria-labelledby="fttx-box-heading">
          ${fttxStep(3,'fttx-box-heading','Montagem de CEO / CEP e Splitters')}
          ${issues(3)}
          <p class="fttx-panel-description">Cada CEO soma 20 m de cabo na bitola indicada, 2 olhais e 2 alças de ancoragem do cabo, além de 2 alças de cordoalha. Cada CEO ou CEP inclui 1 conjunto de reserva e 1 plaqueta.</p>
          ${fttxCableInputs(['ceo'])}
          <div class="fttx-fields">${fttxInput(...FTTX_BOX_FIELDS[0])}</div>
          <details class="fttx-options" ${hasCeoModels?'open':''}>
            <summary>Detalhar capacidade das CEOs (24, 48, 72 ou 144 FO)</summary>
            <p class="small muted">Opcional: distribua as CEOs por capacidade. Se deixar zerado, o levantamento lista como CEO padrão.</p>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-ceo-fill="ceo24">Todas 24 FO</button>
              <button type="button" class="btn tiny" data-fttx-ceo-fill="ceo48">Todas 48 FO</button>
            </div>
            <div class="fttx-fields">${FTTX_CEO_MODELS.map(([field,label])=>fttxInput(field,label)).join('')}</div>
          </details>
          <div class="fttx-subsection">
            <h3>Splitters de rede</h3>
            <p class="small muted">Informe os divisores ópticos necessários na distribuição (CEOs, DIOs ou CTOs sem inclusão automática).</p>
            <h4>Balanceados conectorizados SC/APC</h4>
            <div class="fttx-fields">${FTTX_SPLITTERS_CONNECTORIZED.map(([field,label])=>fttxInput(field,label)).join('')}</div>
            <h4>Balanceados sem conector (fusão)</h4>
            <div class="fttx-fields">${FTTX_SPLITTERS_BARE.map(([field,label])=>fttxInput(field,label)).join('')}</div>
            <details class="fttx-options" ${hasUnbalanced?'open':''}>
              <summary>Splitters desbalanceados (rede em cascata · 5/95 a 50/50)</summary>
              <h4>Desbalanceados conectorizados SC/APC</h4>
              <div class="fttx-fields">${FTTX_SPLITTERS_UNBALANCED_CONN.map(([field,label])=>fttxInput(field,label)).join('')}</div>
              <h4>Desbalanceados sem conector (fusão)</h4>
              <div class="fttx-fields">${FTTX_SPLITTERS_UNBALANCED_BARE.map(([field,label])=>fttxInput(field,label)).join('')}</div>
            </details>
          </div>
          <details class="fttx-options" ${result.optical.active?'open':''}>
            <summary>Calculadora de Orçamento Óptico (GPON / XGS-PON)</summary>
            <p class="small muted">Valide a atenuação total até a CTO mais distante (pior caso em 1310 nm: 0,35 dB/km + 0,10 dB/fusão + 0,50 dB/conector).</p>
            <div class="fttx-fields">
              <div class="fttx-field">
                <label for="fttx-optClass">Classe SFP / OLT</label>
                <select id="fttx-optClass" data-fttx-field="optClass">
                  ${Object.entries(FTTX_OPTICAL_CLASSES).map(([id,c])=>`<option value="${id}" ${(fttxDraft.optClass||'gpon_c')===id?'selected':''}>${c.label}</option>`).join('')}
                </select>
              </div>
              ${fttxInput('optDistanceKm','Distância OLT → CTO ponta (km)','Em branco usa o trajeto informado ('+fttxQuantityFormat.format(result.routeTotal/1000)+' km).',true)}
              <div class="fttx-field"><label for="fttx-optSplit1">Splitter 1º nível (CEO / DIO)</label><select id="fttx-optSplit1" data-fttx-field="optSplit1">${splitOptions(fttxDraft.optSplit1)}</select></div>
              <div class="fttx-field"><label for="fttx-optSplit2">Splitter 2º nível (CTO)</label><select id="fttx-optSplit2" data-fttx-field="optSplit2">${splitOptions(fttxDraft.optSplit2)}</select></div>
              ${fttxInput('optCascadeCount','Passantes desbalanceados antes da ponta','Para rede em cascata (0 em rede balanceada).')}
              <div class="fttx-field"><label for="fttx-optCascadeRatio">Razão dos passantes em cascata</label>
                <select id="fttx-optCascadeRatio" data-fttx-field="optCascadeRatio">
                  ${FTTX_UNBALANCED_RATIOS.map(r=>`<option value="${r}" ${(fttxDraft.optCascadeRatio||'10/90')===r?'selected':''}>${r} (${FTTX_CASCADE_THRU_DB[r].toFixed(2).replace('.',',')} dB/passante)</option>`).join('')}
                </select>
              </div>
              ${fttxInput('optSplices','Fusões no pior enlace','Padrão: 6 fusões (0,10 dB cada).')}
              ${fttxInput('optConnectors','Pares de conectores SC/APC','Padrão: 4 pares (0,50 dB cada).')}
              ${fttxInput('optMargin','Margem de segurança (dB)','Padrão: 3,0 dB para envelhecimento/reparos.',true)}
            </div>
            <div id="fttx-optical-output">${renderOpticalResult(result.optical)}</div>
          </details>
          <details class="fttx-options" ${FTTX_BOX_FIELDS.slice(1).some(([key])=>fttxQuantity(fttxDraft[key],true)>0)?'open':''}>
            <summary>Detalhar bandejas, cordoalha, tubetes e mantas</summary>
            <div class="fttx-quick-bar">
              <button type="button" class="btn tiny" data-fttx-suggestion="sleeve">Estimar tubetes pelas fusões</button>
            </div>
            <div class="fttx-fields">${FTTX_BOX_FIELDS.slice(1).map(([field,label,help])=>fttxInput(field,label,help,field==='strand')).join('')}</div>
          </details>
          ${fttxStepActions(3)}
        </section>
        <section ${panel(4)} aria-labelledby="fttx-list-heading">
          ${fttxStep(4,'fttx-list-heading','Lista para o almoxarifado')}
          <p class="fttx-panel-description">Revise quantidades, embalagens de compra e preços para baixar o levantamento preliminar.</p>
          <div class="fttx-export-bar">
            <div class="btnrow" aria-label="Exportar materiais">${[['pdf','Baixar PDF','primary'],['xlsx','Baixar Excel',''],['csv','Baixar CSV','']]
              .map(([format,label,style])=>`<button type="button" class="btn ${style}" data-fttx-export="${format}"
              ${result.alerts.length||!result.groups.some(group=>group.items.length)?'disabled':''}>${label}</button>`).join('')}</div>
            <div class="fttx-quick-bar">
              <label class="fttx-field"><span>Margem de contingência (ferragens e consumíveis)</span>
                <select data-fttx-field="contingencyPct">
                  <option value="0" ${!result.contingencyPct?'selected':''}>0% (quantidade exata)</option>
                  <option value="5" ${result.contingencyPct===5?'selected':''}>+5% de reserva</option>
                  <option value="10" ${result.contingencyPct===10?'selected':''}>+10% de reserva</option>
                </select>
              </label>
            </div>
            <p id="fttx-export-status" class="small muted fttx-export-status" role="status"></p>
          </div>
          ${issues(4)}
          <details class="fttx-options fttx-catalog" ${Object.keys(fttxDraft.extras||{}).length?'open':''}>
            <summary>Adicionar outros materiais do catálogo</summary>
            <form id="fttx-catalog-form" class="fttx-fields">
              <label class="fttx-field"><span>Buscar no catálogo</span><input type="search" id="fttx-search" placeholder="Ex.: DIO, OLT, drop ou microduto"></label>
              <label class="fttx-field"><span id="fttx-material-label">Material</span><select id="fttx-catalog-item" aria-labelledby="fttx-material-label" required>${fttxCatalogOptions()}</select></label>
              <label class="fttx-field"><span>Quantidade</span><input id="fttx-catalog-quantity" type="number" min="0" step="0.01" inputmode="decimal" required></label>
              <button class="btn" type="submit">Aplicar quantidade</button>
            </form>
            <p class="small muted" id="fttx-catalog-status" role="status">Informe zero ou clique em Remover para retirar um material complementar da lista.</p>
            <div id="fttx-extras-list">${fttxExtrasListHtml()}</div>
          </details>
          <details class="fttx-options">
            <summary>Ver um exemplo de cálculo da reserva</summary>
            <p class="small muted">Para 1.000 m de cabo de 12 FO, 2 CTOs comuns, 1 CTO de ponta e 1 CEO na mesma bitola, a reserva é de 176,5 m. São 100 m pelo trajeto, 44 m pelas CTOs comuns, 12,5 m pela CTO de ponta e 20 m pela CEO. O cabo previsto fica em 1.176,5 m.</p>
          </details>
          <div id="fttx-results">${step===4?fttxResults(result):''}</div>
          ${fttxStepActions(4)}
        </section>
      </div>
    </div>
  </main>`;
}

function persistFttx(){
  try{
    localStorage.setItem(fttxDraftKey,JSON.stringify(fttxDraft));
    fttxSaveError=false;
  }catch(_){fttxSaveError=true;}
  const status=document.getElementById('fttx-save');
  const message=fttxSaveError?'Não foi possível salvar o rascunho neste dispositivo.':'Rascunho salvo neste dispositivo';
  if(status&&status.textContent!==message)status.textContent=message;
}

function saveFttx(event){
  const input=event.target,field=input.dataset.fttxField;
  if(!field||!fttxActive())return;
  if(input.dataset.fttxFiber){
    fttxDraft.cables??={};
    (fttxDraft.cables[input.dataset.fttxFiber]??={})[field]=input.value;
  }else fttxDraft[field]=input.value;
  persistFttx();
  if(field==='name')return;
  updateFttxResults();
}

function fttxCostRows(groups){
  let cents=0,missing=0;
  const items=groups.flatMap(group=>group.items.map(([name,unit,quantity])=>{
    const quote=fttxEstimate(name,quantity);
    if(quote.cents===null)missing++;
    else cents+=quote.cents;
    const url=quote.reference?.url||'';
    return {group:group.title,name,unit,quantity,price:quote.unit,subtotal:quote.cents===null?null:quote.cents/100,
      source:quote.source,checkedOn:quote.reference?.checkedOn||'',url:/^https:\/\//.test(url)?url:''};
  }));
  return {items,missing,subtotal:items.length===missing?null:cents/100};
}

function fttxCostSummary(result){
  const groups=Array.isArray(result)?result:result.groups;
  const {items,missing,subtotal}=fttxCostRows(groups);
  if(!items.length)return '';
  const ctoPorts=Array.isArray(result)?0:result.ctoPorts;
  const ponPorts=Array.isArray(result)?0:result.ponPortsNeeded;
  const ponRatio=Array.isArray(result)?64:result.ponRatio;
  const costPerPort=ctoPorts>0&&subtotal!==null?subtotal/ctoPorts:null;
  return `<div><h3>Estimativa de materiais</h3><strong>${subtotal===null?'Sem preços informados':fttxCurrency.format(subtotal)}</strong>
    ${costPerPort!==null?`<div class="small muted">${fttxCurrency.format(costPerPort)} por porta CTO · ${ctoPorts} portas · ${ponPorts} porta(s) PON (1:${ponRatio})</div>`:''}</div>
    <button type="button" class="btn tiny" data-fttx-jump="fttx-prices-editor">Ajustar preços em R$</button>
    <p>${missing?`${missing} de ${items.length} linhas sem preço. O subtotal cobre os itens com valor informado. `:''}Mão de obra e frete ficam fora da estimativa.</p>`;
}

function buildFttxCsv(report){
  const number=value=>value==null?'':String(value).replace('.',',');
  const rows=[FTTX_EXPORT_HEADERS,...report.items.map(item=>[
    report.project,item.group,item.name,item.unit,number(item.quantity),number(item.price),number(item.subtotal),
    item.source,item.checkedOn,item.url])];
  const quote=value=>{
    const safe=/^[\s]*[=+\-@]/.test(value)?"'"+value:value;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
}

let fttxExportRequest;
async function exportFttx(format){
  const result=calculateFttx(fttxDraft);
  const {groups,alerts,routeTotal,reserveTotal,cableTotal,ctoPorts,ponPortsNeeded,ponRatio,optical}=result;
  const costs=fttxCostRows(groups);
  if(alerts.length||!costs.items.length||fttxExportRequest?.session===googleSession)return;
  const status=document.getElementById('fttx-export-status');
  const request={session:googleSession};
  fttxExportRequest=request;
  const project=fttxDraft.name?.trim()||'Projeto FTTx';
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format();
  const costPerPort=ctoPorts>0&&costs.subtotal!==null?costs.subtotal/ctoPorts:null;
  const report={...costs,project,date,routeTotal,reserveTotal,cableTotal,ctoPorts,ponPortsNeeded,ponRatio,costPerPort,optical};
  const filename=project.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ').trim()||'Projeto FTTx';
  const exports={
    pdf:[buildFttxPdf,'application/pdf'],
    xlsx:[buildFttxWorkbook,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    csv:[buildFttxCsv,'text/csv;charset=utf-8']
  };
  try{
    status.textContent='Preparando o arquivo…';
    const [build,mime]=exports[format];
    const contents=await build(report);
    if(googleSession!==request.session)return;
    download(contents,filename+' - Lista de materiais.'+format,mime);
    status.textContent='Arquivo gerado.';
  }catch(error){
    if(googleSession===request.session)status.textContent='Falha ao gerar o arquivo. '+error.message;
  }finally{
    if(fttxExportRequest===request)fttxExportRequest=null;
  }
}

function rerenderFttxPane(){
  const pane=isGoogleMode()?document.getElementById('portal-fttx-pane'):document.getElementById('app');
  if(pane)pane.innerHTML=renderFttx();
}

document.addEventListener('click',event=>{
  const exportButton=event.target.closest('[data-fttx-export]');
  if(exportButton&&fttxActive())exportFttx(exportButton.dataset.fttxExport);
});

document.addEventListener('input',saveFttx);
document.addEventListener('change',async event=>{
  if(!fttxActive())return;
  const target=event.target;
  if(target.matches('select[data-fttx-field]')){saveFttx(event);return;}
  if(target.dataset.fttxCheckbox){
    fttxDraft[target.dataset.fttxCheckbox]=target.checked;
    persistFttx();
    updateFttxResults();
    return;
  }
  if(target.id==='fttx-kml-file'&&target.files?.length){
    const file=target.files[0],status=document.getElementById('fttx-kml-status');
    try{
      if(status)status.textContent='Lendo '+file.name+'…';
      const kmlText=/\.kmz$/i.test(file.name)?await extractKmlFromKmz(await file.arrayBuffer()):await file.text();
      const parsed=parseFttxKml(kmlText);
      const gauges=Object.keys(parsed.cables).map(Number);
      if(!gauges.length&&!parsed.cto&&!parsed.endCto&&!parsed.ceo&&!parsed.poles){
        throw Error('Nenhum trecho de cabo ou ponto reconhecido no arquivo.');
      }
      fttxDraft.cables??={};
      let dominant=12,maxMeters=-1;
      for(const g of gauges){
        fttxDraft.cables[g]??={};
        fttxDraft.cables[g].meters=String(parsed.cables[g]);
        if(parsed.cables[g]>maxMeters){maxMeters=parsed.cables[g];dominant=g;}
      }
      fttxDraft.cables[dominant]??={};
      if(parsed.cto)fttxDraft.cables[dominant].cto=String(parsed.cto);
      if(parsed.endCto)fttxDraft.cables[dominant].endCto=String(parsed.endCto);
      if(parsed.ceo)fttxDraft.cables[dominant].ceo=String(parsed.ceo);
      if(parsed.cep)fttxDraft.cep=String(parsed.cep);
      if(parsed.poles)fttxDraft.poles=String(parsed.poles);
      if(parsed.cto+parsed.endCto>0&&(!parsed.poles||parsed.poles>=parsed.cto+parsed.endCto)){
        fttxDraft.ctoPoles=String(parsed.cto+parsed.endCto);
      }
      if(!fttxDraft.name)fttxDraft.name=file.name.replace(/\.(kml|kmz)$/i,'').slice(0,100);
      persistFttx();
      rerenderFttxPane();
      const postStatus=document.getElementById('fttx-kml-status');
      const totalM=Object.values(parsed.cables).reduce((a,b)=>a+b,0);
      if(postStatus){
        postStatus.textContent=`Importado de ${file.name}: ${fttxQuantityFormat.format(totalM)} m de cabo, ${parsed.poles} poste(s), ${parsed.cto+parsed.endCto} CTO(s), ${parsed.ceo} CEO(s). Confira e ajuste os campos.`;
      }
    }catch(error){
      if(status)status.textContent='Não foi possível importar: '+error.message;
    }finally{target.value='';}
  }
});

document.addEventListener('click',event=>{
  if(!fttxActive())return;
  const step=event.target.closest('[data-fttx-step]');
  if(step)return goFttxStep(Number(step.dataset.fttxStep));
  const reset=event.target.closest('[data-fttx-reset]');
  if(reset){
    if(!confirm('Limpar todos os campos deste levantamento FTTx para iniciar um novo projeto?'))return;
    fttxDraft={step:1};
    persistFttx();
    rerenderFttxPane();
    return;
  }
  const saveScenario=event.target.closest('[data-fttx-scenario-save]');
  if(saveScenario){
    const name=String(fttxDraft.name||'').trim()||prompt('Nome do cenário para salvar:','Projeto FTTx');
    if(!name)return;
    fttxDraft.name=name.trim();
    const res=calculateFttx(fttxDraft),costs=fttxCostRows(res.groups);
    const list=loadFttxScenarios();
    const id='SCN-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    list.unshift({
      id,name:fttxDraft.name,savedAt:new Date().toISOString(),
      draft:JSON.parse(JSON.stringify(fttxDraft)),
      routeTotal:res.routeTotal,cableTotal:res.cableTotal,ctoPorts:res.ctoPorts,
      subtotal:costs.subtotal,costPerPort:res.ctoPorts>0&&costs.subtotal!==null?costs.subtotal/res.ctoPorts:null
    });
    saveFttxScenarios(list);
    persistFttx();
    rerenderFttxPane();
    return;
  }
  const loadScenario=event.target.closest('[data-fttx-scenario-load]');
  if(loadScenario){
    const found=loadFttxScenarios().find(x=>x.id===loadScenario.dataset.fttxScenarioLoad);
    if(!found)return;
    fttxDraft=JSON.parse(JSON.stringify(found.draft||{}));
    persistFttx();
    rerenderFttxPane();
    return;
  }
  const dupScenario=event.target.closest('[data-fttx-scenario-dup]');
  if(dupScenario){
    const list=loadFttxScenarios(),found=list.find(x=>x.id===dupScenario.dataset.fttxScenarioDup);
    if(!found)return;
    const copy=JSON.parse(JSON.stringify(found));
    copy.id='SCN-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    copy.name=(found.name+' (cópia)').slice(0,100);
    if(copy.draft)copy.draft.name=copy.name;
    copy.savedAt=new Date().toISOString();
    list.unshift(copy);
    saveFttxScenarios(list);
    rerenderFttxPane();
    return;
  }
  const delScenario=event.target.closest('[data-fttx-scenario-del]');
  if(delScenario){
    if(!confirm('Excluir este cenário salvo?'))return;
    saveFttxScenarios(loadFttxScenarios().filter(x=>x.id!==delScenario.dataset.fttxScenarioDel));
    rerenderFttxPane();
    return;
  }
  const estHw=event.target.closest('[data-fttx-estimate-hardware]');
  if(estHw){
    const patch=fttxEstimateHardware(fttxDraft);
    for(const [field,val] of Object.entries(patch)){
      fttxDraft[field]=String(val);
      const input=document.getElementById('fttx-'+field);
      if(input)input.value=String(val);
    }
    persistFttx();
    updateFttxResults();
    return;
  }
  const removeExtra=event.target.closest('[data-fttx-remove-extra]');
  if(removeExtra){
    const itemName=removeExtra.dataset.fttxRemoveExtra;
    if(fttxDraft.extras&&Object.hasOwn(fttxDraft.extras,itemName)){
      delete fttxDraft.extras[itemName];
      persistFttx();
      updateFttxResults();
      const status=document.getElementById('fttx-catalog-status');
      if(status)status.textContent=itemName+' retirado da lista.';
    }
    return;
  }
  const ctoFill=event.target.closest('[data-fttx-cto-fill]');
  if(ctoFill){
    const target=ctoFill.dataset.fttxCtoFill;
    const total=calculateFttx(fttxDraft).ctoTotal;
    if(!total){document.querySelector('[data-fttx-fiber="12"][data-fttx-field="cto"]')?.focus();return;}
    for(const [field] of FTTX_CTO_MODELS){
      const val=field===target?String(total):'';
      fttxDraft[field]=val;
      const input=document.getElementById('fttx-'+field);
      if(input)input.value=val;
    }
    persistFttx();
    updateFttxResults();
    document.getElementById('fttx-'+target)?.focus();
    return;
  }
  const ceoFill=event.target.closest('[data-fttx-ceo-fill]');
  if(ceoFill){
    const target=ceoFill.dataset.fttxCeoFill;
    const total=calculateFttx(fttxDraft).ceoTotal;
    if(!total){document.querySelector('[data-fttx-fiber="12"][data-fttx-field="ceo"]')?.focus();return;}
    for(const [field] of FTTX_CEO_MODELS){
      const val=field===target?String(total):'';
      fttxDraft[field]=val;
      const input=document.getElementById('fttx-'+field);
      if(input)input.value=val;
    }
    persistFttx();
    updateFttxResults();
    document.getElementById('fttx-'+target)?.focus();
    return;
  }
  const suggestion=event.target.closest('[data-fttx-suggestion]');
  if(suggestion){
    const field=suggestion.dataset.fttxSuggestion;
    const input=document.getElementById('fttx-'+field);
    let value=0;
    if(field==='asPoles')value=fttxQuantity(fttxDraft.poles);
    else if(field==='sleeve')value=fttxEstimatedSleeves(fttxDraft);
    else value=calculateFttx(fttxDraft).ctoTotal;
    if(value){
      input.value=value;
      saveFttx({target:input});
      input.focus();
    }else{
      const fallback=field==='asPoles'?'#fttx-poles':field==='sleeve'?'#fttx-sleeve':'[data-fttx-fiber="12"][data-fttx-field="cto"]';
      document.querySelector(fallback)?.focus();
    }
    return;
  }
  const jump=event.target.closest('[data-fttx-jump]');
  if(!jump)return;
  const heading=document.getElementById(jump.dataset.fttxJump);
  const details=heading.closest('details');
  if(details)details.open=true;
  heading.focus({preventScroll:true});
  heading.scrollIntoView({block:'start'});
});
document.addEventListener('input',event=>{
  if(event.target.id==='fttx-search'){
    document.getElementById('fttx-catalog-item').innerHTML=fttxCatalogOptions(event.target.value);
    document.getElementById('fttx-catalog-quantity').value='';
  }
});
document.addEventListener('change',event=>{
  if(!fttxActive())return;
  const field=event.target;
  if(field.id==='fttx-catalog-item'){
    const quantity=document.getElementById('fttx-catalog-quantity');
    quantity.value=fttxDraft.extras?.[field.value]??'';
    quantity.step=field.selectedOptions[0]?.dataset.unit==='un'?'1':'0.01';
  }
  if(field.dataset.fttxPrice){
    if(!field.validity.valid){field.reportValidity();return;}
    fttxDraft.prices??={};
    fttxDraft.prices[field.dataset.fttxPrice]=field.value;
    persistFttx();
    updateFttxPrices();
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='fttx-catalog-form')return;
  event.preventDefault();
  const item=document.getElementById('fttx-catalog-item'),quantity=document.getElementById('fttx-catalog-quantity');
  const amount=fttxQuantity(quantity.value,item.selectedOptions[0]?.dataset.unit!=='un');
  fttxDraft.extras??={};
  if(amount)fttxDraft.extras[item.value]=amount;
  else delete fttxDraft.extras[item.value];
  persistFttx();
  updateFttxResults();
  document.getElementById('fttx-catalog-status').textContent=amount?item.value+' atualizado na lista.':item.value+' retirado da lista.';
});
