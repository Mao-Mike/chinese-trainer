// study-dictionary.js
// Dictionary helpers for study module
import { getAllWords, getAllTemporaryWords } from './storage.js';

export async function loadCombinedDictionary() {
	const [base, temp] = await Promise.all([
		getAllWords(),
		getAllTemporaryWords()
	]);
	const hanziSet = new Set();
	const combined = [];
	for (const w of base) {
		if (w && w.hanzi && !hanziSet.has(w.hanzi)) {
			hanziSet.add(w.hanzi);
			combined.push({ hanzi: w.hanzi, pinyin: w.pinyin });
		}
	}
	for (const w of temp) {
		if (w && w.hanzi && !hanziSet.has(w.hanzi)) {
			hanziSet.add(w.hanzi);
			combined.push({ hanzi: w.hanzi, pinyin: w.pinyin });
		}
	}
	return combined;
}

export function tokenizeChineseWithDictionary(chinese, dictionaryWords) {
	const text = typeof chinese === 'string' ? chinese : '';
	if (!text) return [];
	const words = Array.isArray(dictionaryWords)
		? dictionaryWords
			.filter(word => word && typeof word.hanzi === 'string' && word.hanzi.trim())
			.map(word => ({
				hanzi: word.hanzi.trim(),
				pinyin: typeof word.pinyin === 'string' ? word.pinyin.trim() : ''
			}))
			.sort((a, b) => b.hanzi.length - a.hanzi.length)
		: [];
	const tokens = [];
	let index = 0;
	while (index < text.length) {
		let matchedWord = null;
		for (const word of words) {
			if (text.startsWith(word.hanzi, index)) {
				matchedWord = word;
				break;
			}
		}
		if (matchedWord) {
			tokens.push({ hanzi: matchedWord.hanzi, pinyin: matchedWord.pinyin });
			index += matchedWord.hanzi.length;
			continue;
		}
		tokens.push({ hanzi: text[index], pinyin: '' });
		index += 1;
	}
	return tokens;
}
