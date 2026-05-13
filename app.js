
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
const dictSearchInput = document.getElementById('dict-search-input');

// Cancella tutti i caratteri
const dictClearBtn = document.getElementById('dict-clear');
dictClearBtn.onclick = async () => {
	if (confirm('Vuoi cancellare tutti i caratteri dal dizionario?')) {
		const tx = db.transaction(DB_STORE, 'readwrite');
		const store = tx.objectStore(DB_STORE);
		const clearReq = store.clear();
		clearReq.onsuccess = () => loadDict();
		clearReq.onerror = () => alert('Errore durante la cancellazione');
	}
};

function fakePinyin(word) {
	// Genera pinyin dimostrativo semplice
	return word.split('').map(() => 'pīn yīn').join(' ');
}
function fakeTranslation(word) {
	// Genera traduzione dimostrativa semplice
	return 'Traduzione di ' + word;
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



// --- Generazione aggiornata ---
const genTypeRadios = document.getElementsByName('gen-type');
const genLength = document.getElementById('gen-length');
const genLengthValue = document.getElementById('gen-length-value');
const genBtn = document.getElementById('gen-generate');
const genTitle = document.getElementById('gen-title');

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

function randomTitle(type) {
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

function generateDemoText(words, length) {
	// Usa parole dal dizionario o caratteri dimostrativi
	let pool = words.length ? shuffle(words) : [
		{ hanzi: '我', pinyin: 'wǒ', translation: 'io' },
		{ hanzi: '喜欢', pinyin: 'xǐ huān', translation: 'piace' },
		{ hanzi: '学习', pinyin: 'xué xí', translation: 'studiare' },
		{ hanzi: '中文', pinyin: 'zhōng wén', translation: 'cinese' },
		{ hanzi: '朋友', pinyin: 'péng yǒu', translation: 'amico' },
		{ hanzi: '吃饭', pinyin: 'chī fàn', translation: 'mangiare' },
		{ hanzi: '学校', pinyin: 'xué xiào', translation: 'scuola' },
		{ hanzi: '老师', pinyin: 'lǎo shī', translation: 'insegnante' }
	];
	let out = '';
	while (out.length < length) {
		out += pick(pool).hanzi;
		if (Math.random() > 0.7) out += '，';
	}
	return out.slice(0, length) + '。';
}

function generateDemoDialogue(words, length) {
	let pool = words.length ? shuffle(words) : [
		{ hanzi: '你', pinyin: 'nǐ', translation: 'tu' },
		{ hanzi: '好吗', pinyin: 'hǎo ma', translation: 'come va' },
		{ hanzi: '谢谢', pinyin: 'xiè xie', translation: 'grazie' },
		{ hanzi: '再见', pinyin: 'zài jiàn', translation: 'arrivederci' },
		{ hanzi: '今天', pinyin: 'jīn tiān', translation: 'oggi' },
		{ hanzi: '天气', pinyin: 'tiān qì', translation: 'tempo (meteo)' },
		{ hanzi: '很好', pinyin: 'hěn hǎo', translation: 'molto bene' },
		{ hanzi: '请问', pinyin: 'qǐng wèn', translation: 'scusi' }
	];
	const nSpeakers = randomInt(2, 4);
	const names = ['A', 'B', 'C', 'D'].slice(0, nSpeakers);
	let lines = [];
	let total = 0;
	while (total < length) {
		const name = pick(names);
		let phrase = '';
		for (let i = 0; i < randomInt(2, 7); i++) phrase += pick(pool).hanzi;
		lines.push(name + ': ' + phrase);
		total += phrase.length;
	}
	return lines.join('\n');
}

genBtn.onclick = async () => {
	const type = Array.from(genTypeRadios).find(r => r.checked).value;
	const length = parseInt(genLength.value, 10);
	const words = await getAllWords();
	if (!words.length && type === 'text') {
		genTitle.textContent = 'Aggiungi parole nel dizionario!';
		window.lastGenerated = null;
		renderStudy();
		return;
	}
	let title = randomTitle(type);
	let content = '';
	if (type === 'text') {
		content = generateDemoText(words, length);
	} else {
		content = generateDemoDialogue(words, length);
	}
	genTitle.textContent = title;
	window.lastGenerated = {
		type,
		title,
		content,
		words: words.length ? words : null
	};
	renderStudy();
};



// --- Studio aggiornata ---
const studyChinese = document.getElementById('study-chinese');
const studyTranslation = document.getElementById('study-translation');
const studyExplanation = document.getElementById('study-explanation');
const studyShowPinyin = document.getElementById('study-show-pinyin');
const studyShowTranslation = document.getElementById('study-show-translation');
const studyExplain = document.getElementById('study-explain');

let pinyinVisible = false;
let translationVisible = false;
let explanationVisible = false;

function splitWithRefs(text, blockSize = 100) {
	// Divide testo in blocchi con riferimenti [1], [2], ...
	let blocks = [];
	let i = 0;
	while (i < text.length) {
		let chunk = text.slice(i, i + blockSize);
		blocks.push(chunk);
		i += blockSize;
	}
	return blocks.map((b, idx) => ({ text: b, ref: `[${idx + 1}]` }));
}


// --- Rendering pinyin sopra hanzi ---
function renderChineseBlock(hanzi, pinyin, showPinyin) {
	return `<span class="chinese-block">${showPinyin ? `<span class="pinyin">${pinyin}</span>` : ''}<span class="hanzi">${hanzi}</span></span>`;
}

function renderStudyLine(hanziLine, pinyinLine, showPinyin) {
	// hanziLine e pinyinLine sono stringhe di pari lunghezza (o gruppi)
	const hanziArr = hanziLine.split('');
	const pinyinArr = fakePinyin(hanziLine).split(' ');
	let blocks = '';
	for (let i = 0; i < hanziArr.length; i++) {
		blocks += renderChineseBlock(hanziArr[i], pinyinArr[i] || '', showPinyin);
	}
	return `<span class="study-line">${blocks}</span>`;
}

function renderDialogueLine(speaker, hanziLine, showPinyin) {
	const hanziArr = hanziLine.split('');
	const pinyinArr = fakePinyin(hanziLine).split(' ');
	let blocks = '';
	for (let i = 0; i < hanziArr.length; i++) {
		blocks += renderChineseBlock(hanziArr[i], pinyinArr[i] || '', showPinyin);
	}
	return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content study-line">${blocks}</span></div>`;
}

function renderStudy() {
	const last = window.lastGenerated;
	if (!last || !last.content) {
		studyChinese.textContent = 'Nessun testo generato. Usa la sezione Generazione.';
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
		return;
	}
	// Testo unico
	if (last.type === 'text') {
		const blocks = splitWithRefs(last.content);
		studyChinese.innerHTML = blocks.map(b => renderStudyLine(b.text, fakePinyin(b.text), pinyinVisible) + `<span style='color:#bbb;margin-left:0.5em'>${b.ref}</span>`).join('');
		// Traduzione
		if (translationVisible) {
			studyTranslation.innerHTML = blocks.map(b => `<div>${fakeTranslation(b.text)} <span style='color:#bbb'>${b.ref}</span></div>`).join('');
			studyTranslation.classList.remove('hidden');
			studyExplanation.classList.add('hidden');
		} else {
			studyTranslation.classList.add('hidden');
		}
		// Spiegazione
		if (explanationVisible) {
			studyExplanation.innerHTML = blocks.map(b => `<div>Spiegazione di: ${b.text} <span style='color:#bbb'>${b.ref}</span></div>`).join('');
			studyExplanation.classList.remove('hidden');
			studyTranslation.classList.add('hidden');
		} else {
			studyExplanation.classList.add('hidden');
		}
	} else {
		// Dialogo
		const lines = last.content.split('\n');
		studyChinese.innerHTML = lines.map((line, idx) => {
			const [speaker, ...phraseArr] = line.split(':');
			const phrase = phraseArr.join(':').trim();
			return renderDialogueLine(speaker, phrase, pinyinVisible) + `<span style='color:#bbb;margin-left:0.5em'>[${idx + 1}]</span>`;
		}).join('');
		// Traduzione
		if (translationVisible) {
			studyTranslation.innerHTML = lines.map((line, idx) => {
				const [speaker, ...phraseArr] = line.split(':');
				const phrase = phraseArr.join(':').trim();
				return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content">${fakeTranslation(phrase)}</span><span style='color:#bbb;margin-left:0.5em'>[${idx + 1}]</span></div>`;
			}).join('');
			studyTranslation.classList.remove('hidden');
			studyExplanation.classList.add('hidden');
		} else {
			studyTranslation.classList.add('hidden');
		}
		// Spiegazione
		if (explanationVisible) {
			studyExplanation.innerHTML = lines.map((line, idx) => {
				const [speaker, ...phraseArr] = line.split(':');
				const phrase = phraseArr.join(':').trim();
				return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content">Spiegazione di: ${phrase}</span><span style='color:#bbb;margin-left:0.5em'>[${idx + 1}]</span></div>`;
			}).join('');
			studyExplanation.classList.remove('hidden');
			studyTranslation.classList.add('hidden');
		} else {
			studyExplanation.classList.add('hidden');
		}
	}
	// Aggiorna pulsante pinyin
	studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
}

document.querySelector('[data-tab="study"]').addEventListener('click', renderStudy);

studyShowPinyin.onclick = () => {
	pinyinVisible = !pinyinVisible;
	renderStudy();
};
studyShowTranslation.onclick = () => {
	translationVisible = !translationVisible;
	if (translationVisible) explanationVisible = false;
	renderStudy();
};
studyExplain.onclick = () => {
	explanationVisible = !explanationVisible;
	if (explanationVisible) translationVisible = false;
	renderStudy();
};

// Carica subito se già generato
if (window.lastGenerated) renderStudy();

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
