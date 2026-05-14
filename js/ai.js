import { normalizeGeneratedContent } from './utils.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorageValue(key) {
	try {
		if (typeof localStorage === 'undefined') {
			return '';
		}

		const direct = localStorage.getItem(key);
		if (typeof direct === 'string' && direct.trim()) {
			return direct.trim();
		}

		const propertyValue = localStorage[key];
		return typeof propertyValue === 'string' ? propertyValue.trim() : '';
	} catch {
		return '';
	}
}

function getGeminiApiKey() {
	return readStorageValue('geminiApiKey');
}

function getGeminiModel() {
	return readStorageValue('geminiModel') || DEFAULT_GEMINI_MODEL;
}

function stripMarkdownFences(value) {
	const text = String(value ?? '').trim();
	const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fenced) {
		return fenced[1].trim();
	}

	return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJSONText(value) {
	const text = stripMarkdownFences(value);
	if (!text) {
		return '';
	}

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

function parseGeminiJSON(text) {
	const cleaned = extractJSONText(text);
	if (!cleaned) {
		throw new Error('Gemini returned empty response');
	}

	try {
		return JSON.parse(cleaned);
	} catch {
		console.error('Gemini returned invalid JSON', text);
		throw new Error('Gemini returned invalid JSON');
	}
}

async function callGeminiJSON(prompt, options = {}) {
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
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			contents: [
				{
					role: 'user',
					parts: [{ text: String(prompt) }]
				}
			],
			generationConfig: {
				temperature,
				maxOutputTokens,
				responseMimeType: 'application/json'
			}
		})
	});

	if (!response.ok) {
		let body = '';
		try {
			body = (await response.text()).trim();
		} catch {
			body = '';
		}

		console.error('Gemini HTTP error', {
			status: response.status,
			model,
			body
		});

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

function normalizeVocabularyWord(word, index) {
	if (!word) {
		return null;
	}

	if (typeof word === 'string') {
		const hanzi = word.trim();
		return hanzi ? { hanzi, createdAt: 0, index } : null;
	}

	if (typeof word !== 'object') {
		return null;
	}

	const hanzi = typeof word.hanzi === 'string' ? word.hanzi.trim() : '';
	if (!hanzi) {
		return null;
	}

	const createdAt = Number.isFinite(Number(word.createdAt)) ? Number(word.createdAt) : 0;
	return { hanzi, createdAt, index };
}

export function selectHanziVocabulary(words, maxWords = 120) {
	if (!Array.isArray(words) || maxWords <= 0) {
		return [];
	}

	const normalized = words
		.map((word, index) => normalizeVocabularyWord(word, index))
		.filter(Boolean);

	const hasCreatedAt = normalized.some(item => item.createdAt > 0);
	const ordered = hasCreatedAt
		? normalized.slice().sort((a, b) => {
			const timeDiff = (b.createdAt || 0) - (a.createdAt || 0);
			return timeDiff !== 0 ? timeDiff : a.index - b.index;
		})
		: normalized;

	const seen = new Set();
	const vocabulary = [];

	for (const item of ordered) {
		if (seen.has(item.hanzi)) {
			continue;
		}

		seen.add(item.hanzi);
		vocabulary.push(item.hanzi);

		if (vocabulary.length >= maxWords) {
			break;
		}
	}

	return vocabulary;
}

function buildRefsFromContent(content, fallbackLength) {
	const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
	const length = blocks.length || fallbackLength || 0;
	return Array.from({ length }, (_, index) => {
		const ref = typeof blocks[index]?.ref === 'string' && blocks[index].ref.trim()
			? blocks[index].ref.trim()
			: `[${index + 1}]`;
		return ref;
	});
}

function mapBlocksWithField(resultBlocks, fallbackRefs, field) {
	return fallbackRefs.map((ref, index) => {
		const resultBlock = Array.isArray(resultBlocks) ? resultBlocks[index] : null;
		const blockRef = typeof resultBlock?.ref === 'string' && resultBlock.ref.trim() ? resultBlock.ref.trim() : ref;
		return {
			ref: blockRef,
			[field]: typeof resultBlock?.[field] === 'string' ? resultBlock[field] : ''
		};
	});
}

function cleanGeneratedBlocks(blocks) {
	return blocks.map((block, index) => {
		const ref = typeof block.ref === 'string' && block.ref.trim() ? block.ref.trim() : `[${index + 1}]`;
		const speaker = typeof block.speaker === 'string' && /^[ABCD]$/.test(block.speaker.trim())
			? block.speaker.trim()
			: null;

		return {
			ref,
			speaker,
			chinese: typeof block.chinese === 'string' ? block.chinese : '',
			tokens: [],
			translation: '',
			explanation: ''
		};
	});
}

export async function enrichWordWithAI(hanzi) {
	const prompt = `You are a Chinese dictionary assistant.
The user provides one Chinese word or character.

Return ONLY valid JSON:
{
  "hanzi": "...",
  "pinyin": "...",
  "notes": "..."
}

Rules:
- pinyin must use tone marks
- hanzi must be simplified Chinese if possible
- no markdown
- no text outside JSON

User input:
${String(hanzi ?? '').trim()}`;

	const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 1024 });
	if (!result || typeof result !== 'object' || Array.isArray(result)) {
		throw new Error('Gemini returned invalid word data.');
	}

	return {
		hanzi: typeof result.hanzi === 'string' ? result.hanzi : String(hanzi ?? ''),
		pinyin: typeof result.pinyin === 'string' ? result.pinyin : '',
		notes: typeof result.notes === 'string' ? result.notes : ''
	};
}

