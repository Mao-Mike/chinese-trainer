
// --- Tab Navigation ---
document.querySelectorAll('.tab-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
		document.getElementById(btn.dataset.tab).classList.add('active');
	});
});


// --- IndexedDB Utility Migliorata ---
const DB_NAME = 'chinese_trainer_db';
const DB_STORE = 'words';
let db;
function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 2);
		req.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains(DB_STORE)) {
				db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
			}
		};
		req.onsuccess = e => { db = e.target.result; resolve(); };
		req.onerror = e => reject(e);
	});
}
function getAllWords() {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, 'readonly');
		const store = tx.objectStore(DB_STORE);
		const req = store.getAll();
		req.onsuccess = () => resolve(req.result);
		req.onerror = e => reject(e);
	});
}
function findWordByHanzi(hanzi) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, 'readonly');
		const store = tx.objectStore(DB_STORE);
		const req = store.getAll();
		req.onsuccess = () => {
			const found = req.result.find(w => w.hanzi === hanzi);
			resolve(found);
		};
		req.onerror = e => reject(e);
	});
}
function addWord(hanzi, pinyin, translation) {
	return new Promise(async (resolve, reject) => {
		// Impedisci duplicati hanzi
		const exists = await findWordByHanzi(hanzi);
		if (exists) return reject(new Error('Duplicato'));
		const tx = db.transaction(DB_STORE, 'readwrite');
		const store = tx.objectStore(DB_STORE);
		const now = Date.now();
		const req = store.add({ hanzi, pinyin, translation, createdAt: now });
		req.onsuccess = () => resolve();
		req.onerror = e => reject(e);
	});
}
function deleteWordById(id) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, 'readwrite');
		const store = tx.objectStore(DB_STORE);
		const req = store.delete(id);
		req.onsuccess = () => resolve();
		req.onerror = e => reject(e);
	});
}
async function importWords(words) {
	// Unisci senza duplicati hanzi
	const existing = await getAllWords();
	const hanziSet = new Set(existing.map(w => w.hanzi));
	const toAdd = words.filter(w => w.hanzi && !hanziSet.has(w.hanzi));
	for (const w of toAdd) {
		await addWord(w.hanzi, w.pinyin, w.translation);
	}
}



// --- Dizionario UI Migliorata ---
const dictInput = document.getElementById('dict-input');
const dictAddBtn = document.getElementById('dict-add');
const dictList = document.getElementById('dict-list');
const dictExportBtn = document.getElementById('dict-export');
const dictImportBtn = document.getElementById('dict-import');
const dictImportFile = document.getElementById('dict-import-file');

// Ricerca
let dictSearchInput = document.getElementById('dict-search-input');
if (!dictSearchInput) {
	dictSearchInput = document.createElement('input');
	dictSearchInput.type = 'text';
	dictSearchInput.id = 'dict-search-input';
	dictSearchInput.placeholder = 'Cerca hanzi, pinyin o traduzione';
	dictSearchInput.style.marginBottom = '0.7rem';
	dictInput.parentNode.parentNode.insertBefore(dictSearchInput, dictInput.parentNode.nextSibling);
}

function fakePinyin(word) {
	return word.split('').map(() => 'pīn-yīn').join(' ');
}
function fakeTranslation(word) {
	return 'Fake translation for "' + word + '"';
}

let allWordsCache = [];
function renderDictList(words) {
	dictList.innerHTML = '';
	words.forEach(w => {
		const li = document.createElement('li');
		const wordDiv = document.createElement('div');
		wordDiv.className = 'dict-word';
		wordDiv.innerHTML = `<span>${w.hanzi}</span><span class="dict-pinyin">${w.pinyin}</span><span class="dict-translation">${w.translation}</span>`;
		const delBtn = document.createElement('button');
		delBtn.className = 'dict-delete';
		delBtn.textContent = 'Elimina';
		delBtn.onclick = async () => {
			if (confirm(`Vuoi eliminare la parola "${w.hanzi}"?`)) {
				await deleteWordById(w.id); loadDict();
			}
		};
		li.appendChild(wordDiv);
		li.appendChild(delBtn);
		dictList.appendChild(li);
	});
}

async function loadDict() {
	allWordsCache = await getAllWords();
	filterAndRenderDict();
}

function filterAndRenderDict() {
	const q = dictSearchInput.value.trim().toLowerCase();
	let filtered = allWordsCache;
	if (q) {
		filtered = allWordsCache.filter(w =>
			(w.hanzi && w.hanzi.includes(q)) ||
			(w.pinyin && w.pinyin.toLowerCase().includes(q)) ||
			(w.translation && w.translation.toLowerCase().includes(q))
		);
	}
	renderDictList(filtered);
}

