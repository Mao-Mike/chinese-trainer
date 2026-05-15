import { createDemoTokens, fakeTranslation } from './utils.js';


const DB_NAME = 'chinese_trainer_db';
const DB_STORE = 'words';
const TEMP_STORE = 'temporaryWords';
const DB_VERSION = 3;

let dbPromise = null;

export function openDB() {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains(DB_STORE)) {
				db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
			}
			if (!db.objectStoreNames.contains(TEMP_STORE)) {
				db.createObjectStore(TEMP_STORE, { keyPath: 'id', autoIncrement: true });
			}
		};

		req.onsuccess = e => {
			resolve(e.target.result);
		};

		req.onerror = e => reject(e);
	});

	return dbPromise;
}


async function withStore(mode, callback, storeName = DB_STORE) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);
		const request = callback(store);
		request.onsuccess = () => resolve(request.result);
		request.onerror = e => reject(e);
	});
}
// ===================== TEMPORARY DICTIONARY =====================

export function getAllTemporaryWords() {
	return withStore('readonly', store => store.getAll(), TEMP_STORE);
}

export async function findTemporaryWordByHanzi(hanzi) {
	const words = await getAllTemporaryWords();
	return words.find(word => word.hanzi === hanzi);
}

async function insertTemporaryWordRecord(record) {
	return withStore('readwrite', store => store.add(record), TEMP_STORE);
}

export async function addTemporaryWord(hanzi, pinyin) {
	if (!hanzi) return;
	// Non aggiungere se già nel base
	const base = await findWordByHanzi(hanzi);
	if (base) return;
	// Non aggiungere se già nel temporaneo
	const temp = await findTemporaryWordByHanzi(hanzi);
	if (temp) return;
	const createdAt = Date.now();
	return insertTemporaryWordRecord({ hanzi, pinyin, createdAt });
}

export function deleteTemporaryWordById(id) {
	return withStore('readwrite', store => store.delete(id), TEMP_STORE);
}

export async function deleteTemporaryWordByHanzi(hanzi) {
	const words = await getAllTemporaryWords();
	const word = words.find(w => w.hanzi === hanzi);
	if (word) {
		return deleteTemporaryWordById(word.id);
	}
}

export function clearTemporaryWords() {
	return withStore('readwrite', store => store.clear(), TEMP_STORE);
}

export async function moveTemporaryWordToBase(id) {
	// Trova la voce temporanea
	const words = await getAllTemporaryWords();
	const word = words.find(w => w.id === id);
	if (!word) return;
	// Se non già nel base, aggiungi
	const base = await findWordByHanzi(word.hanzi);
	if (!base) {
		await addWord(word.hanzi, word.pinyin);
	}
	// Elimina dal temporaneo
	await deleteTemporaryWordById(id);
}

export function getAllWords() {
	return withStore('readonly', store => store.getAll());
}

export async function findWordByHanzi(hanzi) {
	const words = await getAllWords();
	return words.find(word => word.hanzi === hanzi);
}

async function insertWordRecord(record) {
	return withStore('readwrite', store => store.add(record));
}

export async function addWord(hanzi, pinyin) {
	const exists = await findWordByHanzi(hanzi);
	if (exists) {
		throw new Error('Duplicato');
	}

	const createdAt = Date.now();
	return insertWordRecord({ hanzi, pinyin, createdAt });
}

export function deleteWordById(id) {
	return withStore('readwrite', store => store.delete(id));
}

export async function importWords(words) {
	const existing = await getAllWords();
	const hanziSet = new Set(existing.map(word => word.hanzi));
	for (const word of words) {
		if (!word.hanzi || hanziSet.has(word.hanzi)) {
			continue;
		}
		await insertWordRecord({
			hanzi: word.hanzi,
			pinyin: word.pinyin || '',
			createdAt: typeof word.createdAt === 'number' ? word.createdAt : Date.now()
		});
		hanziSet.add(word.hanzi);
	}
}

export function clearDatabase() {
	return withStore('readwrite', store => store.clear());
}

export function saveLastGenerated(lastGenerated) {
	try {
		if (lastGenerated) {
			localStorage.setItem('lastGenerated', JSON.stringify(lastGenerated));
		} else {
			localStorage.removeItem('lastGenerated');
		}
	} catch {
		// Ignore storage failures.
	}
}

export function loadLastGenerated() {
	try {
		const raw = localStorage.getItem('lastGenerated');
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		const normalized = normalizeLastGenerated(parsed);
		if (normalized !== parsed) {
			saveLastGenerated(normalized);
		}
		return normalized;
	} catch {
		return null;
	}
}

function normalizeLastGenerated(value) {
	if (!value || typeof value !== 'object') return null;
	if (Array.isArray(value.blocks)) return value;
	if (typeof value.content !== 'string') return null;

	if (value.type === 'dialogue') {
		const lines = value.content.split('\n').filter(Boolean);
		return {
			id: value.id || makeId(),
			createdAt: value.createdAt || Date.now(),
			type: 'dialogue',
			title: value.title || '',
			topic: value.topic || '',
			targetLength: value.targetLength || value.content.length,
			blocks: lines.map((line, index) => {
				const [speakerRaw, ...phraseParts] = line.split(':');
				const speaker = (speakerRaw || '').trim() || null;
				const chinese = phraseParts.join(':').trim();
				return {
					ref: `[${index + 1}]`,
					speaker,
					chinese,
					tokens: createDemoTokens(chinese),
					translation: fakeTranslation(chinese),
					explanation: `Spiegazione di: ${chinese}`
				};
			}),
			usedWords: simplifyWords(value.words || []),
			newWords: []
		};
	}

	const content = value.content;
	const chunks = [];
	let i = 0;
	while (i < content.length) {
		chunks.push(content.slice(i, i + 100));
		i += 100;
	}

	return {
		id: value.id || makeId(),
		createdAt: value.createdAt || Date.now(),
		type: 'text',
		title: value.title || '',
		topic: value.topic || '',
		targetLength: value.targetLength || content.length,
		blocks: chunks.map((chunk, index) => ({
			ref: `[${index + 1}]`,
			speaker: null,
			chinese: chunk,
			tokens: createDemoTokens(chunk),
			translation: fakeTranslation(chunk),
			explanation: `Spiegazione di: ${chunk}`
		})),
		usedWords: simplifyWords(value.words || []),
		newWords: []
	};
}

function simplifyWords(words) {
	return Array.isArray(words)
		? words
			.filter(word => word && word.hanzi)
			.map(word => ({
				hanzi: word.hanzi,
				pinyin: word.pinyin || '',
				translation: word.translation || ''
			}))
		: [];
}

function makeId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
