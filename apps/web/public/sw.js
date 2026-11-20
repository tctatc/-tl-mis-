/*
 * Service worker ของเว็บแอป CSIS
 *  - /_next/static/* (ชื่อไฟล์มีแฮช เนื้อหาไม่เปลี่ยน) + ไอคอน → ใช้จากเครื่องก่อน เปิดแอปเร็วแม้เน็ตช้า
 *  - หน้าเว็บ (navigate) → ถามเน็ตก่อนเสมอ ไม่มีเน็ตค่อยใช้หน้าที่เคยเปิด หรือหน้า "ออฟไลน์"
 *  - ไม่แตะ /api เด็ดขาด: ผลการเรียน เลขบัตร คำร้อง ไม่ถูกเก็บในเครื่อง (PDPA)
 *    หน้าเว็บที่เก็บเป็นแค่โครงหน้า ข้อมูลส่วนตัวโหลดผ่าน /api ทุกครั้ง
 */
const VERSION = 'v3';
const PAGES = `csis-pages-${VERSION}`;
const STATIC = `csis-static-${VERSION}`;
const KEEP = [PAGES, STATIC];
const OFFLINE = '/offline.html';
const PRECACHE = [OFFLINE, '/college-logo.png', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
    // ไฟล์ static เวอร์ชันเก่าสะสม — เก็บแค่ 150 ไฟล์ล่าสุด
    const cache = await caches.open(STATIC);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - 150)).map((key) => cache.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

// ออกจากระบบ: หน้าเว็บส่ง 'logout' มา → ล้างหน้าที่เก็บไว้ (เครื่องสาธารณะ/ใช้ร่วมกัน)
self.addEventListener('message', (event) => {
  if (event.data === 'logout') event.waitUntil(caches.delete(PAGES).then(() => caches.open(PAGES)).then((c) => c.addAll(PRECACHE)));
});

async function page(event) {
  const cache = await caches.open(PAGES);
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    // เก็บเฉพาะหน้าปกติที่โหลดสำเร็จ (ไม่เก็บหน้าพิมพ์ ไม่เก็บ redirect)
    if (response.ok && !response.redirected && !new URL(event.request.url).pathname.startsWith('/print')) {
      cache.put(event.request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(event.request, { ignoreSearch: true })) || (await cache.match(OFFLINE)) || Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request); // รวมไฟล์ที่ precache ไว้ (โลโก้ของหน้าออฟไลน์)
  if (hit) return hit;
  const cache = await caches.open(STATIC);
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // ห้ามแตะข้อมูลส่วนบุคคล
  if (request.mode === 'navigate') { event.respondWith(page(event)); return; }
  if (url.pathname.startsWith('/_next/static/') || /^\/(icon-|apple-touch-icon|college-logo)/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
