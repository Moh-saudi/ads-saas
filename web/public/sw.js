// Cache only public offline assets; never persist authenticated pages or customer data.
const CACHE='mesk-offline-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/offline.html','/icon.svg'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mesk-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));}});
