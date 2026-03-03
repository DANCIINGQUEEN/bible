// 성경 앱 Service Worker
const CACHE_NAME = 'bible-app-v14'; // history.back() 버그 수정 + 스와이프 고정

// 사전 캐시할 정적 리소스
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/chapters.html',
    '/verses.html',
    '/hymns.html',
    '/hymn.html',
    '/style.css',
    '/common.js',
    '/books.js',
    '/chapters.js',
    '/verses.js',
    '/hymns.js',
    '/hymn.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// Install: 정적 리소스 사전 캐시
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: 오래된 캐시 정리
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: 요청 가로채기
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // ⭐ 핵심 수정: 현재 도메인(origin)이 아닌 외부 요청(Firebase Storage 등)은 SW가 개입하지 않음
    if (url.origin !== self.location.origin) {
        return; // 아무것도 반환하지 않으면 브라우저가 알아서 네이티브하게 네트워크 요청을 처리합니다.
    }

    // API 요청: Network First 전략
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // 정적 리소스: Cache First 전략 (이제 내부 도메인 리소스만 여기를 탐)
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                });
            })
    );
});