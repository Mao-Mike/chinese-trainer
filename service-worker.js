
const CACHE_NAME = 'chinese-trainer-v2';
const ASSETS = [
	'index.html',
	'style.css',
	'app.js',
	'manifest.json'
];
const NETWORK_FIRST_ASSETS = ASSETS;

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

	if (isNetworkFirstAsset) {
		event.respondWith(
			fetch(event.request)
				.then(response => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
					return response;
				})
				.catch(() => caches.match(event.request))
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then(response => response || fetch(event.request))
	);
});
