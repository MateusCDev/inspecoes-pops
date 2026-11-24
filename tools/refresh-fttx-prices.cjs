'use strict';

const fs=require('node:fs');
const path=require('node:path');
const sources=require('./fttx-sources.json');
const output=path.resolve(__dirname,'../public/fttx-prices.json');
const live='https://mateuscdev.github.io/inspecoes-pops/fttx-prices.json';
const checkedOn=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function productKey(value,base){
  const url=new URL(value,base);
  return url.hostname.replace(/^www\./,'')+url.pathname.replace(/\/$/,'');
}

function structuredPrice(html,address){
  for(const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let data;
    try{data=JSON.parse(block[1]);}catch(_){continue;}
    const entities=Array.isArray(data)?data:data?.['@graph']||[data];
    for(const product of entities.flatMap(entity=>[entity,entity?.mainEntity])){
      if(![].concat(product?.['@type']).includes('Product'))continue;
      for(const offer of [].concat(product.offers||[])){
        if(!offer?.url||productKey(offer.url,address)!==productKey(address))continue;
        if(offer.priceCurrency!=='BRL'||!String(offer.availability).trim().endsWith('/InStock'))continue;
        const price=Number(offer.price);
        if(Number.isFinite(price)&&price>0)return price;
      }
    }
  }
  return null;
}

function baixadaPrice(html){
  if(!/<div\s+class=["']codigo estoque["']/.test(html))return null;
  const checkout=html.match(/<div\s+class=["']codigo estoque["'][\s\S]*?<div\s+class=["']comprar\b/);
  const price=checkout?.[0].match(/<span\s+class=["']precoCor["']>\s*R\$\s*([\d.]+,\d{2})/i)?.[1];
  return price?Number(price.replaceAll('.','').replace(',','.')):null;
}

async function request(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(9500),headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  return response;
}

async function loadPrevious(){
  const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')).references:{};
  if(!process.argv.includes('--previous'))return previous;
  try{
    const snapshot=await (await request(live)).json();
    for(const [key,reference] of Object.entries(snapshot.references||{})){
      const known=sources.some(([name,,url])=>name===key&&url===reference.url);
      if(known&&Number.isFinite(reference.price)&&reference.price>0&&/^\d{4}-\d{2}-\d{2}$/.test(reference.checkedOn)
        &&(!previous[key]||previous[key].checkedOn<=reference.checkedOn))previous[key]=reference;
    }
  }catch(_){console.log('Sem snapshot anterior no portal.');}
  return previous;
}

async function loadOffer([name,store,url,pack,details]){
  try{
    const response=await request(url);
    if(productKey(response.url)!==productKey(url))return null;
    const html=await response.text(),isBaixada=store==='BaixadaNet Telecom';
    const gross=isBaixada?baixadaPrice(html):structuredPrice(html,url);
    if(!Number.isFinite(gross)||gross<=0)return null;
    const minimum=isBaixada?Number(html.match(/name=["']qtd["'][^>]*\bvalue=["'](\d+)["']/i)?.[1]):0;
    const unit=Number((gross/pack).toFixed(4));
    if(unit<=0)return null;
    const text=minimum>1?details+' · pedido mínimo de '+minimum.toLocaleString('pt-BR'):details;
    return [name,{price:unit,store,url,details:text,checkedOn}];
  }catch(_){return null;}
}

async function main(){
  const previous=await loadPrevious(),confirmed={};
  // Agrupa consultas para não sobrecarregar as lojas.
  for(let start=0;start<sources.length;start+=5){
    const results=await Promise.all(sources.slice(start,start+5).map(loadOffer));
    for(const offer of results){
      if(offer&&!confirmed[offer[0]])confirmed[offer[0]]=offer[1];
    }
  }
  const references={...previous,...confirmed};
  fs.writeFileSync(output,JSON.stringify({references},null,2)+'\n');
  console.log(Object.keys(confirmed).length+' referências atualizadas, '+Object.keys(references).length+' disponíveis.');
}

if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={structuredPrice,baixadaPrice};
