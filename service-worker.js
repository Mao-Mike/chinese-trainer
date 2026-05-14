
const CACHE_NAME = 'chinese-trainer-v9';
const ASSETS = [
  'index.html',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'js/ai.js',
  'js/main.js',
  'js/storage.js',
  'js/dictionary.js',
  'js/generation.js',
  'js/settings.js',
  'js/study.js',
  'js/ui.js',
  'js/utils.js'
];
const NETWORK_FIRST_ASSETS = [
  'index.html',
  'style.css',
  'manifest.json',
  'js/ai.js',
  'js/main.js',
  'js/storage.js',
  'js/dictionary.js',
  'js/generation.js',
  'js/settings.js',
  'js/study.js',
  'js/ui.js',
  'js/utils.js'
];

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(
				keys
					.filter(key => key !== CACHE_NAME)
					.map(key => caches.delete(key))
			)
		).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', event => {
	const requestUrl = new URL(event.request.url);
	const isNetworkFirstAsset = NETWORK_FIRST_ASSETS.some(asset =>
		requestUrl.pathname.endsWith(`/${asset}`) || requestUrl.pathname.endsWith(asset)
	);

	const isNavigationRequest = event.request.mode === 'navigate';

	if (isNetworkFirstAsset || isNavigationRequest) {
		event.respondWith(
			fetch(event.request)
				.then(response => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
					return response;
				})
				.catch(() => caches.match(event.request).then(cached => cached || caches.match('index.html')))
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then(response => response || fetch(event.request))
	);
});
