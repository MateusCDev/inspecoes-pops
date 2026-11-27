function schedulingDays_(criticality){
  const normalized=String(criticality||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  if(['ALTA','CRITICA','CRITICO'].includes(normalized))return 45;
  if(normalized==='MEDIA')return 90;
  return null;
}
function stations_(){
  const ctx=context_();
  if(ctx.stations)return ctx.stations;
  const sheet=book_(config_().SPREADSHEET_ID).getSheetByName('POPs');
  if(!sheet||sheet.getLastRow()<1)throw Error('Cadastro de POPs indisponível.');
  const data=sheet.getRange(1,1,sheet.getLastRow(),10).getValues(),header=data.shift();
  if(header[0]!=='Código'||header[1]!=='Nome da Estação'||header[8]!=='Criticidade')throw Error('Cabeçalho do cadastro de POPs incompatível.');
  const stations=data.flatMap(row=>{
    const code=String(row[0]??'').trim(),name=String(row[1]??'').trim();
    if(!code||!name)return [];
    const criticality=String(row[8]||'').trim();
    const inactive=code==='PCAM.021'&&name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()==='POP CORDEBRAS';
    return [{code,name,city:String(row[3]||''),criticality,days:schedulingDays_(criticality),inactive}];
  });
  const counts=Object.create(null);stations.filter(s=>!s.inactive).forEach(s=>counts[s.code]=(counts[s.code]||0)+1);
  ctx.stations=stations.map(s=>({...s,duplicate:!s.inactive&&counts[s.code]>1}));
  return ctx.stations;
}
function addInspectionDays_(date,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Data de vistoria inválida.');
  const d=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Data de vistoria inválida.');
  d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function applyScheduling_(record){
  const code=String(record.codigoPop??'').trim(),catalog=stations_();
  if(catalog.some(s=>s.inactive&&s.code===code&&s.name===record.nome))throw Error('Este POP foi retirado da programação de inspeções.');
  const station=catalog.find(s=>s.code===code&&!s.inactive);
  if(!station)throw Error('Selecione um código do cadastro de POPs.');
  if(station.duplicate)throw Error('O código deste POP está duplicado no cadastro. Solicite a correção à gestão.');
  if(!station.days)throw Error('A criticidade deste POP ainda não tem periodicidade definida.');
  record.codigoPop=station.code;record.nome=station.name;record.popCriticality=station.criticality;
  record.schedulePeriod=station.days;record.scheduleBaseDate=record.data;
  record.scheduleDueDate=addInspectionDays_(record.data,station.days);
  return {days:station.days,baseDate:record.data,dueDate:record.scheduleDueDate,criticality:station.criticality};
}
