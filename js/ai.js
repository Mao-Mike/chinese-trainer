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
		throw new Error('Gemini returned an empty response.');
	}

	try {
		return JSON.parse(cleaned);
	} catch (error) {
		throw new Error(`Gemini returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function callGeminiJSON(prompt, options = {}) {
	const apiKey = getGeminiApiKey();
	if (!apiKey) {
		throw new Error('Gemini API key missing. Set localStorage.geminiApiKey first.');
	}

	const model = options.model || getGeminiModel();
	const endpoint = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
	const temperature = typeof options.temperature === 'number' ? options.temperature : 0.3;

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
				responseMimeType: 'application/json'
			}
		})
	});

	if (!response.ok) {
		let detail = '';
		try {
			const errorText = (await response.text()).trim();
			if (errorText) {
				try {
					const errorBody = JSON.parse(errorText);
					detail = errorBody?.error?.message || errorBody?.message || errorText;
				} catch {
					detail = errorText;
				}
			}
		} catch {
			detail = '';
		}

		throw new Error(`Gemini request failed (${response.status}).${detail ? ` ${detail}` : ''}`);
	}

	let data;
	try {
		data = await response.json();
	} catch (error) {
		throw new Error(`Gemini response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}

	const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (typeof text !== 'string' || !text.trim()) {
		throw new Error('Gemini returned an empty response.');
	}

	return parseGeminiJSON(text);
}

function sanitizeWords(words) {
	if (!Array.isArray(words)) {
		return [];
	}

	return words
		.filter(word => word && typeof word === 'object' && typeof word.hanzi === 'string' && word.hanzi.trim())
		.map(word => ({
			hanzi: word.hanzi.trim(),
			pinyin: typeof word.pinyin === 'string' ? word.pinyin.trim() : '',
			translation: typeof word.translation === 'string' ? word.translation.trim() : ''
		}));
}

function normalizeTokens(tokens, chinese) {
	const source = Array.isArray(tokens) && tokens.length
		? tokens
		: Array.from(typeof chinese === 'string' ? chinese : '');

	return source.map((token, index) => {
		if (token && typeof token === 'object') {
			return {
				hanzi: typeof token.hanzi === 'string' && token.hanzi.trim() ? token.hanzi : (chinese && chinese[index]) ? chinese[index] : '',
				pinyin: typeof token.pinyin === 'string' ? token.pinyin : ''
			};
		}

		const hanzi = typeof token === 'string' && token.trim()
			? token
			: (typeof chinese === 'string' && chinese[index]) ? chinese[index] : '';

		return {
			hanzi,
			pinyin: ''
		};
	});
}

function normalizeUsedWord(word) {
	if (!word) {
		return null;
	}

	if (typeof word === 'string') {
		const hanzi = word.trim();
		return hanzi ? { hanzi, pinyin: '', translation: '' } : null;
	}

	if (typeof word !== 'object') {
		return null;
	}

	const hanzi = typeof word.hanzi === 'string' ? word.hanzi.trim() : '';
	if (!hanzi) {
		return null;
	}

	return {
		hanzi,
		pinyin: typeof word.pinyin === 'string' ? word.pinyin.trim() : '',
		translation: typeof word.translation === 'string' ? word.translation.trim() : ''
	};
}

function normalizeBlock(block, index, type) {
	const safeBlock = block && typeof block === 'object' ? block : {};
	const chinese = typeof safeBlock.chinese === 'string'
		? safeBlock.chinese
		: (Array.isArray(safeBlock.tokens) ? safeBlock.tokens.map(token => token && typeof token.hanzi === 'string' ? token.hanzi : '').join('') : '');
	const tokens = normalizeTokens(safeBlock.tokens, chinese);
	const refspeaker = type === 'text' ? null : (typeof safeBlock.speaker === 'string' && /^[ABCD]$/.test(safeBlock.speaker.trim()) ? safeBlock.speaker.trim() : null);

	return {
		ref: typeof safeBlock.ref === 'string' && safeBlock.ref.trim() ? safeBlock.ref.trim() : `[${index + 1}]`,
		speaker: type === 'text' ? null : refspeaker || ['A', 'B', 'C', 'D'][index % 4],
		chinese,
		tokens,
		translation: typeof safeBlock.translation === 'string' ? safeBlock.translation : '',
		explanation: typeof safeBlock.explanation === 'string' ? safeBlock.explanation : ''
	};
}

function deriveTitle(type, topic) {
	const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
	if (cleanTopic) {
		return type === 'dialogue' ? `Dialogue on ${cleanTopic}` : `Text on ${cleanTopic}`;
	}

	return type === 'dialogue' ? 'Dialogue Practice' : 'Reading Practice';
}

