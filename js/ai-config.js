// Configurazione Gemini API

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function readStorageValue(key) {
	try {
		if (typeof localStorage === 'undefined') return '';
		const direct = localStorage.getItem(key);
		if (typeof direct === 'string' && direct.trim()) return direct.trim();
		const propertyValue = localStorage[key];
		return typeof propertyValue === 'string' ? propertyValue.trim() : '';
	} catch {
		return '';
	}
}

export function getGeminiApiKey() {
	return readStorageValue('geminiApiKey');
}

export function getGeminiModel() {
	return readStorageValue('geminiModel') || DEFAULT_GEMINI_MODEL;
}
