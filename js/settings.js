import { enrichWordWithAI } from './ai.js';

function getStoredValue(key, fallback = '') {
	try {
		if (typeof localStorage === 'undefined') {
			return fallback;
		}

		const value = localStorage.getItem(key) || localStorage[key];
		return typeof value === 'string' && value.trim() ? value.trim() : fallback;
	} catch {
		return fallback;
	}
}

export function initSettings() {
	const apiKeyInput = document.getElementById('gemini-api-key');
	const modelInput = document.getElementById('gemini-model');
	const saveBtn = document.getElementById('settings-save');
	const deleteBtn = document.getElementById('settings-delete-key');
	const testBtn = document.getElementById('settings-test');
	const statusDiv = document.getElementById('settings-status');

	function setStatus(message, state = '') {
		statusDiv.textContent = message;
		statusDiv.className = state ? `settings-status ${state}` : 'settings-status';
	}

	modelInput.value = getStoredValue('geminiModel', 'gemini-2.5-flash');
	apiKeyInput.value = '';

	if (getStoredValue('geminiApiKey')) {
		setStatus('API key salvata su questo dispositivo.', 'success-message');
	} else {
		setStatus('Nessuna API key salvata.', 'loading');
	}

	saveBtn.onclick = () => {
		const key = apiKeyInput.value.trim();
		const model = modelInput.value.trim() || 'gemini-2.5-flash';

		if (!key) {
			setStatus('Inserisci una API key valida.', 'error-message');
			return;
		}

		try {
			localStorage.setItem('geminiApiKey', key);
			localStorage.setItem('geminiModel', model);
			apiKeyInput.value = '';
			setStatus('API key salvata su questo dispositivo.', 'success-message');
		} catch (error) {
			console.error(error);
			setStatus('Impossibile salvare le impostazioni.', 'error-message');
		}
	};

	deleteBtn.onclick = () => {
		try {
			localStorage.removeItem('geminiApiKey');
			apiKeyInput.value = '';
			setStatus('API key rimossa da questo dispositivo.', 'success-message');
		} catch (error) {
			console.error(error);
			setStatus('Impossibile eliminare la API key.', 'error-message');
		}
	};

	testBtn.onclick = async () => {
		setStatus('Test in corso...', 'loading');
		try {
			const result = await enrichWordWithAI('\u597d');
			setStatus(result ? 'Connessione riuscita.' : 'Nessuna risposta ricevuta.', 'success-message');
		} catch (error) {
			console.error(error);
			setStatus(`Errore: ${error && error.message ? error.message : error}`, 'error-message');
		}
	};
}
