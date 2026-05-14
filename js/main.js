import { openDB } from './storage.js';
import { initTabs } from './ui.js';
import { initDictionary } from './dictionary.js';
import { initGeneration } from './generation.js';
import { initStudy } from './study.js';
import { initSettings } from './settings.js';

async function bootstrap() {
	try {
		await openDB();

		const study = initStudy();
		const tabs = initTabs(study.renderStudy);
		initDictionary();
		initGeneration(study.renderStudy);
		initSettings(tabs.activateTab);

		if ('serviceWorker' in navigator) {
			window.addEventListener('load', () => {
				navigator.serviceWorker.register('service-worker.js').then(() => {
					console.log('Service Worker Registered');
				}).catch(error => {
					console.error('Service worker registration failed:', error);
				});
			});
		} else {
			console.warn('Service Worker not supported in this browser');
		}
	} catch (error) {
		console.error('Bootstrap failed:', error);
	}
}

bootstrap();
