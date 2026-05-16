// Utility generali per AI (id, parsing, normalizzazione)

export function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function stripMarkdownFences(value) {
	const text = String(value ?? '').trim();
	const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fenced) {
		return fenced[1].trim();
	}
	return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export function extractJSONText(value) {
	const text = stripMarkdownFences(value);
	if (!text) return '';
	const firstObject = text.indexOf('{');
	const lastObject = text.lastIndexOf('}');
	if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
		return text.slice(firstObject, lastObject + 1);
	}
	const firstArray = text.indexOf('[');
	const lastArray = text.lastIndexOf(']');
	if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
		return text.slice(firstArray, lastArray + 1);
	}
	return text;
}

export function parseGeminiJSON(text) {
	const cleaned = extractJSONText(text);
	if (!cleaned) throw new Error('Gemini returned empty response');
	try {
		return JSON.parse(cleaned);
	} catch {
		console.error('Gemini returned invalid JSON', text);
		throw new Error('Gemini returned invalid JSON');
	}
}
