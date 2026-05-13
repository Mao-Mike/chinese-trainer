import { addWord, clearDatabase, deleteWordById, getAllWords, importWords } from './storage.js';
import { fakePinyin, fakeTranslation } from './utils.js';

export function initDictionary() {
	const dictInput = document.getElementById('dict-input');
	const dictAddBtn = document.getElementById('dict-add');
	const dictList = document.getElementById('dict-list');
	const dictExportBtn = document.getElementById('dict-export');
	const dictImportBtn = document.getElementById('dict-import');
	const dictImportFile = document.getElementById('dict-import-file');
	const dictClearBtn = document.getElementById('dict-clear');

	let dictSearchInput = document.getElementById('dict-search-input');
	if (!dictSearchInput) {
		dictSearchInput = document.createElement('input');
		dictSearchInput.type = 'text';
		dictSearchInput.id = 'dict-search-input';
		dictSearchInput.placeholder = 'Cerca hanzi, pinyin o traduzione';
		dictSearchInput.style.marginBottom = '0.7rem';
		dictInput.parentNode.parentNode.insertBefore(dictSearchInput, dictInput.parentNode.nextSibling);
	}

	let allWordsCache = [];

	function renderDictList(words) {
		dictList.innerHTML = '';

		words.forEach(word => {
			const li = document.createElement('li');
			const wordDiv = document.createElement('div');
			wordDiv.className = 'dict-word';
			wordDiv.innerHTML = `<span>${word.hanzi}</span><span class="dict-pinyin">${word.pinyin}</span><span class="dict-translation">${word.translation}</span>`;

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
				(word.hanzi && word.hanzi.includes(q)) ||
				(word.pinyin && word.pinyin.toLowerCase().includes(q)) ||
				(word.translation && word.translation.toLowerCase().includes(q))
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
		const exportWords = words.map(({ id, ...rest }) => rest);
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
			words = words.map(word => ({
				hanzi: word.hanzi || word.word || '',
				pinyin: word.pinyin || '',
				translation: word.translation || '',
				createdAt: word.createdAt || Date.now()
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
