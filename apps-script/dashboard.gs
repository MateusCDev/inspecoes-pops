function summaryItem_(row,idx){
  const get=k=>row[idx[k]],revision=recordRevision_(row[0]);
  return {id:row[0],stationCode:get('codigo_pop'),station:get('nome'),date:get('data'),updated:get('updated'),technician:get('inspetor'),owner:recordOwner_(row[0])||'Autoria não vinculada',criticality:get('classificacao'),nc:Number(get('itens_nao_conformes'))||0,conform:Number(get('itens_conformes'))||0,unverified:Number(get('itens_nao_verificados'))||0,due:get('scheduleDueDate'),period:get('schedulePeriod'),issues:Number(get('qtd_pendencias'))||0,assets:revision?.assets||null};
}
function dashboard_(input,user){
  const scope=user.role==='GESTAO'?'GESTAO':user.email+'|OPERACAO';
  const key='dash_'+hash_(scope+'|'+(privateValue_('DATA_VERSION')||'0'));
  const cache=CacheService.getScriptCache(),cached=cache.get(key);if(cached)return JSON.parse(cached);
  const sheet=sheet_(),headers=headers_(),idx=headerMap_(headers),last=sheet.getLastRow();
  const rows=last>1?sheet.getRange(2,1,last-1,43).getValues():[];
  let total=0,c=0,nc=0;const byPOP=Object.create(null),latest=new Map(),items=[];let nextCursor=null;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];if(!row[0]||!canReadRow_(row,headers,user))continue;
    const item=summaryItem_(row,idx);total++;c+=item.conform;nc+=item.nc;byPOP[item.station]=(byPOP[item.station]||0)+item.nc;
    const stationKey=String(item.stationCode||'')+'|'+item.station,old=latest.get(stationKey);
    if(!old||String(item.date)+String(item.updated)>String(old.date)+String(old.updated))latest.set(stationKey,item);
    if(items.length<50){items.push(item);if(items.length===50&&i>0)nextCursor=i+1;}
  }
  const result={ok:true,items,nextCursor,summary:{total,conform:c,nc,ranking:Object.entries(byPOP).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,8),latest:[...latest.values()]},refreshedAt:new Date().toISOString()};
  const serialized=JSON.stringify(result);if(serialized.length<90000)cache.put(key,serialized,45);return result;
}
