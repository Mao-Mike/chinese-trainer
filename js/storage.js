// js/storage.js

// ===================== DATABASE =====================

const DB_NAME = 'chinese_trainer_db';
const DB_STORE = 'words';
const TEMP_STORE = 'temporaryWords';
const HISTORY_STORE = 'generatedTexts';
const DB_VERSION = 4;

let dbPromise = null;

export function openDB() {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = event => {
			const db = event.target.result;

			if (!db.objectStoreNames.contains(DB_STORE)) {
				db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
			}

			if (!db.objectStoreNames.contains(TEMP_STORE)) {
				db.createObjectStore(TEMP_STORE, { keyPath: 'id', autoIncrement: true });
			}

			if (!db.objectStoreNames.contains(HISTORY_STORE)) {
				db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
			}
		};

		req.onsuccess = event => {
			resolve(event.target.result);
		};

		req.onerror = event => {
			dbPromise = null;
			reject(event.target.error || event);
		};
	});

	return dbPromise;
}

async function withStore(mode, callback, storeName = DB_STORE) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);

		let request;
		try {
			request = callback(store);
		} catch (error) {
			reject(error);
			return;
		}

		request.onsuccess = () => resolve(request.result);
		request.onerror = event => reject(event.target.error || event);
	});
}

// ===================== PINYIN CACHE =====================

const PINYIN_CACHE_KEY = 'pinyinCache';

export function getCachedPinyin(hanzi) {
	if (!hanzi || typeof hanzi !== 'string' || !hanzi.trim()) return null;

	try {
		const cache = JSON.parse(localStorage.getItem(PINYIN_CACHE_KEY) || '{}');
		const key = hanzi.trim();
		const entry = cache[key];

		if (!entry || !entry.pinyin) return null;

		return {
			hanzi: entry.hanzi || key,
			pinyin: entry.pinyin,
			createdAt: entry.createdAt || 0
		};
	} catch {
		return null;
	}
}

export function setCachedPinyin(hanzi, pinyin) {
	if (!hanzi || typeof hanzi !== 'string' || !hanzi.trim()) return;
	if (!pinyin || typeof pinyin !== 'string' || !pinyin.trim()) return;

	try {
		const cache = JSON.parse(localStorage.getItem(PINYIN_CACHE_KEY) || '{}');
		const key = hanzi.trim();

		cache[key] = {
			hanzi: key,
			pinyin: pinyin.trim(),
			createdAt: Date.now()
		};

		localStorage.setItem(PINYIN_CACHE_KEY, JSON.stringify(cache));
	} catch {
		// Ignore localStorage errors.
	}
}

export function getAllCachedPinyin() {
	try {
		const cache = JSON.parse(localStorage.getItem(PINYIN_CACHE_KEY) || '{}');
		return Object.values(cache);
	} catch {
		return [];
	}
}

// ===================== AI USAGE COUNTER =====================

const AI_USAGE_KEY = 'aiUsage';

function getTodayString() {
	return new Date().toISOString().slice(0, 10);
}

export function getAIUsageToday() {
	const today = getTodayString();

	try {
		const usage = JSON.parse(localStorage.getItem(AI_USAGE_KEY) || '{}');

		if (usage.date !== today) {
			return {
				date: today,
				total: 0,
				generation: 0,
				pinyin: 0
			};
		}

		return {
			date: usage.date,
			total: Number(usage.total) || 0,
			generation: Number(usage.generation) || 0,
			pinyin: Number(usage.pinyin) || 0
		};
	} catch {
		return {
			date: today,
			total: 0,
			generation: 0,
			pinyin: 0
		};
	}
}

export function incrementAIUsage(kind) {
	const today = getTodayString();
	let usage;

	try {
		usage = JSON.parse(localStorage.getItem(AI_USAGE_KEY) || '{}');
	} catch {
		usage = {};
	}

	if (usage.date !== today) {
		usage = {
			date: today,
			total: 0,
			generation: 0,
			pinyin: 0
		};
	}

	usage.total = (Number(usage.total) || 0) + 1;

	if (kind === 'generation') {
		usage.generation = (Number(usage.generation) || 0) + 1;
	}

	if (kind === 'pinyin') {
		usage.pinyin = (Number(usage.pinyin) || 0) + 1;
	}

	localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
}