export async function generateContentWithAI(options = {}) {
	const type = options?.type === 'dialogue' ? 'dialogue' : 'text';
	const topic = typeof options?.topic === 'string' ? options.topic.trim() : '';
	const targetLength = Number(options?.targetLength) || 100;
	const hanziVocabulary = selectHanziVocabulary(options?.words, 120);

	const prompt = `You are a Chinese text generator for a Chinese learning app.

Generate ONLY Chinese content.

Return ONLY valid JSON:
{
  "type": "text",
  "title": "",
  "topic": "",
  "targetLength": 100,
  "blocks": [
    {
      "ref": "[1]",
      "speaker": null,
      "chinese": ""
    }
  ],
  "usedWords": [],
  "newWords": []
}

Rules:
- type must be exactly the requested type: "text" or "dialogue".
- If type is "text", speaker must be null.
- If type is "dialogue", speaker must be "A", "B", "C", or "D".
- Use simplified Chinese characters.
- Use mostly the provided user vocabulary when possible.
- Introduce new words only if necessary.
- Do not generate pinyin.
- Do not generate translation.
- Do not generate explanation.
- Split text into blocks of about 100 Chinese characters.
- For dialogue, use one block per turn.
- Return JSON only.
- No markdown.
- No comments outside JSON.

Requested settings:
${JSON.stringify({ type, topic, targetLength }, null, 2)}

User vocabulary hanzi only:
${JSON.stringify(hanziVocabulary, null, 2)}`;

	const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 8192 });
	const normalized = normalizeGeneratedContent(result);

	if (!normalized || !Array.isArray(normalized.blocks) || !normalized.blocks.length) {
		throw new Error('Gemini returned content without blocks.');
	}

	const cleanedBlocks = cleanGeneratedBlocks(normalized.blocks);

	return {
		id: typeof normalized.id === 'string' && normalized.id.trim() ? normalized.id.trim() : makeId(),
		createdAt: Number.isFinite(Number(normalized.createdAt)) ? Number(normalized.createdAt) : Date.now(),
		type: normalized.type === 'dialogue' ? 'dialogue' : 'text',
		title: typeof normalized.title === 'string' ? normalized.title : '',
		topic: typeof normalized.topic === 'string' ? normalized.topic : topic,
		targetLength: Number.isFinite(Number(normalized.targetLength)) ? Number(normalized.targetLength) : targetLength,
		blocks: cleanedBlocks,
		usedWords: Array.isArray(normalized.usedWords) ? normalized.usedWords : [],
		newWords: Array.isArray(normalized.newWords) ? normalized.newWords : [],
		pinyinGenerated: false,
		translationGenerated: false,
		explanationGenerated: false
	};
}

export async function translateContentWithAI(content) {
	const prompt = `You are a concise Chinese to English translator.

Translate the provided Chinese learning content into natural English.

Return ONLY valid JSON:
{
  "blocks": [
    {
      "ref": "[1]",
      "translation": ""
    }
  ]
}

Rules:
- Keep the same refs.
- Translate only the provided Chinese text.
- Do not add explanations.
- Do not add pinyin.
- Do not add alternatives.
- Do not add summaries.
- No markdown.
- No text outside JSON.

Content:
${JSON.stringify(content ?? {}, null, 2)}`;

	const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 8192 });
	const resultBlocks = Array.isArray(result?.blocks) ? result.blocks : [];
	if (!resultBlocks.length) {
		throw new Error('Gemini returned content without blocks.');
	}

	const fallbackRefs = buildRefsFromContent(content, resultBlocks.length);
	const blocks = mapBlocksWithField(resultBlocks, fallbackRefs, 'translation');

	return { blocks };
}

export async function explainContentWithAI(content) {
	const prompt = `You are a Chinese language teacher.

Improve the explanations for this generated Chinese learning content.

Return ONLY valid JSON:
{
  "blocks": [
    {
      "ref": "[1]",
      "explanation": ""
    }
  ]
}

Rules:
- Explanation must be in English.
- Explain meaning, grammar and syntax concisely.
- Do not generate pinyin.
- Do not generate full translation.
- Keep the same refs.
- No markdown.
- No text outside JSON.

Content:
${JSON.stringify(content ?? {}, null, 2)}`;

	const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 8192 });
	const resultBlocks = Array.isArray(result?.blocks) ? result.blocks : [];
	if (!resultBlocks.length) {
		throw new Error('Gemini returned content without blocks.');
	}

	const fallbackRefs = buildRefsFromContent(content, resultBlocks.length);
	const blocks = mapBlocksWithField(resultBlocks, fallbackRefs, 'explanation');

	return { blocks };
}
