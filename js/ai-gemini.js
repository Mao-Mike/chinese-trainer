import { getGeminiApiKey, getGeminiModel, GEMINI_ENDPOINT } from './ai-config.js';
import { parseGeminiJSON } from './ai-utils.js';

// Chiamata fetch Gemini generica
export async function callGeminiJSON(prompt, options = {}) {
	const apiKey = getGeminiApiKey();
	if (!apiKey) {
		throw new Error('Gemini API key missing. Set localStorage.geminiApiKey first.');
	}
	const model = options.model || getGeminiModel();
	const endpoint = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
	const temperature = typeof options.temperature === 'number' ? options.temperature : 0.2;
	const maxOutputTokens = typeof options.maxOutputTokens === 'number' ? options.maxOutputTokens : 8192;

	   const response = await fetch(endpoint, {
		   method: 'POST',
		   headers: { 'Content-Type': 'application/json' },
		   body: JSON.stringify({
			   contents: [
				   { role: 'user', parts: [{ text: String(prompt) }] }
			   ],
			   generationConfig: {
				   temperature,
				   maxOutputTokens,
				   responseMimeType: 'application/json'
			   }
		   }),
		   signal: options.signal
	   });

	if (!response.ok) {
		let body = '';
		try { body = (await response.text()).trim(); } catch { body = ''; }
		console.error('Gemini HTTP error', { status: response.status, model, body });
		if (response.status === 429 || /quota|rate/i.test(body)) {
			throw new Error('Gemini quota limit reached');
		}
		throw new Error(`Gemini request failed (${response.status})`);
	}

	let responseData;
	let rawResponse = '';
	try {
		rawResponse = await response.text();
		responseData = JSON.parse(rawResponse);
	} catch {
		console.error('Gemini returned invalid JSON', rawResponse);
		throw new Error('Gemini returned invalid JSON');
	}

	const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (typeof text !== 'string' || !text.trim()) {
		console.error('Gemini returned empty response', responseData);
		throw new Error('Gemini returned empty response');
	}

	return parseGeminiJSON(text);
}
