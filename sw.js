/* Rename Bot 오프라인 저장 (서비스 워커)
   - 한 번 인터넷으로 열면 앱을 폰에 저장 -> 이후 인터넷 없이 열림
   - 열 때마다 저장본을 먼저 보여주고, 인터넷이 되면 뒤에서 새 버전을 받아둠 */
const CACHE = "rename-bot-5e230ff8";
const APP = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === "navigate";
  const key = isPage ? "./" : req;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key, { ignoreSearch: true });
    const update = fetch(req, { cache: "no-cache" }).then(async (res) => {
      if (res.ok) {
        const changed = hit && isPage && hit.headers.get("etag") && res.headers.get("etag") &&
                        hit.headers.get("etag") !== res.headers.get("etag");
        await cache.put(key, res.clone());
        if (changed) {
          const clients = await self.clients.matchAll({ type: "window" });
          clients.forEach((c) => c.postMessage({ type: "updated" }));
        }
      }
      return res;
    }).catch(() => null);
    e.waitUntil(update);
    return hit || (await update) || (await cache.match("./")) || Response.error();
  })());
});
