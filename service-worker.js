// service-worker.js

const CACHE_NAME = 'chinese-trainer-v27';

const ASSETS = [
	'index.html',
	'style.css',
	'manifest.json',
	'icon-192.png',
	'icon-512.png',

	'js/main.js',
	'js/ui.js',
	'js/utils.js',
	'js/storage.js',

	'js/ai.js',
	'js/ai-config.js',
	'js/ai-dedupe.js',
	'js/ai-gemini.js',
	'js/ai-prompts.js',
	'js/ai-utils.js',

	'js/dictionary.js',
	'js/generation.js',
	'js/settings.js',

	'js/study.js',
	'js/study-dictionary.js',
	'js/study-speech.js',
	'js/study-ui.js'
];

const NETWORK_FIRST_ASSETS = [
	'index.html',
	'style.css',
	'manifest.json',

	'js/main.js',
	'js/ui.js',
	'js/utils.js',
	'js/storage.js',

	'js/ai.js',
	'js/ai-config.js',
	'js/ai-dedupe.js',
	'js/ai-gemini.js',
	'js/ai-prompts.js',
	'js/ai-utils.js',

	'js/dictionary.js',
	'js/generation.js',
	'js/settings.js',

	'js/study.js',
	'js/study-dictionary.js',
	'js/study-speech.js',
	'js/study-ui.js'
];

self.addEventListener('install', event => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then(cache => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches
			.keys()
			.then(keys =>
				Promise.all(
					keys
						.filter(key => key !== CACHE_NAME)
						.map(key => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', event => {
	const { request } = event;
	const url = new URL(request.url);

	const isSameOrigin = url.origin === self.location.origin;
	const isGeminiAPI = url.hostname.includes('generativelanguage.googleapis.com');
	const isExternal = !isSameOrigin || isGeminiAPI;
	const isNavigationRequest = request.mode === 'navigate';

	const isNetworkFirstAsset = isSameOrigin && NETWORK_FIRST_ASSETS.some(asset =>
		url.pathname.endsWith(`/${asset}`) || url.pathname.endsWith(asset)
	);

	const isCacheFirstAsset = isSameOrigin && ASSETS.some(asset =>
		url.pathname.endsWith(`/${asset}`) || url.pathname.endsWith(asset)
	);

	// API esterne, inclusa Gemini: nessuna cache, nessuna interferenza.
	if (isExternal) {
		return;
	}

	// Navigazione interna: network-first, fallback a index.html se offline.
	if (isNavigationRequest) {
		event.respondWith(
			fetch(request)
				.then(response => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
					return response;
				})
				.catch(() => caches.match('index.html'))
		);
		return;
	}

	// HTML, CSS e JS: network-first.
	if (isNetworkFirstAsset) {
		event.respondWith(
			fetch(request)
				.then(response => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
					return response;
				})
				.catch(() => caches.match(request))
		);
		return;
	}

	// Asset statici locali: cache-first.
	if (isCacheFirstAsset) {
		event.respondWith(
			caches.match(request).then(response => response || fetch(request))
		);
	}
});