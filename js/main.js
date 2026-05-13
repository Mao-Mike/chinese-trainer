import { openDB } from './storage.js';
import { initTabs } from './ui.js';
import { initDictionary } from './dictionary.js';
import { initGeneration } from './generation.js';
import { initStudy } from './study.js';

async function bootstrap() {
	await openDB();

	const study = initStudy();
	initTabs(study.renderStudy);
	initDictionary();
	initGeneration(study.renderStudy);

	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('service-worker.js').then(() => {
				console.log('Service Worker Registered');
			});
		});
	} else {
		console.warn('Service Worker not supported in this browser');
	}
}

bootstrap();