function normalizeGeneratedContent(content, options = {}) {
	const safeContent = content && typeof content === 'object' ? content : {};
	const type = safeContent.type === 'dialogue' ? 'dialogue' : 'text';
	const blocks = Array.isArray(safeContent.blocks) ? safeContent.blocks : [];
	const normalizedBlocks = blocks.map((block, index) => normalizeBlock(block, index, type));
	const targetLength = typeof safeContent.targetLength === 'number'
		? safeContent.targetLength
		: Number(options.targetLength) || 0;
	const topic = typeof safeContent.topic === 'string' ? safeContent.topic : (typeof options.topic === 'string' ? options.topic : '');

	return {
		id: typeof safeContent.id === 'string' && safeContent.id.trim() ? safeContent.id.trim() : makeId(),
		createdAt: typeof safeContent.createdAt === 'number' ? safeContent.createdAt : Date.now(),
		type,
		title: typeof safeContent.title === 'string' && safeContent.title.trim() ? safeContent.title.trim() : deriveTitle(type, topic),
		topic,
		targetLength,
		blocks: normalizedBlocks,
		usedWords: Array.isArray(safeContent.usedWords)
			? safeContent.usedWords.map(normalizeUsedWord).filter(Boolean)
			: [],
		newWords: Array.isArray(safeContent.newWords)
			? safeContent.newWords.map(normalizeUsedWord).filter(Boolean)
			: []
	};
}

function buildWordListPrompt(words) {
	return JSON.stringify(sanitizeWords(words), null, 2);
}

export async function enrichWordWithAI(hanzi) {
	const prompt = `You are a Chinese dictionary assistant.
The user provides one Chinese word or character.

Return ONLY valid JSON:
{
  "hanzi": "...",
  "pinyin": "...",
  "translation": "...",
  "notes": "..."
}

Rules:
- pinyin must use tone marks
- translation must be in English
- hanzi must be simplified Chinese if possible
- no markdown
- no text outside JSON

User input:
${String(hanzi ?? '').trim()}`;

	const result = await callGeminiJSON(prompt);
	if (!result || typeof result !== 'object' || Array.isArray(result)) {
		throw new Error('Gemini returned invalid word data.');
	}

	return {
		hanzi: typeof result.hanzi === 'string' ? result.hanzi : String(hanzi ?? ''),
		pinyin: typeof result.pinyin === 'string' ? result.pinyin : '',
		translation: typeof result.translation === 'string' ? result.translation : '',
		notes: typeof result.notes === 'string' ? result.notes : ''
	};
}

export async function generateContentWithAI(options = {}) {
	const type = options?.type === 'dialogue' ? 'dialogue' : 'text';
	const topic = typeof options?.topic === 'string' ? options.topic : '';
	const targetLength = Number(options?.targetLength) || 100;
	const words = sanitizeWords(options?.words);

	const prompt = `You are a Chinese language learning content generator.

Generate Chinese learning content.

Requirements:
- type: text or dialogue
- if type is dialogue, use randomly 2, 3, or 4 speakers named A, B, C, D
- topic: use the provided topic if not empty; otherwise choose a natural everyday topic
- targetLength: about the requested number of Chinese characters
- use at least 95% vocabulary from the user's word list
- introduce at most 5% new words only when necessary
- simplified Chinese characters
- pinyin with tone marks
- English translation
- clear explanation in English
- split content into blocks of about 100 Chinese characters, or one dialogue turn per block
- each block must have a reference like [1], [2], [3]
- tokens must be meaningful Chinese words or short groups

Return ONLY valid JSON in this exact structure:
{
  "id": "",
  "createdAt": 0,
  "type": "text",
  "title": "",
  "topic": "",
  "targetLength": 100,
  "blocks": [
    {
      "ref": "[1]",
      "speaker": null,
      "chinese": "",
      "tokens": [
        {
          "hanzi": "",
          "pinyin": ""
        }
      ],
      "translation": "",
      "explanation": ""
    }
  ],
  "usedWords": [
    {
      "hanzi": "",
      "pinyin": "",
      "translation": ""
    }
  ],
  "newWords": [
    {
      "hanzi": "",
      "pinyin": "",
      "translation": ""
    }
  ]
}

Rules:
- For text, speaker must be null.
- For dialogue, speaker must be A, B, C, or D.
- Return JSON only.
- No markdown.
- No explanation outside JSON.

User data:
${buildWordListPrompt(words)}

Requested settings:
${JSON.stringify({ type, topic, targetLength }, null, 2)}`;

	const result = await callGeminiJSON(prompt);
	const normalized = normalizeGeneratedContent(result, { type, topic, targetLength });

	if (!normalized.blocks.length) {
		throw new Error('Gemini returned content without blocks.');
	}

	return normalized;
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
- Explanation must be in English
- Explain characters, words, grammar and natural meaning
- Keep the same refs
- No markdown
- No text outside JSON

Content:
${JSON.stringify(content ?? {}, null, 2)}`;

	const result = await callGeminiJSON(prompt);
	const blocks = Array.isArray(result?.blocks) ? result.blocks : [];
	const inputBlocks = Array.isArray(content?.blocks) ? content.blocks : [];
	const refs = inputBlocks.map((block, index) => (block && typeof block.ref === 'string' && block.ref.trim()) ? block.ref.trim() : `[${index + 1}]`);

	return {
		blocks: blocks.map((block, index) => {
			const ref = typeof block?.ref === 'string' && block.ref.trim()
				? block.ref.trim()
				: refs[index] || `[${index + 1}]`;

			return {
				ref,
				explanation: typeof block?.explanation === 'string' ? block.explanation : ''
			};
		})
	};
}
