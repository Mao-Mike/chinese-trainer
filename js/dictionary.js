import { enrichWordWithAI } from './ai.js';
import { addWord, clearDatabase, deleteWordById, getAllWords, importWords } from './storage.js';

export function initDictionary() {
	const dictInput = document.getElementById('dict-input');
	const dictFindBtn = document.getElementById('dict-find-pinyin');
	const dictAddBtn = document.getElementById('dict-add');
	const dictList = document.getElementById('dict-list');
	const dictExportBtn = document.getElementById('dict-export');
	const dictImportBtn = document.getElementById('dict-import');
	const dictImportFile = document.getElementById('dict-import-file');
	const dictClearBtn = document.getElementById('dict-clear');
	const dictPreview = document.getElementById('dict-preview');
	const dictStatus = document.getElementById('dict-status');
	const dictSearchInput = document.getElementById('dict-search-input');

	let allWordsCache = [];
	let pendingWord = null;
	let lookupToken = 0;

	function setPreview(text) {
		dictPreview.textContent = text;
	}

	function setStatus(message = '', state = '') {
		dictStatus.textContent = message;
		dictStatus.className = state ? `dict-status ${state}` : 'dict-status';
	}

	function hasGeminiApiKey() {
		try {
			if (typeof localStorage === 'undefined') {
				return false;
			}

			const value = localStorage.getItem('geminiApiKey') || localStorage.geminiApiKey || '';
			return typeof value === 'string' && value.trim().length > 0;
		} catch {
			return false;
		}
	}

	function normalizeStoredWord(word) {
		return {
			hanzi: word.hanzi || '',
			pinyin: word.pinyin || '',
			createdAt: typeof word.createdAt === 'number' ? word.createdAt : Date.now()
		};
	}

	function clearPendingWord() {
		lookupToken += 1;
		pendingWord = null;
		setPreview('Pinyin non ancora disponibile');
	}

	function renderDictList(words) {
		dictList.innerHTML = '';

		words.forEach(word => {
			const li = document.createElement('li');
			const wordDiv = document.createElement('div');
			wordDiv.className = 'dict-word';

			const hanziSpan = document.createElement('span');
			hanziSpan.textContent = word.hanzi;
			wordDiv.appendChild(hanziSpan);

			const pinyinSpan = document.createElement('span');
			pinyinSpan.className = 'dict-pinyin';
			pinyinSpan.textContent = word.pinyin || '';
			wordDiv.appendChild(pinyinSpan);

			const delBtn = document.createElement('button');
			delBtn.className = 'dict-delete';
			delBtn.textContent = 'Elimina';
			delBtn.onclick = async () => {
				if (confirm(`Vuoi eliminare la parola "${word.hanzi}"?`)) {
					await deleteWordById(word.id);
					loadDict();
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
			filtered = allWordsCache.filter(word =>
				(word.hanzi && word.hanzi.toLowerCase().includes(q)) ||
				(word.pinyin && word.pinyin.toLowerCase().includes(q))
			);
		}

		renderDictList(filtered);
	}

	async function findPinyin() {
		const hanzi = dictInput.value.trim();
		if (!hanzi) return;

		if (!hasGeminiApiKey()) {
			setStatus('Inserisci la Gemini API key nelle Impostazioni.', 'error-message');
			return;
		}

		const requestId = ++lookupToken;
		const originalLabel = dictFindBtn.textContent;
		dictFindBtn.disabled = true;
		dictFindBtn.textContent = 'Cerco...';
		setStatus('Cerco pinyin...', 'loading');

		try {
			const enriched = await enrichWordWithAI(hanzi);
			if (requestId !== lookupToken) {
				return;
			}

			const pinyin = typeof enriched.pinyin === 'string' ? enriched.pinyin.trim() : '';
			if (!pinyin) {
				throw new Error('empty_pinyin');
			}

			pendingWord = {
				hanzi: typeof enriched.hanzi === 'string' && enriched.hanzi.trim() ? enriched.hanzi.trim() : hanzi,
				pinyin,
				createdAt: Date.now()
			};
			setPreview(`Pinyin: ${pendingWord.pinyin}`);
			setStatus('Pinyin trovato.', 'success-message');
		} catch (error) {
			if (requestId !== lookupToken) {
				return;
			}

			pendingWord = null;
			setPreview('Pinyin non ancora disponibile');
			setStatus('Non riesco a trovare il pinyin. Controlla API key o connessione.', 'error-message');
			console.error(error);
		} finally {
			dictFindBtn.disabled = false;
			dictFindBtn.textContent = originalLabel;
		}
	}

	dictInput.addEventListener('input', () => {
		clearPendingWord();
		setStatus('');
	});

	dictFindBtn.onclick = findPinyin;

	dictAddBtn.onclick = async () => {
		const hanzi = dictInput.value.trim();
		if (!hanzi) return;
		if (!hasGeminiApiKey()) {
			setStatus('Inserisci la Gemini API key nelle Impostazioni.', 'error-message');
			return;
		}
		const originalLabel = dictAddBtn.textContent;
		dictAddBtn.disabled = true;
		dictAddBtn.textContent = 'Cerco...';
		let wordToSave = null;
		try {
			if (pendingWord && pendingWord.hanzi === hanzi) {
				wordToSave = pendingWord;
			} else {
				setStatus('Cerco pinyin...', 'loading');
				const enriched = await enrichWordWithAI(hanzi);
				const pinyin = typeof enriched.pinyin === 'string' ? enriched.pinyin.trim() : '';
				if (!pinyin) throw new Error('empty_pinyin');
				wordToSave = {
					hanzi: typeof enriched.hanzi === 'string' && enriched.hanzi.trim() ? enriched.hanzi.trim() : hanzi,
					pinyin,
					createdAt: Date.now()
				};
				pendingWord = wordToSave;
				setPreview(`Pinyin: ${wordToSave.pinyin}`);
			}
			await addWord(wordToSave.hanzi, wordToSave.pinyin);
			dictInput.value = '';
			clearPendingWord();
			setStatus('Parola salvata nel dizionario.', 'success-message');
			await loadDict();
		} catch (error) {
			if (error && error.message === 'Duplicato') {
				setStatus('Questa parola esiste già!', 'error-message');
			} else {
				setStatus('Non riesco a trovare il pinyin. Controlla API key o connessione.', 'error-message');
				console.error(error);
			}
		} finally {
			dictAddBtn.disabled = false;
			dictAddBtn.textContent = originalLabel;
		}
	};

	dictExportBtn.onclick = async () => {
		const words = await getAllWords();
		const exportWords = words.map(normalizeStoredWord);
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
			words = words.map(word => normalizeStoredWord({
				hanzi: word.hanzi || word.word || '',
				pinyin: word.pinyin || '',
				createdAt: typeof word.createdAt === 'number' ? word.createdAt : Date.now()
			})).filter(word => word.hanzi);

			await importWords(words);
			loadDict();
		} catch {
			alert('File non valido');
		}

		dictImportFile.value = '';
	};

	dictClearBtn.onclick = async () => {
		if (confirm('Vuoi cancellare tutti i caratteri dal dizionario?')) {
			await clearDatabase();
			loadDict();
		}
	};

	loadDict();

	return { loadDict };
}
