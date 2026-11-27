const BUILD = '__BUILD_ID__';
const BASE = new URL('./', self.location.href);
const CACHE_PREFIX = 'voanet-google:'+BASE.pathname+':';
const CACHE = CACHE_PREFIX+BUILD;
const FILES = ['index.html','portal.css?v='+BUILD,'inspection-layout.css?v='+BUILD,'fttx-layout.css?v='+BUILD,'portal.js?v='+BUILD,'voanet.png','config.js?v='+BUILD,'inspection-photos.js?v='+BUILD,'google-sync.js?v='+BUILD,'google-features.js?v='+BUILD,'google-pdf.js?v='+BUILD,'google-access.js?v='+BUILD,'fttx-catalog.js?v='+BUILD,'fttx-export.js?v='+BUILD,'fttx.js?v='+BUILD,'fttx-prices.json','entra-client.js','manifest.webmanifest','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
const VENDOR_PREFIX = new URL('vendor/',BASE).pathname;
const STATIC_IMAGES = new Set(['voanet.png','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).pathname));
const PATHS = new Set([...FILES, 'vendor/pdf-lib-1.17.1.min.js', 'vendor/exceljs-4.4.0.min.js'].map(url=>new URL(url,BASE).pathname));
function isImmutableAsset(u){
  return u.searchParams.get('v')===BUILD || u.pathname.startsWith(VENDOR_PREFIX) || STATIC_IMAGES.has(u.pathname);
}
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  // Remove somente caches antigos deste mesmo aplicativo, preservando outros apps no mesmo github.io.
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==BASE.origin || !u.pathname.startsWith(BASE.pathname))return;
  if(u.pathname.startsWith(new URL('frota/',BASE).pathname))return;
  if(e.request.mode!=='navigate' && !PATHS.has(u.pathname))return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(e.request.mode!=='navigate' && isImmutableAsset(u)){
      const cached=await cache.match(e.request);
      if(cached)return cached;
      const response=await fetch(e.request);
      if(response.ok)await cache.put(e.request,response.clone());
      return response;
    }
    try {
      const response=await fetch(e.request,{cache:'no-store'});
      if(response.ok)await cache.put(e.request,response.clone());
      return response;
    } catch(error) {
      const saved=await cache.match(e.request,{ignoreSearch:true}) || (e.request.mode==='navigate' ? await cache.match(new URL('index.html',BASE).href) : undefined);
      if(saved)return saved;
      throw error;
    }
  })());
});
