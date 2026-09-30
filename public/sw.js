// 하늘정원 서비스워커. 계획 6에서 push·notificationclick, 계획 8에서 앱 셸 캐시를 추가한다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