dictSearchInput.addEventListener('input', filterAndRenderDict);

dictAddBtn.onclick = async () => {
	const hanzi = dictInput.value.trim();
	if (!hanzi) return;
	try {
		await addWord(hanzi, fakePinyin(hanzi), fakeTranslation(hanzi));
		dictInput.value = '';
		loadDict();
	} catch (e) {
		if (e.message === 'Duplicato') {
			alert('Questa parola esiste già!');
		} else {
			alert('Errore: ' + e.message);
		}
	}
};

dictExportBtn.onclick = async () => {
	const words = await getAllWords();
	const exportWords = words.map(({id, ...rest}) => rest); // Esporta senza id
	const blob = new Blob([JSON.stringify(exportWords, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'chinese-trainer-dictionary.json';
	a.click();
	URL.revokeObjectURL(url);
};

dictImportBtn.onclick = () => dictImportFile.click();
dictImportFile.onchange = async e => {
	const file = e.target.files[0];
	if (!file) return;
	const text = await file.text();
	try {
		let words = JSON.parse(text);
		// Normalizza struttura
		words = words.map(w => ({
			hanzi: w.hanzi || w.word || '',
			pinyin: w.pinyin || '',
			translation: w.translation || '',
			createdAt: w.createdAt || Date.now()
		})).filter(w => w.hanzi);
		await importWords(words);
		loadDict();
	} catch {
		alert('File non valido');
	}
	dictImportFile.value = '';
};


// --- Generazione Migliorata ---
const genTypeRadios = document.getElementsByName('gen-type');
const genLength = document.getElementById('gen-length');
const genLengthValue = document.getElementById('gen-length-value');
const genBtn = document.getElementById('gen-generate');
const genOutput = document.getElementById('gen-output');

genLength.oninput = () => {
	genLengthValue.textContent = genLength.value;
};

function randomInt(a, b) {
	return Math.floor(Math.random() * (b - a + 1)) + a;
}

function shuffle(arr) {
	let a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function pick(arr) {
	return arr[randomInt(0, arr.length - 1)];
}

function joinPinyin(arr) {
	return arr.map(w => w.pinyin).join(' ');
}

function joinTranslation(arr) {
	return arr.map(w => w.translation).join(' ');
}

function getUsedAndNewWords(used, all) {
	const usedSet = new Set(used.map(w => w.hanzi));
	const allSet = new Set(all.map(w => w.hanzi));
	const usedWords = all.filter(w => usedSet.has(w.hanzi));
	const newWords = all.filter(w => !usedSet.has(w.hanzi));
	return { usedWords, newWords };
}

async function generateContent(words, type, length) {
	if (!words.length) return { error: 'Aggiungi parole nel dizionario!' };
	// Usa circa il 95% delle parole
	let n = Math.max(1, Math.round(words.length * 0.95));
	let pool = shuffle(words).slice(0, n);
	let hanziArr = [];
	let pinyinArr = [];
	let translationArr = [];
	let speakers = [];
	let output = '';
	if (type === 'text') {
		while (hanziArr.join('').length < length) {
			const w = pick(pool);
			hanziArr.push(w.hanzi);
			pinyinArr.push(w.pinyin);
			translationArr.push(w.translation);
			if (Math.random() > 0.7) hanziArr.push('，');
		}
		output = hanziArr.join('').slice(0, length) + '。';
		return {
			chinese: output,
			pinyin: pinyinArr.join(' ').slice(0, length * 3),
			translation: translationArr.join(' ').slice(0, length * 5),
			usedWords: pool,
			newWords: words.filter(w => !pool.some(u => u.hanzi === w.hanzi))
		};
	} else {
		// Dialogo
		const nSpeakers = randomInt(2, 4);
		speakers = ['A', 'B', 'C', 'D'].slice(0, nSpeakers);
		let lines = [];
		let total = 0;
		let usedSet = new Set();
		while (total < length) {
			const name = pick(speakers);
			let phraseArr = [];
			let phrasePinyin = [];
			let phraseTrans = [];
			for (let i = 0; i < randomInt(2, 7); i++) {
				const w = pick(pool);
				phraseArr.push(w.hanzi);
				phrasePinyin.push(w.pinyin);
				phraseTrans.push(w.translation);
				usedSet.add(w.hanzi);
			}
			const phrase = phraseArr.join('');
			lines.push(`<b>${name}:</b> ${phrase}`);
			total += phrase.length;
			hanziArr.push(...phraseArr);
			pinyinArr.push(...phrasePinyin);
			translationArr.push(...phraseTrans);
		}
		output = lines.join('<br>');
		// Solo le parole effettivamente usate
		const usedWords = pool.filter(w => usedSet.has(w.hanzi));
		return {
			chinese: hanziArr.join('').slice(0, length) + '。',
			pinyin: pinyinArr.join(' ').slice(0, length * 3),
			translation: translationArr.join(' ').slice(0, length * 5),
			usedWords,
			newWords: words.filter(w => !usedWords.some(u => u.hanzi === w.hanzi)),
			output
		};
	}
}

genBtn.onclick = async () => {
	const type = Array.from(genTypeRadios).find(r => r.checked).value;
	const length = parseInt(genLength.value, 10);
	const words = await getAllWords();
	if (!words.length) {
		genOutput.innerHTML = '<div style="color:#ff3b30">Aggiungi parole nel dizionario!</div>';
		return;
	}
	const result = await generateContent(words, type, length);
	if (result.error) {
		genOutput.innerHTML = `<div style="color:#ff3b30">${result.error}</div>`;
		return;
	}
	// Mostra output dettagliato
	let html = '';
	if (type === 'dialogue' && result.output) {
		html += `<div style="margin-bottom:0.7rem">${result.output}</div>`;
	} else {
		html += `<div class="study-text">${result.chinese}</div>`;
	}
	html += `<div class="study-text"><b>Pinyin:</b> <span>${result.pinyin}</span></div>`;
	html += `<div class="study-text"><b>Traduzione:</b> <span>${result.translation}</span></div>`;
	html += `<div class="study-text"><b>Parole usate:</b> <span>${result.usedWords.map(w => w.hanzi).join(', ')}</span></div>`;
	html += `<div class="study-text"><b>Parole nuove:</b> <span>${result.newWords.map(w => w.hanzi).join(', ') || '-'}</span></div>`;
	genOutput.innerHTML = html;
	// Salva per Studio
	window.lastGenerated = {
		chinese: result.chinese,
		pinyin: result.pinyin,
		translation: result.translation
	};
	// Aggiorna anche la sezione studio
	studyChinese.textContent = result.chinese;
	studyPinyin.classList.add('hidden');
	studyTranslation.classList.add('hidden');
	studyExplanation.classList.add('hidden');
};


// --- Studio Migliorato ---
const studyChinese = document.getElementById('study-chinese');
const studyPinyin = document.getElementById('study-pinyin');
const studyTranslation = document.getElementById('study-translation');
const studyExplanation = document.getElementById('study-explanation');
const studyShowPinyin = document.getElementById('study-show-pinyin');
const studyShowTranslation = document.getElementById('study-show-translation');
const studyExplain = document.getElementById('study-explain');

function loadLastGeneratedToStudy() {
	const last = window.lastGenerated;
	if (last && last.chinese) {
		studyChinese.textContent = last.chinese;
		studyPinyin.textContent = '';
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyPinyin.classList.add('hidden');
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
	} else {
		studyChinese.textContent = 'Genera un testo nella sezione Generazione.';
		studyPinyin.textContent = '';
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyPinyin.classList.add('hidden');
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
	}
}

// Carica testo quando si entra nella tab Studio
document.querySelector('[data-tab="study"]').addEventListener('click', loadLastGeneratedToStudy);

studyShowPinyin.onclick = () => {
	const last = window.lastGenerated;
	if (!last || !last.pinyin) return;
	studyPinyin.textContent = last.pinyin;
	studyPinyin.classList.remove('hidden');
};
studyShowTranslation.onclick = () => {
	const last = window.lastGenerated;
	if (!last || !last.translation) return;
	studyTranslation.textContent = last.translation;
	studyTranslation.classList.remove('hidden');
};
studyExplain.onclick = () => {
	const last = window.lastGenerated;
	if (!last || !last.chinese) return;
	// Spiegazione mock parola per parola
	const hanziArr = last.chinese.replace(/[，。,.!?]/g, '').split('');
	let html = '';
	hanziArr.forEach((h, i) => {
		if (h.trim()) {
			html += `<div style="margin-bottom:0.3rem"><b>${h}</b>: Spiegazione mock della parola "${h}"</div>`;
		}
	});
	studyExplanation.innerHTML = html;
	studyExplanation.classList.remove('hidden');
};

// Carica subito se già generato
if (window.lastGenerated) loadLastGeneratedToStudy();

// --- PWA Service Worker ---
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('service-worker.js').then(() => {
			console.log('Service Worker Registered');
		});
	});
} else {
	console.warn('Service Worker not supported in this browser');
}

// --- Init ---
openDB().then(loadDict);