export function resetAIUsage() {
	const usage = {
		date: getTodayString(),
		total: 0,
		generation: 0,
		pinyin: 0
	};

	localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
}

// ===================== MAIN DICTIONARY =====================

export function getAllWords() {
	return withStore('readonly', store => store.getAll(), DB_STORE);
}

export async function findWordByHanzi(hanzi) {
	if (!hanzi) return null;

	const words = await getAllWords();
	return words.find(word => word.hanzi === hanzi) || null;
}

function insertWordRecord(record) {
	return withStore('readwrite', store => store.add(record), DB_STORE);
}

export async function addWord(hanzi, pinyin = '') {
	const cleanHanzi = typeof hanzi === 'string' ? hanzi.trim() : '';
	const cleanPinyin = typeof pinyin === 'string' ? pinyin.trim() : '';

	if (!cleanHanzi) return;

	const exists = await findWordByHanzi(cleanHanzi);
	if (exists) {
		throw new Error('Duplicato');
	}

	return insertWordRecord({
		hanzi: cleanHanzi,
		pinyin: cleanPinyin,
		createdAt: Date.now()
	});
}

export function deleteWordById(id) {
	return withStore('readwrite', store => store.delete(id), DB_STORE);
}

export async function importWords(words) {
	if (!Array.isArray(words)) return;

	const existing = await getAllWords();
	const hanziSet = new Set(existing.map(word => word.hanzi));

	for (const word of words) {
		const hanzi = typeof word?.hanzi === 'string'
			? word.hanzi.trim()
			: typeof word?.word === 'string'
				? word.word.trim()
				: '';

		if (!hanzi || hanziSet.has(hanzi)) continue;

		const pinyin = typeof word?.pinyin === 'string' ? word.pinyin.trim() : '';
		const createdAt = Number.isFinite(Number(word?.createdAt))
			? Number(word.createdAt)
			: Date.now();

		await insertWordRecord({
			hanzi,
			pinyin,
			createdAt
		});

		hanziSet.add(hanzi);
	}
}

export function clearDatabase() {
	return withStore('readwrite', store => store.clear(), DB_STORE);
}

// ===================== TEMPORARY DICTIONARY =====================

export function getAllTemporaryWords() {
	return withStore('readonly', store => store.getAll(), TEMP_STORE);
}

export async function findTemporaryWordByHanzi(hanzi) {
	if (!hanzi) return null;

	const words = await getAllTemporaryWords();
	return words.find(word => word.hanzi === hanzi) || null;
}

function insertTemporaryWordRecord(record) {
	return withStore('readwrite', store => store.add(record), TEMP_STORE);
}

export async function addTemporaryWord(hanzi, pinyin = '') {
	const cleanHanzi = typeof hanzi === 'string' ? hanzi.trim() : '';
	const cleanPinyin = typeof pinyin === 'string' ? pinyin.trim() : '';

	if (!cleanHanzi) return;

	const baseWord = await findWordByHanzi(cleanHanzi);
	if (baseWord) return;

	const temporaryWord = await findTemporaryWordByHanzi(cleanHanzi);
	if (temporaryWord) return;

	return insertTemporaryWordRecord({
		hanzi: cleanHanzi,
		pinyin: cleanPinyin,
		createdAt: Date.now()
	});
}

export function deleteTemporaryWordById(id) {
	return withStore('readwrite', store => store.delete(id), TEMP_STORE);
}

export async function deleteTemporaryWordByHanzi(hanzi) {
	if (!hanzi) return;

	const word = await findTemporaryWordByHanzi(hanzi);
	if (!word) return;

	return deleteTemporaryWordById(word.id);
}

export function clearTemporaryWords() {
	return withStore('readwrite', store => store.clear(), TEMP_STORE);
}

