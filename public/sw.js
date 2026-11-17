const BUILD = '__BUILD_ID__';
const BASE = new URL('./', self.location.href);
const CACHE = 'voanet-google:'+BASE.pathname+':'+BUILD;
const FILES = ['index.html','config.js?v='+BUILD,'google-sync.js?v='+BUILD,'google-features.js?v='+BUILD,'google-access.js?v='+BUILD,'entra-client.js','manifest.webmanifest','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
const PATHS = new Set(FILES.map(url=>new URL(url).pathname));
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  // Não apagar caches de outros aplicativos em outros caminhos do mesmo github.io.
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==BASE.origin || !u.pathname.startsWith(BASE.pathname))return;
  if(e.request.mode!=='navigate' && !PATHS.has(u.pathname))return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
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
