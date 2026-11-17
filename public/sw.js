const CACHE = 'voanet-google-profiles-v2';
const BASE = new URL('./', self.location.href);
const FILES = ['index.html','config.js','google-sync.js','entra-client.js','manifest.webmanifest','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  // Não apagar caches de outros aplicativos em outros caminhos do mesmo github.io.
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==BASE.origin || !u.pathname.startsWith(BASE.pathname))return;
  if(e.request.mode!=='navigate' && !FILES.includes(u.href))return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(e.request);
      if(response.ok)await cache.put(e.request,response.clone());
      return response;
    } catch(error) {
      const saved=await cache.match(e.request) || (e.request.mode==='navigate' ? await cache.match(new URL('index.html',BASE).href) : undefined);
      if(saved)return saved;
      throw error;
    }
  })());
});