export async function moveTemporaryWordToBase(id) {
	const temporaryWords = await getAllTemporaryWords();
	const word = temporaryWords.find(item => item.id === id);

	if (!word) return;

	const existing = await findWordByHanzi(word.hanzi);

	if (!existing) {
		await addWord(word.hanzi, word.pinyin || '');
	}

	await deleteTemporaryWordById(id);
}

// ===================== GENERATED TEXTS HISTORY =====================

const CURRENT_GENERATED_ID_KEY = 'currentGeneratedId';
const LAST_GENERATED_KEY = 'lastGenerated';

function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeGeneratedForStorage(content) {
	if (!content || typeof content !== 'object') return null;

	const type = content.type === 'dialogue' ? 'dialogue' : 'text';

	const blocks = Array.isArray(content.blocks)
		? content.blocks
			.filter(block => block && typeof block.chinese === 'string')
			.map((block, index) => ({
				ref: typeof block.ref === 'string' && block.ref.trim()
					? block.ref.trim()
					: `[${index + 1}]`,
				speaker: type === 'dialogue'
					? typeof block.speaker === 'string'
						? block.speaker
						: ['A', 'B', 'C', 'D'][index % 4]
					: null,
				chinese: block.chinese,
				tokens: Array.isArray(block.tokens) ? block.tokens : [],
				translation: typeof block.translation === 'string' ? block.translation : '',
				explanation: typeof block.explanation === 'string' ? block.explanation : ''
			}))
		: [];

	if (!blocks.length) return null;

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
		blocks,
		usedWords: Array.isArray(content.usedWords) ? content.usedWords : [],
		newWords: Array.isArray(content.newWords) ? content.newWords : [],
		pinyinGenerated: !!content.pinyinGenerated,
		translationGenerated: !!content.translationGenerated,
		explanationGenerated: !!content.explanationGenerated
	};
}

export function setCurrentGeneratedId(id) {
	try {
		if (id) {
			localStorage.setItem(CURRENT_GENERATED_ID_KEY, id);
		} else {
			localStorage.removeItem(CURRENT_GENERATED_ID_KEY);
		}
	} catch {
		// Ignore localStorage errors.
	}
}

export function getCurrentGeneratedId() {
	try {
		return localStorage.getItem(CURRENT_GENERATED_ID_KEY) || null;
	} catch {
		return null;
	}
}

export async function saveGeneratedToHistory(content) {
	const normalized = normalizeGeneratedForStorage(content);
	if (!normalized) return null;

	await withStore('readwrite', store => store.put(normalized), HISTORY_STORE);

	return normalized;
}

export async function getAllGeneratedHistory() {
	const items = await withStore('readonly', store => store.getAll(), HISTORY_STORE);

	return Array.isArray(items)
		? items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
		: [];
}

export async function getGeneratedById(id) {
	if (!id) return null;

	return withStore('readonly', store => store.get(id), HISTORY_STORE);
}

export async function deleteGeneratedById(id) {
	if (!id) return;

	await withStore('readwrite', store => store.delete(id), HISTORY_STORE);

	if (getCurrentGeneratedId() === id) {
		setCurrentGeneratedId(null);
	}
}

export async function saveLastGenerated(content) {
	const normalized = normalizeGeneratedForStorage(content);

	if (!normalized) {
		try {
			localStorage.removeItem(LAST_GENERATED_KEY);
			setCurrentGeneratedId(null);
		} catch {
			// Ignore localStorage errors.
		}

		return null;
	}

	try {
		localStorage.setItem(LAST_GENERATED_KEY, JSON.stringify(normalized));
		setCurrentGeneratedId(normalized.id);
	} catch {
		// Ignore localStorage errors.
	}

	await saveGeneratedToHistory(normalized);

	return normalized;
}

export function loadLastGenerated() {
	try {
		const raw = localStorage.getItem(LAST_GENERATED_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw);
		return normalizeGeneratedForStorage(parsed);
	} catch {
		return null;
	}
}