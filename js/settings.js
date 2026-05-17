// js/settings.js

import { enrichWordWithAI } from './ai.js';
import { getAIUsageToday, resetAIUsage } from './storage.js';
import { hasGeminiApiKey, getFriendlyAIErrorMessage } from './utils.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function initSettings() {
	const apiKeyInput = document.getElementById('gemini-api-key');
	const modelInput = document.getElementById('gemini-model');
	const saveBtn = document.getElementById('settings-save');
	const deleteBtn = document.getElementById('settings-delete-key');
	const testBtn = document.getElementById('settings-test');
	const statusDiv = document.getElementById('settings-status');

	const aiUsageTotal = document.getElementById('ai-usage-total');
	const aiUsageGeneration = document.getElementById('ai-usage-generation');
	const aiUsagePinyin = document.getElementById('ai-usage-pinyin');
	const aiUsageResetBtn = document.getElementById('ai-usage-reset');

	function setStatus(message = '', state = '') {
		if (!statusDiv) return;

		statusDiv.textContent = message;
		statusDiv.className = state
			? `status-message settings-status ${state}`
			: 'status-message settings-status';
	}

	function updateAIUsageCounter() {
		const usage = getAIUsageToday();

		if (aiUsageTotal) {
			aiUsageTotal.textContent = `Totale: ${usage.total}`;
		}

		if (aiUsageGeneration) {
			aiUsageGeneration.textContent = `Generazioni: ${usage.generation}`;
		}

		if (aiUsagePinyin) {
			aiUsagePinyin.textContent = `Pinyin: ${usage.pinyin}`;
		}
	}

	function getStoredModel() {
		try {
			const model = localStorage.getItem('geminiModel');
			return typeof model === 'string' && model.trim()
				? model.trim()
				: DEFAULT_GEMINI_MODEL;
		} catch {
			return DEFAULT_GEMINI_MODEL;
		}
	}

	function saveSettings() {
		const key = apiKeyInput ? apiKeyInput.value.trim() : '';
		const model = modelInput && modelInput.value.trim()
			? modelInput.value.trim()
			: DEFAULT_GEMINI_MODEL;

		if (!key) {
			setStatus('Inserisci una API key valida.', 'error-message');
			return;
		}

		try {
			localStorage.setItem('geminiApiKey', key);
			localStorage.setItem('geminiModel', model);

			if (apiKeyInput) {
				apiKeyInput.value = '';
			}

			if (modelInput) {
				modelInput.value = model;
			}

			setStatus('API key salvata su questo dispositivo.', 'success-message');
			updateAIUsageCounter();
		} catch (error) {
			console.error(error);
			setStatus('Impossibile salvare le impostazioni.', 'error-message');
		}
	}

	function deleteApiKey() {
		try {
			localStorage.removeItem('geminiApiKey');

			if (apiKeyInput) {
				apiKeyInput.value = '';
			}

			setStatus('API key rimossa da questo dispositivo.', 'success-message');
			updateAIUsageCounter();
		} catch (error) {
			console.error(error);
			setStatus('Impossibile eliminare la API key.', 'error-message');
		}
	}

	async function testConnection() {
		if (!hasGeminiApiKey()) {
			setStatus('Inserisci la Gemini API key in Impostazioni.', 'error-message');
			return;
		}

		if (testBtn) {
			testBtn.disabled = true;
		}

		setStatus('Test in corso...', 'loading');

		try {
			const result = await enrichWordWithAI('好');

			if (result && result.pinyin) {
				setStatus('Test riuscito. Chiamata AI funzionante.', 'success-message');
			} else {
				setStatus('Test completato, ma risposta incompleta.', 'error-message');
			}
		} catch (error) {
			console.error(error);
			setStatus(getFriendlyAIErrorMessage(error), 'error-message');
		} finally {
			if (testBtn) {
				testBtn.disabled = false;
			}

			updateAIUsageCounter();
		}
	}

	function resetCounter() {
		resetAIUsage();
		updateAIUsageCounter();
		setStatus('Contatore AI azzerato.', 'success-message');
	}

	if (modelInput) {
		modelInput.value = getStoredModel();
	}

	if (apiKeyInput) {
		apiKeyInput.value = '';
	}

	if (hasGeminiApiKey()) {
		setStatus('API key salvata su questo dispositivo.', 'success-message');
	} else {
		setStatus('Nessuna API key salvata.', 'loading');
	}

	updateAIUsageCounter();

	if (saveBtn) {
		saveBtn.onclick = saveSettings;
	}

	if (deleteBtn) {
		deleteBtn.onclick = deleteApiKey;
	}

	if (testBtn) {
		testBtn.onclick = testConnection;
	}

	if (aiUsageResetBtn) {
		aiUsageResetBtn.onclick = resetCounter;
	}

	return {
		updateAIUsageCounter
	};
}