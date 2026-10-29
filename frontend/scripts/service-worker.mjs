import fs from "node:fs/promises";
const html = await fs.readFile("dist/index.html", "utf8");
const ui = [
  ...html.matchAll(new RegExp('(?:src|href)="(/ui/[^"]+)"', "g")),
].map((x) => x[1]);
const files = [
  "/",
  "/index.html",
  ...ui,
  "/manifest.webmanifest",
  "/icons/ninho-192.png",
];
const revision =
  "ninho-docker-" +
  (await import("node:crypto"))
    .createHash("sha256")
    .update(html)
    .digest("hex")
    .slice(0, 12);
await fs.writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(revision)},FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('ninho-docker-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||u.pathname.startsWith('/api/')||e.request.method!=='GET')return;e.respondWith((async()=>{try{return await fetch(e.request)}catch{const c=await caches.match(e.request);if(c)return c;if(e.request.mode==='navigate')return await caches.match('/index.html');return new Response('Indisponível offline',{status:503})}})())});`,
);
