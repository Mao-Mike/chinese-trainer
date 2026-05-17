import { getCachedPinyin, setCachedPinyin, incrementAIUsage } from './storage.js';
import { dedupeAIRequest } from './ai-dedupe.js';
import { callGeminiJSON } from './ai-gemini.js';
import { PROMPT_PINYIN, PROMPT_GENERATE } from './ai-prompts.js';
import { makeId } from './ai-utils.js';
import { normalizeGeneratedContent } from './utils.js';

// --- Vocabolario ---

function normalizeVocabularyWord(word, index) {
	if (!word) return null;

	if (typeof word === 'string') {
		const hanzi = word.trim();
		return hanzi ? { hanzi, createdAt: 0, index } : null;
	}

	if (typeof word !== 'object') return null;

	const hanzi = typeof word.hanzi === 'string' ? word.hanzi.trim() : '';
	if (!hanzi) return null;

	const createdAt = Number.isFinite(Number(word.createdAt))
		? Number(word.createdAt)
		: 0;

	return { hanzi, createdAt, index };
}

export function selectHanziVocabulary(words, maxWords = 120) {
	if (!Array.isArray(words) || maxWords <= 0) return [];

	const normalized = words
		.map((word, index) => normalizeVocabularyWord(word, index))
		.filter(Boolean);

	const hasCreatedAt = normalized.some(item => item.createdAt > 0);

	const ordered = hasCreatedAt
		? normalized
			.slice()
			.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.index - b.index)
		: normalized;

	const seen = new Set();
	const vocabulary = [];

	for (const item of ordered) {
		if (seen.has(item.hanzi)) continue;

		seen.add(item.hanzi);
		vocabulary.push(item.hanzi);

		if (vocabulary.length >= maxWords) break;
	}

	return vocabulary;
}

// --- Pulizia parole nuove ---

function containsHanzi(value) {
	return /[\u3400-\u9FFF]/.test(String(value || ''));
}

function isOnlyPunctuation(value) {
	const text = String(value || '').trim();

	if (!text) return true;

	return !containsHanzi(text);
}

function normalizeNewWords(newWords, hanziVocabulary) {
	if (!Array.isArray(newWords)) return [];

	const knownSet = new Set(
		Array.isArray(hanziVocabulary)
			? hanziVocabulary
				.filter(word => typeof word === 'string' && word.trim())
				.map(word => word.trim())
			: []
	);

	const byHanzi = new Map();

	for (const item of newWords) {
		if (!item || typeof item !== 'object') continue;

		const hanzi = typeof item.hanzi === 'string' ? item.hanzi.trim() : '';
		const pinyin = typeof item.pinyin === 'string' ? item.pinyin.trim() : '';

		if (!hanzi || !pinyin) continue;
		if (isOnlyPunctuation(hanzi)) continue;
		if (knownSet.has(hanzi)) continue;

		if (!byHanzi.has(hanzi)) {
			byHanzi.set(hanzi, { hanzi, pinyin });
		}
	}

	const sorted = Array.from(byHanzi.values())
		.sort((a, b) => b.hanzi.length - a.hanzi.length);

	const multiHanziWords = sorted
		.filter(word => word.hanzi.length > 1)
		.map(word => word.hanzi);

	const filtered = [];

	for (const word of sorted) {
		const isSingleHanzi = word.hanzi.length === 1;

		if (isSingleHanzi) {
			const isPartOfLongerNewWord = multiHanziWords.some(longWord =>
				longWord.includes(word.hanzi)
			);

			if (isPartOfLongerNewWord) {
				continue;
			}
		}

		filtered.push(word);
	}

	return filtered;
}

// --- Funzioni principali ---

export async function enrichWordWithAI(hanzi) {
	if (!hanzi || typeof hanzi !== 'string' || !hanzi.trim()) {
		return { hanzi: '', pinyin: '' };
	}

	const cleanHanzi = hanzi.trim();

	const cached = getCachedPinyin(cleanHanzi);
	if (cached && cached.pinyin) {
		return {
			hanzi: cached.hanzi,
			pinyin: cached.pinyin,
			notes: 'from cache'
		};
	}

	const key = `pinyin:${cleanHanzi}`;

	return dedupeAIRequest(key, async () => {
		incrementAIUsage('pinyin');

		const prompt = PROMPT_PINYIN + cleanHanzi;
		const result = await callGeminiJSON(prompt, {
			temperature: 0.2,
			maxOutputTokens: 1024
		});

		if (!result || typeof result !== 'object' || Array.isArray(result)) {
			throw new Error('Gemini returned invalid word data.');
		}

		if (result.pinyin) {
			setCachedPinyin(cleanHanzi, result.pinyin);
		}

		return {
			hanzi: typeof result.hanzi === 'string' ? result.hanzi : cleanHanzi,
			pinyin: typeof result.pinyin === 'string' ? result.pinyin : '',
			notes: typeof result.notes === 'string' ? result.notes : ''
		};
	});
}

export async function generateContentWithAI(options = {}) {
	const type = options?.type === 'dialogue' ? 'dialogue' : 'text';
	const topic = typeof options?.topic === 'string' ? options.topic.trim() : '';
	const targetLength = Number(options?.targetLength) || 100;
	const hanziVocabulary = selectHanziVocabulary(options?.words, 120);

	const key = `generate:${type}:${targetLength}:${topic}:${JSON.stringify(hanziVocabulary)}`;

	return dedupeAIRequest(key, async () => {
		incrementAIUsage('generation');

		const prompt =
			PROMPT_GENERATE +
			JSON.stringify({ type, topic, targetLength }, null, 2) +
			'\n\nUser vocabulary hanzi only:\n' +
			JSON.stringify(hanziVocabulary, null, 2);

		const result = await callGeminiJSON(prompt, {
			temperature: 0.2,
			maxOutputTokens: 8192,
			signal: options.signal
		});

		const normalized = normalizeGeneratedContent(result);

		if (!normalized || !Array.isArray(normalized.blocks) || !normalized.blocks.length) {
			throw new Error('Gemini returned content without blocks.');
		}

		normalized.pinyinGenerated = true;
		normalized.translationGenerated = true;
		normalized.explanationGenerated = true;

		if (!normalized.id) {
			normalized.id = makeId();
		}

		if (!normalized.createdAt) {
			normalized.createdAt = Date.now();
		}

		normalized.blocks = normalized.blocks.map((block, index) => {
			const tokens = Array.isArray(block.tokens) && block.tokens.length
				? block.tokens.map(token => ({
					hanzi: typeof token.hanzi === 'string' ? token.hanzi : '',
					pinyin: typeof token.pinyin === 'string' ? token.pinyin : '',
					isNew: !!token.isNew
				}))
				: Array.from(block.chinese || '').map(char => ({
					hanzi: char,
					pinyin: '',
					isNew: false
				}));

			return {
				ref: typeof block.ref === 'string' && block.ref.trim()
					? block.ref.trim()
					: `[${index + 1}]`,
				speaker: type === 'dialogue'
					? block.speaker || ['A', 'B', 'C', 'D'][index % 4]
					: null,
				chinese: typeof block.chinese === 'string' ? block.chinese : '',
				tokens,
				translation: typeof block.translation === 'string' ? block.translation : '',
				explanation: typeof block.explanation === 'string' ? block.explanation : ''
			};
		});

		normalized.newWords = normalizeNewWords(normalized.newWords, hanziVocabulary);

		return normalized;
	});
}