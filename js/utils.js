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

function normalizeBlock(block, index, type) {
	const chinese = block && typeof block.chinese === 'string' ? block.chinese : '';
	const rawTokens = Array.isArray(block && block.tokens) && block.tokens.length
		? block.tokens
		: Array.from(chinese);

	return {
		ref: typeof (block && block.ref) === 'string' ? block.ref : `[${index + 1}]`,
		speaker: type === 'text'
			? null
			: (block && typeof block.speaker === 'string' && block.speaker.trim() ? block.speaker : null),
		chinese,
		tokens: rawTokens.map((token, tokenIndex) => normalizeToken(token, chinese[tokenIndex] || '')),
		translation: block && typeof block.translation === 'string' ? block.translation : '',
		explanation: block && typeof block.explanation === 'string' ? block.explanation : ''
	};
}

export function isValidGeneratedContent(content) {
	return !!content
		&& (content.type === 'text' || content.type === 'dialogue')
		&& typeof content.title === 'string'
		&& Array.isArray(content.blocks)
		&& content.blocks.length > 0
		&& content.blocks.every(block => !!block
			&& typeof block.ref === 'string'
			&& typeof block.chinese === 'string'
			&& Array.isArray(block.tokens)
			&& typeof block.translation === 'string'
			&& typeof block.explanation === 'string'
			&& block.tokens.every(token => !!token
				&& typeof token.hanzi === 'string'
				&& typeof token.pinyin === 'string'));
}

export function normalizeGeneratedContent(content) {
	if (!content || typeof content !== 'object') {
		return null;
	}

	const type = content.type === 'dialogue' ? 'dialogue' : 'text';
	const blocks = Array.isArray(content.blocks) ? content.blocks : [];

	return {
		id: typeof content.id === 'string' ? content.id : makeId(),
		createdAt: typeof content.createdAt === 'number' ? content.createdAt : Date.now(),
		type,
		title: typeof content.title === 'string' ? content.title : '',
		topic: typeof content.topic === 'string' ? content.topic : '',
		targetLength: typeof content.targetLength === 'number' ? content.targetLength : 0,
		blocks: blocks.map((block, index) => normalizeBlock(block, index, type)),
		usedWords: Array.isArray(content.usedWords) ? content.usedWords : [],
		newWords: Array.isArray(content.newWords) ? content.newWords : []
	};
}
