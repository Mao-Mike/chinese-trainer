import { enrichWordWithAI } from './ai.js';
import { addWord, clearDatabase, deleteWordById, getAllWords, importWords } from './storage.js';
import { hasGeminiApiKey, isQuotaError } from './utils.js';

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
		setPreview('pinyin');
	}

	function isCurrentWord(word, hanzi) {
		return !!word && word.hanzi === hanzi;
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
			delBtn.textContent = '×';
			delBtn.setAttribute('aria-label', 'Elimina');
			delBtn.title = 'Elimina';
			delBtn.onclick = async () => {
				delBtn.blur();
				const ok = await window.showConfirm(`Vuoi eliminare la parola "${word.hanzi}"?`, 'Conferma eliminazione');
				if (ok) {
					await deleteWordById(word.id);
					await loadDict();
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

	let pinyinPromiseMap = {};

	async function findPinyin() {
		const hanzi = dictInput.value.trim();
		if (!hanzi) return null;
		if (!hasGeminiApiKey()) {
			setStatus('Inserisci la Gemini API key nelle Impostazioni.', 'error-message');
			return null;
		}
		// Se già in corso per stesso hanzi, riusa promessa
		if (pinyinPromiseMap[hanzi]) return pinyinPromiseMap[hanzi];
		const requestId = ++lookupToken;
		const originalLabel = dictFindBtn.textContent;
		dictFindBtn.disabled = true;
		dictAddBtn.disabled = true;
		dictFindBtn.textContent = 'Cerco...';
		setStatus('Cerco pinyin...', 'loading');
		const promise = (async () => {
			try {
				const enriched = await enrichWordWithAI(hanzi);
				if (requestId !== lookupToken) return;
				const pinyin = typeof enriched.pinyin === 'string' ? enriched.pinyin.trim() : '';
				if (!pinyin) throw new Error('empty_pinyin');
				pendingWord = {
					hanzi: typeof enriched.hanzi === 'string' && enriched.hanzi.trim() ? enriched.hanzi.trim() : hanzi,
					pinyin,
					createdAt: Date.now()
				};
				setPreview(pendingWord.pinyin);
				setStatus('');
				return pendingWord;
			} catch (error) {
				if (requestId !== lookupToken) return null;
				pendingWord = null;
				setPreview('pinyin');
				if (isQuotaError(error)) {
					setStatus('Limite gratuito AI raggiunto. Riprova più tardi.', 'error-message');
				} else {
					setStatus('Non riesco a trovare il pinyin. Controlla API key o connessione.', 'error-message');
				}
				console.error(error);
				return null;
			} finally {
				dictFindBtn.disabled = false;
				dictAddBtn.disabled = false;
				dictFindBtn.textContent = originalLabel;
				// Rimuovi promessa solo se è ancora la stessa richiesta
				if (pinyinPromiseMap[hanzi] && requestId === lookupToken) {
					delete pinyinPromiseMap[hanzi];
				}
			}
		})();
		pinyinPromiseMap[hanzi] = promise;
		return promise;
	}

	dictInput.addEventListener('input', () => {
		clearPendingWord();
		setStatus('');
	});

	dictSearchInput.addEventListener('input', filterAndRenderDict);

	// Pulsante per svuotare la ricerca
	let dictSearchClear = document.getElementById('dict-search-clear');
	if (!dictSearchClear) {
		dictSearchClear = document.createElement('button');
		dictSearchClear.id = 'dict-search-clear';
		dictSearchClear.type = 'button';
		dictSearchClear.className = 'dict-search-clear';
		dictSearchClear.textContent = '×';
		dictSearchClear.title = 'Svuota ricerca';
		dictSearchInput.parentNode.insertBefore(dictSearchClear, dictSearchInput.nextSibling);
	}
	dictSearchClear.onclick = () => {
		dictSearchInput.value = '';
		filterAndRenderDict();
		dictSearchInput.focus();
	};

	dictFindBtn.onclick = async () => {
		const hanzi = dictInput.value.trim();
		if (!hanzi) return;
		if (!hasGeminiApiKey()) {
			setStatus('Inserisci la Gemini API key nelle Impostazioni.', 'error-message');
			return;
		}
		await findPinyin();
	};

	dictAddBtn.onclick = async () => {
		const hanzi = dictInput.value.trim();
		if (!hanzi) return;
		if (!hasGeminiApiKey()) {
			setStatus('Inserisci la Gemini API key nelle Impostazioni.', 'error-message');
			return;
		}
		let wordToSave = isCurrentWord(pendingWord, hanzi) ? pendingWord : null;
		dictAddBtn.disabled = true;
		dictFindBtn.disabled = true;
		const originalLabel = dictAddBtn.textContent;
		dictAddBtn.textContent = 'Salvo...';
		try {
			if (!wordToSave) wordToSave = await findPinyin();
			if (!isCurrentWord(wordToSave, hanzi)) return;
			await addWord(wordToSave.hanzi, wordToSave.pinyin);
			dictInput.value = '';
			clearPendingWord();
			setStatus('');
			await loadDict();
		} catch (error) {
			if (error && error.message === 'Duplicato') {
				setStatus('Questa parola esiste già!', 'error-message');
			} else if (isQuotaError(error)) {
				setStatus('Limite gratuito AI raggiunto. Riprova più tardi.', 'error-message');
			} else {
				console.error(error);
				setStatus('Errore durante il salvataggio della parola.', 'error-message');
			}
		} finally {
			dictAddBtn.disabled = false;
			dictFindBtn.disabled = false;
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
			await loadDict();
		} catch {
			await window.showAlert('File non valido', 'Errore');
		}

		dictImportFile.value = '';
	};

	dictClearBtn.onclick = async () => {
		const ok = await window.showConfirm('Vuoi cancellare tutti i caratteri dal dizionario?', 'Conferma cancellazione');
		if (ok) {
			await clearDatabase();
			await loadDict();
		}
	};

	loadDict();

	window.addEventListener('dictionary-updated', loadDict);

	return { loadDict };
}

