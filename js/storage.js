const DB_NAME = 'chinese_trainer_db';
const DB_STORE = 'words';
const DB_VERSION = 2;

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
		};

		req.onsuccess = e => {
			resolve(e.target.result);
		};

		req.onerror = e => reject(e);
	});

	return dbPromise;
}

async function withStore(mode, callback) {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, mode);
		const store = tx.objectStore(DB_STORE);
		const request = callback(store);

		request.onsuccess = () => resolve(request.result);
		request.onerror = e => reject(e);
	});
}

export function getAllWords() {
	return withStore('readonly', store => store.getAll());
}

export async function findWordByHanzi(hanzi) {
	const words = await getAllWords();
	return words.find(word => word.hanzi === hanzi);
}

export async function addWord(hanzi, pinyin, translation) {
	const exists = await findWordByHanzi(hanzi);
	if (exists) {
		throw new Error('Duplicato');
	}

	const createdAt = Date.now();
	return withStore('readwrite', store => store.add({ hanzi, pinyin, translation, createdAt }));
}

export function deleteWordById(id) {
	return withStore('readwrite', store => store.delete(id));
}

export async function importWords(words) {
	const existing = await getAllWords();
	const hanziSet = new Set(existing.map(word => word.hanzi));
	const toAdd = words.filter(word => word.hanzi && !hanziSet.has(word.hanzi));

	for (const word of toAdd) {
		await addWord(word.hanzi, word.pinyin, word.translation);
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
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
