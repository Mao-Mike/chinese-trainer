// js/utils.js

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

export function isHanzi(char) {
	return /[\u3400-\u9FFF]/.test(String(char || ''));
}

export function escapeHTML(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// ===================== LOCAL STORAGE HELPERS =====================

export function getStoredValue(key, fallback = '') {
	try {
		const value = localStorage.getItem(key);
		return typeof value === 'string' && value.trim()
			? value.trim()
			: fallback;
	} catch {
		return fallback;
	}
}

export function setStoredValue(key, value) {
	try {
		localStorage.setItem(key, String(value ?? ''));
		return true;
	} catch {
		return false;
	}
}

export function removeStoredValue(key) {
	try {
		localStorage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}

// ===================== AI HELPERS =====================

export function hasGeminiApiKey() {
	try {
		const value = localStorage.getItem('geminiApiKey');
		return typeof value === 'string' && value.trim().length > 0;
	} catch {
		return false;
	}
}

export function isQuotaError(error) {
	const message = String(error?.message || error || '');
	return /quota|rate|limit|429/i.test(message);
}

export function getFriendlyAIErrorMessage(error) {
	const message = String(error?.message || error || '');

	if (isQuotaError(error)) {
		return 'Limite gratuito AI raggiunto. Riprova più tardi.';
	}

	if (/api key|apikey|key missing|missing/i.test(message)) {
		return 'Inserisci la Gemini API key in Impostazioni.';
	}

	if (/abort/i.test(message)) {
		return 'Operazione annullata.';
	}

	return 'Errore durante la chiamata AI. Controlla API key o connessione.';
}

// ===================== GENERATED CONTENT HELPERS =====================

function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeToken(token, fallbackHanzi = '') {
	if (typeof token === 'string') {
		const hanzi = token.trim();

		return {
			hanzi: hanzi || fallbackHanzi,
			pinyin: '',
			isNew: false
		};
	}

	if (token && typeof token === 'object') {
		return {
			hanzi: typeof token.hanzi === 'string' ? token.hanzi : fallbackHanzi,
			pinyin: typeof token.pinyin === 'string' ? token.pinyin : '',
			isNew: !!token.isNew
		};
	}

	return {
		hanzi: fallbackHanzi,
		pinyin: '',
		isNew: false
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

	if (!blocks.length || !blocks.every(block => block && typeof block.chinese === 'string')) {
		return null;
	}

	const normalizedBlocks = blocks.map((block, index) => {
		const ref = typeof block.ref === 'string' && block.ref.trim()
			? block.ref.trim()
			: `[${index + 1}]`;

		const speaker = type === 'text'
			? null
			: typeof block.speaker === 'string' && block.speaker.trim()
				? block.speaker.trim()
				: ['A', 'B', 'C', 'D'][index % 4];

		const fallbackTokens = Array.from(block.chinese || '').map(char => normalizeToken(null, char));

		return {
			ref,
			speaker,
			chinese: block.chinese,
			tokens: Array.isArray(block.tokens) && block.tokens.length
				? block.tokens.map(token => normalizeToken(token))
				: fallbackTokens,
			translation: typeof block.translation === 'string' ? block.translation : '',
			explanation: typeof block.explanation === 'string' ? block.explanation : ''
		};
	});

	return {
		id: typeof content.id === 'string' && content.id.trim()
			? content.id.trim()
			: makeId(),
		createdAt: Number.isFinite(Number(content.createdAt))
			? Number(content.createdAt)
			: Date.now(),
		type,
		title: typeof content.title === 'string' ? content.title : '',
		topic: typeof content.topic === 'string' ? content.topic : '',
		targetLength: Number.isFinite(Number(content.targetLength))
			? Number(content.targetLength)
			: 0,
		blocks: normalizedBlocks,
		usedWords: Array.isArray(content.usedWords) ? content.usedWords.slice() : [],
		newWords: Array.isArray(content.newWords) ? content.newWords.slice() : [],
		pinyinGenerated: !!content.pinyinGenerated,
		translationGenerated: !!content.translationGenerated,
		explanationGenerated: !!content.explanationGenerated
	};
}