// ===================== PINYIN CACHE =====================
const PINYIN_CACHE_KEY = 'pinyinCache';

export function getCachedPinyin(hanzi) {
	if (!hanzi || typeof hanzi !== 'string' || !hanzi.trim()) return null;
	try {
		const cache = JSON.parse(localStorage.getItem(PINYIN_CACHE_KEY) || '{}');
		const entry = cache[hanzi.trim()];
		if (!entry || !entry.pinyin) return null;
		return { hanzi: entry.hanzi, pinyin: entry.pinyin, createdAt: entry.createdAt };
	} catch {
		return null;
	}
}

export function setCachedPinyin(hanzi, pinyin) {
	if (!hanzi || typeof hanzi !== 'string' || !hanzi.trim()) return;
	if (!pinyin || typeof pinyin !== 'string' || !pinyin.trim()) return;
	try {
		const cache = JSON.parse(localStorage.getItem(PINYIN_CACHE_KEY) || '{}');
		cache[hanzi.trim()] = {
			hanzi: hanzi.trim(),
			pinyin: pinyin.trim(),
			createdAt: Date.now()
		};
		localStorage.setItem(PINYIN_CACHE_KEY, JSON.stringify(cache));
	} catch {}
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
	const now = new Date();
	return now.toISOString().slice(0, 10);
}

export function getAIUsageToday() {
	try {
		const usage = JSON.parse(localStorage.getItem(AI_USAGE_KEY) || '{}');
		const today = getTodayString();
		if (usage.date !== today) {
			return { date: today, total: 0, generation: 0, pinyin: 0 };
		}
		return {
			date: usage.date,
			total: usage.total || 0,
			generation: usage.generation || 0,
			pinyin: usage.pinyin || 0
		};
	} catch {
		return { date: getTodayString(), total: 0, generation: 0, pinyin: 0 };
	}
}

export function incrementAIUsage(kind) {
	const today = getTodayString();
	let usage = {};
	try {
		usage = JSON.parse(localStorage.getItem(AI_USAGE_KEY) || '{}');
	} catch { usage = {}; }
	if (usage.date !== today) {
		usage = { date: today, total: 0, generation: 0, pinyin: 0 };
	}
	usage.total = (usage.total || 0) + 1;
	if (kind === 'generation') usage.generation = (usage.generation || 0) + 1;
	else if (kind === 'pinyin') usage.pinyin = (usage.pinyin || 0) + 1;
	localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
}
// ...existing code...



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

		   req.onupgradeneeded = e => {
			   const db = e.target.result;
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

		   req.onsuccess = e => {
			   resolve(e.target.result);
		   };

		   req.onerror = e => reject(e);
	   });
// ===================== GENERATED TEXTS HISTORY =====================
const CURRENT_GENERATED_ID_KEY = 'currentGeneratedId';

export const saveGeneratedToHistory = async (content) => {
   if (!content || !content.id) return;
   const db = await openDB();
   return new Promise((resolve, reject) => {
	   const tx = db.transaction(HISTORY_STORE, 'readwrite');
	   const store = tx.objectStore(HISTORY_STORE);
	   const req = store.put(content);
	   req.onsuccess = () => resolve(req.result);
	   req.onerror = e => reject(e);
   });
};

export const getAllGeneratedHistory = async () => {
   const db = await openDB();
   return new Promise((resolve, reject) => {
	   const tx = db.transaction(HISTORY_STORE, 'readonly');
	   const store = tx.objectStore(HISTORY_STORE);
	   const req = store.getAll();
	   req.onsuccess = () => {
		   // Più recenti prima
		   const arr = Array.isArray(req.result) ? req.result.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
		   resolve(arr);
	   };
	   req.onerror = e => reject(e);
   });
};

export const getGeneratedById = async (id) => {
   if (!id) return null;
   const db = await openDB();
   return new Promise((resolve, reject) => {
	   const tx = db.transaction(HISTORY_STORE, 'readonly');
	   const store = tx.objectStore(HISTORY_STORE);
	   const req = store.get(id);
	   req.onsuccess = () => resolve(req.result || null);
	   req.onerror = e => reject(e);
   });
};

export const deleteGeneratedById = async (id) => {
   if (!id) return;
   const db = await openDB();
   return new Promise((resolve, reject) => {
	   const tx = db.transaction(HISTORY_STORE, 'readwrite');
	   const store = tx.objectStore(HISTORY_STORE);
	   const req = store.delete(id);
	   req.onsuccess = () => resolve();
	   req.onerror = e => reject(e);
   });
};

export const setCurrentGeneratedId = (id) => {
	if (id) localStorage.setItem(CURRENT_GENERATED_ID_KEY, id);
	else localStorage.removeItem(CURRENT_GENERATED_ID_KEY);
};

export const getCurrentGeneratedId = () => {
	return localStorage.getItem(CURRENT_GENERATED_ID_KEY) || null;
};

// Compatibilità: loadLastGenerated preferisce currentGeneratedId
export const loadLastGenerated = async () => {
   const currentId = getCurrentGeneratedId();
   if (currentId) {
	   const found = await getGeneratedById(currentId);
	   if (found) return found;
   }
   // fallback legacy
   try {
	   const raw = localStorage.getItem('lastGenerated');
	   if (raw) return JSON.parse(raw);
   } catch {}
   return null;
};

// Compatibilità: saveLastGenerated salva anche nello storico
export const saveLastGenerated = async (content) => {
   if (!content || !content.id) return;
   try {
	   localStorage.setItem('lastGenerated', JSON.stringify(content));
   } catch {}
   await saveGeneratedToHistory(content);
   setCurrentGeneratedId(content.id);
};

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
