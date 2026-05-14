export function randomInt(a, b) {
	return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function shuffle(arr) {
	const copy = arr.slice();
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function pick(arr) {
	return arr[randomInt(0, arr.length - 1)];
}

export function fakePinyin(word) {
	return word.split('').map(() => 'pīn').join(' ');
}

export function fakeTranslation(word) {
	return 'Traduzione di ' + word;
}

export function isHanzi(char) {
	return /[\u3400-\u9FFF]/.test(char);
}

export function escapeHTML(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function createDemoTokens(chinese) {
	return Array.from(chinese).map(char => ({
		hanzi: char,
		pinyin: isHanzi(char) ? fakePinyin(char) : ''
	}));
}

function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeToken(token, fallbackHanzi = '') {
	if (token && typeof token === 'object') {
		return {
			hanzi: typeof token.hanzi === 'string' ? token.hanzi : fallbackHanzi,
			pinyin: typeof token.pinyin === 'string' ? token.pinyin : ''
		};
	}

	return {
		hanzi: fallbackHanzi,
		pinyin: ''
	};
}

export function isValidGeneratedContent(content) {
	return !!content
		&& (content.type === 'text' || content.type === 'dialogue')
		&& typeof content.title === 'string'
		&& Array.isArray(content.blocks)
		&& content.blocks.length > 0
		&& content.blocks.every(block => !!block && typeof block.chinese === 'string');
}

export function normalizeGeneratedContent(content) {
	if (!content || typeof content !== 'object') {
		return null;
	}

	const type = content.type === 'dialogue' ? 'dialogue' : 'text';
	const blocks = Array.isArray(content.blocks) ? content.blocks : [];
	if (typeof content.title !== 'string' || !blocks.length || !blocks.every(block => block && typeof block.chinese === 'string')) {
		return null;
	}

	const normalizedBlocks = blocks.map((block, index) => {
		const ref = typeof block.ref === 'string' && block.ref.trim() ? block.ref.trim() : `[${index + 1}]`;
		const speaker = type === 'text'
			? null
			: (typeof block.speaker === 'string' && /^[ABCD]$/.test(block.speaker.trim())
				? block.speaker.trim()
				: ['A', 'B', 'C', 'D'][index % 4]);

		return {
			ref,
			speaker,
			chinese: block.chinese,
			tokens: Array.isArray(block.tokens) ? block.tokens.slice() : [],
			translation: typeof block.translation === 'string' ? block.translation : '',
			explanation: typeof block.explanation === 'string' ? block.explanation : ''
		};
	});

	return {
		id: typeof content.id === 'string' ? content.id : makeId(),
		createdAt: typeof content.createdAt === 'number' ? content.createdAt : Date.now(),
		type,
		title: typeof content.title === 'string' ? content.title : '',
		topic: typeof content.topic === 'string' ? content.topic : '',
		targetLength: typeof content.targetLength === 'number' ? content.targetLength : 0,
		blocks: normalizedBlocks,
		usedWords: Array.isArray(content.usedWords) ? content.usedWords.slice() : [],
		newWords: Array.isArray(content.newWords) ? content.newWords.slice() : [],
		pinyinGenerated: !!content.pinyinGenerated,
		translationGenerated: !!content.translationGenerated,
		explanationGenerated: !!content.explanationGenerated
	};
}

