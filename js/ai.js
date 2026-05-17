
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
	const createdAt = Number.isFinite(Number(word.createdAt)) ? Number(word.createdAt) : 0;
	return { hanzi, createdAt, index };
}

export function selectHanziVocabulary(words, maxWords = 120) {
	if (!Array.isArray(words) || maxWords <= 0) return [];
	const normalized = words.map((word, index) => normalizeVocabularyWord(word, index)).filter(Boolean);
	const hasCreatedAt = normalized.some(item => item.createdAt > 0);
	const ordered = hasCreatedAt
		? normalized.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.index - b.index)
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

// --- Funzioni principali ---
export async function enrichWordWithAI(hanzi) {
	if (!hanzi || typeof hanzi !== 'string' || !hanzi.trim()) return { hanzi: '', pinyin: '' };
	const cached = getCachedPinyin(hanzi);
	if (cached && cached.pinyin) {
		return { hanzi: cached.hanzi, pinyin: cached.pinyin, notes: 'from cache' };
	}
	const key = `pinyin:${hanzi}`;
	return dedupeAIRequest(key, async () => {
		incrementAIUsage('pinyin');
		const prompt = PROMPT_PINYIN + String(hanzi ?? '').trim();
		const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 1024 });
		if (!result || typeof result !== 'object' || Array.isArray(result)) {
			throw new Error('Gemini returned invalid word data.');
		}
		if (result.pinyin) setCachedPinyin(hanzi, result.pinyin);
		return {
			hanzi: typeof result.hanzi === 'string' ? result.hanzi : String(hanzi ?? ''),
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
		   const prompt = PROMPT_GENERATE + JSON.stringify({ type, topic, targetLength }, null, 2) + "\n\nUser vocabulary hanzi only:\n" + JSON.stringify(hanziVocabulary, null, 2);
		   const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 8192, signal: options.signal });
		   const normalized = normalizeGeneratedContent(result);
		if (!normalized || !Array.isArray(normalized.blocks) || !normalized.blocks.length) {
			throw new Error('Gemini returned content without blocks.');
		}
		// Flags: tutto già generato
		normalized.pinyinGenerated = true;
		normalized.translationGenerated = true;
		normalized.explanationGenerated = true;
		if (!normalized.id) normalized.id = makeId();
		if (!normalized.createdAt) normalized.createdAt = Date.now();
		normalized.blocks = normalized.blocks.map((block, idx) => {
			const tokens = Array.isArray(block.tokens) && block.tokens.length
				? block.tokens.map(t => ({
					hanzi: typeof t.hanzi === 'string' ? t.hanzi : '',
					pinyin: typeof t.pinyin === 'string' ? t.pinyin : '',
					isNew: !!t.isNew
				}))
				: Array.from(block.chinese || '').map(char => ({ hanzi: char, pinyin: '', isNew: false }));
			return {
				ref: typeof block.ref === 'string' && block.ref.trim() ? block.ref.trim() : `[${idx + 1}]`,
				speaker: type === 'dialogue' ? (block.speaker || ['A', 'B', 'C', 'D'][idx % 4]) : null,
				chinese: typeof block.chinese === 'string' ? block.chinese : '',
				tokens,
				translation: typeof block.translation === 'string' ? block.translation : '',
				explanation: typeof block.explanation === 'string' ? block.explanation : ''
			};
		});
		normalized.newWords = Array.isArray(normalized.newWords)
			? normalized.newWords.filter(w => w && typeof w.hanzi === 'string' && w.hanzi && typeof w.pinyin === 'string')
			: [];
		return normalized;
	});
}

