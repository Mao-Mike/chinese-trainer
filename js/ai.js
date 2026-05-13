import { fakePinyin, fakeTranslation, pick, randomInt, shuffle } from './utils.js';

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeWords(words) {
	return Array.isArray(words)
		? words
			.filter(word => word && word.hanzi)
			.map(word => ({
				hanzi: word.hanzi,
				pinyin: word.pinyin || fakePinyin(word.hanzi),
				translation: word.translation || fakeTranslation(word.hanzi)
			}))
		: [];
}

function createToken(chinese) {
	return {
		hanzi: chinese,
		pinyin: fakePinyin(chinese)
	};
}

function splitTextIntoBlocks(text, blockSize = 100) {
	const chunks = [];
	let i = 0;

	while (i < text.length) {
		chunks.push(text.slice(i, i + blockSize));
		i += blockSize;
	}

	return chunks;
}

function randomTitle(type, topic) {
	if (topic && topic.trim()) {
		return type === 'dialogue' ? `Dialogo su "${topic.trim()}"` : `Testo su "${topic.trim()}"`;
	}

	const textTitles = [
		'Una giornata a scuola',
		'Il mio animale preferito',
		'Viaggio in città',
		'Cosa mangio a colazione',
		'Un sogno divertente',
		'La mia famiglia',
		'Un giorno di pioggia',
		'Al mercato',
		'La mia routine',
		'Un ricordo speciale'
	];

	const dialogueTitles = [
		'Conversazione al ristorante',
		'Due amici si incontrano',
		'Comprare un biglietto',
		'Dialogo in classe',
		'Chiedere indicazioni',
		'Al telefono',
		'In biblioteca',
		'Al parco',
		'In viaggio',
		'Alla stazione'
	];

	return type === 'dialogue' ? pick(dialogueTitles) : pick(textTitles);
}

function buildMockText(type, targetLength, words) {
	const pool = words.length ? shuffle(words) : [
		{ hanzi: '我', pinyin: 'wǒ', translation: 'io' },
		{ hanzi: '喜欢', pinyin: 'xǐ huān', translation: 'piace' },
		{ hanzi: '学习', pinyin: 'xué xí', translation: 'studiare' },
		{ hanzi: '中文', pinyin: 'zhōng wén', translation: 'cinese' },
		{ hanzi: '朋友', pinyin: 'péng you', translation: 'amico' },
		{ hanzi: '吃饭', pinyin: 'chī fàn', translation: 'mangiare' },
		{ hanzi: '学校', pinyin: 'xué xiào', translation: 'scuola' },
		{ hanzi: '老师', pinyin: 'lǎo shī', translation: 'insegnante' }
	];

	if (type === 'dialogue') {
		const nSpeakers = randomInt(2, 4);
		const names = ['A', 'B', 'C', 'D'].slice(0, nSpeakers);
		const blocks = [];
		let total = 0;

		while (total < targetLength) {
			const speaker = pick(names);
			let chinese = '';
			const tokenCount = randomInt(2, 7);

			for (let i = 0; i < tokenCount; i++) {
				chinese += pick(pool).hanzi;
			}

			blocks.push({
				ref: `[${blocks.length + 1}]`,
				speaker,
				chinese,
				tokens: Array.from(chinese).map(char => createToken(char)),
				translation: fakeTranslation(chinese),
				explanation: `Spiegazione di: ${chinese}`
			});

			total += chinese.length;
		}

		return blocks;
	}

	const text = [];
	while (text.join('').length < targetLength) {
		text.push(pick(pool).hanzi);
		if (Math.random() > 0.7) text.push('，');
	}

	const combined = text.join('').slice(0, targetLength) + '。';
	return splitTextIntoBlocks(combined).map((chinese, index) => ({
		ref: `[${index + 1}]`,
		speaker: null,
		chinese,
		tokens: Array.from(chinese).map(char => createToken(char)),
		translation: fakeTranslation(chinese),
		explanation: `Spiegazione di: ${chinese}`
	}));
}

export async function enrichWordWithAI(hanzi) {
	try {
		await sleep(500);
		// In futuro qui verrà inserita la chiamata al provider AI reale.
		return {
			hanzi,
			pinyin: fakePinyin(hanzi),
			translation: fakeTranslation(hanzi),
			notes: 'Mock locale pronto per la futura integrazione AI.'
		};
	} catch (error) {
		throw new Error(`Unable to enrich word: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export async function generateContentWithAI(options) {
	try {
		await sleep(500);
		// In futuro qui verrà inserita la chiamata al provider AI reale.

		const type = options?.type === 'dialogue' ? 'dialogue' : 'text';
		const topic = options?.topic || '';
		const targetLength = Number(options?.targetLength) || 100;
		const words = normalizeWords(options?.words);
		const selectedWords = words.length ? shuffle(words).slice(0, Math.max(1, Math.round(words.length * 0.95))) : [];
		const title = randomTitle(type, topic);
		const blocks = buildMockText(type, targetLength, selectedWords);

		return {
			id: makeId(),
			createdAt: Date.now(),
			type,
			title,
			topic,
			targetLength,
			blocks,
			usedWords: selectedWords,
			newWords: []
		};
	} catch (error) {
		throw new Error(`Unable to generate content: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export async function explainContentWithAI(content) {
	try {
		await sleep(500);
		// In futuro qui verrà inserita la chiamata al provider AI reale.

		const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
		return {
			blocks: blocks.map(block => ({
				ref: block.ref,
				explanation: block.explanation || `Spiegazione di: ${block.chinese || ''}`
			}))
		};
	} catch (error) {
		throw new Error(`Unable to explain content: ${error instanceof Error ? error.message : String(error)}`);
	}
}
