const CACHE_NAME = 'math-learning-v3';
const urlsToCache = [
  './',
  'index.html',
  'kakao.html',
  'gsg.html',
  'dashboard.html',
  'advanced-dashboard.html',
  'advanced-search.html',
  'trading.html',
  'lottery.html',
  'shop.html',
  'profile.html',
  'gamification.html',
  'mock-exam.html',
  'exam-session.html',
  'exam-result.html',
  'study-groups.html',
  'favorite.html',
  'note.html',
  'feedback.html',
  'recommendations.html',
  'spaced-repetition.html',
  'qa-system.html',
  'mobile-optimized.html',
  'newbie.html',
  'info.html',
  'infoi.html',
  'admin-database-init.html',
  'initialize-coin-system.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'questions.json',
  // 외부 리소스는 버전 명시
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

// 오프라인 페이지 HTML
const offlinePage = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>오프라인 - 수학 학습 시스템</title>
    <style>
        body {
            font-family: 'Noto Sans KR', sans-serif;
            background: linear-gradient(135deg, #FF6B9D, #A8E6CF);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: white;
        }
        .offline-container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            max-width: 500px;
        }
        .offline-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        h1 {
            margin: 0 0 20px 0;
            font-size: 2rem;
        }
        p {
            margin: 0 0 30px 0;
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .retry-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .retry-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📶</div>
        <h1>오프라인 모드</h1>
        <p>인터넷 연결을 확인하고 다시 시도해주세요.</p>
        <button class="retry-btn" onclick="window.location.reload()">다시 시도</button>
    </div>
</body>
</html>
`;

// Service Worker 설치
self.addEventListener('install', event => {
  console.log('Service Worker 설치 중...');
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const requests = urlsToCache.map(u => new Request(u, { cache: 'reload' }));
        await cache.addAll(requests);
        // 오프라인 페이지 캐시 (상대 경로 키)
        await cache.put('offline.html', new Response(offlinePage, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      } catch (error) {
        console.error('캐시 저장 실패:', error);
      }
    })()
  );
  // 즉시 활성화
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', event => {
  console.log('Service Worker 활성화 중...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 모든 클라이언트에 제어권을 즉시 가져오기
      return clients.claim();
    })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Chromium 버그 회피: only-if-cached + cross-origin 요청 무시
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  // Firebase 관련 요청은 네트워크 우선
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      request.method === 'POST' ||
      request.method === 'PUT' ||
      request.method === 'DELETE') {
    event.respondWith(
      fetch(request)
        .catch(error => {
          console.log('네트워크 요청 실패, 캐시에서 검색:', error);
          return caches.match(request);
        })
    );
    return;
  }

  // 정적 리소스는 캐시 우선
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          console.log('캐시에서 응답:', request.url);
          return response;
        }
        
        console.log('네트워크에서 요청:', request.url);
        return fetch(request)
          .then(response => {
            // 성공적인 응답만 캐시에 저장
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // chrome-extension 스키마는 캐시하지 않음
            if (request.url.startsWith('chrome-extension://')) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          });
      })
      .catch(error => {
        console.log('요청 실패:', error);
        
        // 오프라인 페이지 반환
        if (request.destination === 'document' || request.mode === 'navigate') {
          return caches.match('offline.html');
        }
        
        return new Response('오프라인 모드입니다. 인터넷 연결을 확인해주세요.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain; charset=utf-8'
          })
        });
      })
  );
});

// 백그라운드 동기화
self.addEventListener('sync', event => {
  console.log('백그라운드 동기화:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 백그라운드에서 동기화할 작업들
      Promise.resolve()
    );
  }
});

// 푸시 알림 처리
self.addEventListener('push', event => {
  console.log('푸시 알림 수신:', event);
  
  let notificationData = {
    title: '송현여고 수학 학습',
    body: '새로운 알림이 있습니다.',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">수</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">수</text></svg>'
  };

  // 푸시 데이터가 있으면 파싱
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }
  
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: notificationData.url || '/dashboard.html'
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">👁</text></svg>'
      },
      {
        action: 'close',
        title: '닫기',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❌</text></svg>'
      }
    ],
    requireInteraction: true,
    tag: 'math-learning-notification'
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  console.log('알림 클릭:', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/dashboard.html')
    );
  } else if (event.action === 'close') {
    // 알림만 닫기
    return;
  } else {
    // 기본 동작: 대시보드 열기
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/dashboard.html')
    );
  }
});

// 메시지 처리
self.addEventListener('message', event => {
  console.log('Service Worker 메시지 수신:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
}); 