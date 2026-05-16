// Nessun import AI: tutto locale
import { getAllWords, getAllTemporaryWords, moveTemporaryWordToBase, deleteTemporaryWordById, loadLastGenerated, saveLastGenerated, getAllGeneratedHistory, getGeneratedById, setCurrentGeneratedId, deleteGeneratedById } from './storage.js';
	// === HISTORY UI ===
	const studyHistoryBar = document.querySelector('.study-history-bar');
	const studyHistorySelect = document.getElementById('study-history-select');
	const studyHistoryDelete = document.getElementById('study-history-delete');

	let historyList = [];
	let isLoadingHistory = false;

	async function loadHistoryUI() {
		isLoadingHistory = true;
		historyList = await getAllGeneratedHistory();
		const currentId = localStorage.getItem('currentGeneratedId');
		studyHistorySelect.innerHTML = '';
		if (!Array.isArray(historyList) || historyList.length === 0) {
			studyHistorySelect.innerHTML = '<option value="">(Nessuno)</option>';
			studyHistorySelect.disabled = true;
			studyHistoryDelete.disabled = true;
			isLoadingHistory = false;
			return;
		}
		studyHistorySelect.disabled = false;
		studyHistoryDelete.disabled = false;
		for (const item of historyList) {
			const label = (item.title ? item.title + ' ' : '') + (item.createdAt ? new Date(item.createdAt).toLocaleString() : '');
			const opt = document.createElement('option');
			opt.value = item.id;
			opt.textContent = label.trim() || item.id;
			if (item.id === currentId) opt.selected = true;
			studyHistorySelect.appendChild(opt);
		}
		isLoadingHistory = false;
	}

	async function handleHistorySelectChange() {
		if (isLoadingHistory) return;
		const id = studyHistorySelect.value;
		if (!id) return;
		const content = await getGeneratedById(id);
		if (content) {
			setCurrentGeneratedId(id);
			await renderStudy();
		}
	}

	async function handleHistoryDelete() {
		const id = studyHistorySelect.value;
		if (!id) return;
		if (!confirm('Eliminare questo testo dallo storico?')) return;
		await deleteGeneratedById(id);
		// Se era il corrente, resetta
		const currentId = localStorage.getItem('currentGeneratedId');
		if (currentId === id) {
			localStorage.removeItem('currentGeneratedId');
		}
		await loadHistoryUI();
		await renderStudy();
	}
	// === TEMPORARY DICTIONARY UI ===
	const tempDictionaryCard = document.getElementById('temp-dictionary-card');
	const tempWordCounter = document.getElementById('temp-word-counter');
	const tempWordPrev = document.getElementById('temp-word-prev');
	const tempWordNext = document.getElementById('temp-word-next');
	const tempWordHanzi = document.getElementById('temp-word-hanzi');
	const tempWordPinyin = document.getElementById('temp-word-pinyin');
	const tempWordSave = document.getElementById('temp-word-save');
	const tempWordDelete = document.getElementById('temp-word-delete');

	let tempWords = [];
	let tempWordIndex = 0;

	async function loadTemporaryWordsUI() {
		tempWords = await getAllTemporaryWords();
		if (!Array.isArray(tempWords) || tempWords.length === 0) {
			tempDictionaryCard?.classList.add('hidden');
			return;
		}
		tempDictionaryCard?.classList.remove('hidden');
		if (tempWordIndex >= tempWords.length) tempWordIndex = 0;
		renderTemporaryWordCard();
	}

		async function handlePinyinClick() {
			const content = loadCurrentContent();
			syncContentIdentity(content);

			if (!content || !isValidGeneratedContent(content)) {
				await renderStudy();
				return;
			}

			if (pinyinVisible) {
				pinyinVisible = false;
				stopSpeech();
				await renderStudy();
				return;
			}

			// Mostra pinyin: usa tokens già salvati, se mancano integra solo con dizionario locale
			let needsUpdate = false;
			for (const block of content.blocks) {
				if (!Array.isArray(block.tokens) || block.tokens.length === 0) {
					needsUpdate = true;
					break;
				}
			}
			if (needsUpdate) {
				try {
					const combined = await loadCombinedDictionary();
					const updatedContent = {
						...content,
						pinyinGenerated: true,
						blocks: content.blocks.map(block => ({
							...block,
							tokens: Array.isArray(block.tokens) && block.tokens.length
								? block.tokens
								: tokenizeChineseWithDictionary(block.chinese, combined)
						}))
					};
					currentContent = updatedContent;
					saveLastGenerated(updatedContent);
				} catch (error) {
					console.error(error);
				}
			}
			pinyinVisible = true;
			await renderStudy();
		const word = tempWords[tempWordIndex];
		if (!word) return;
		await deleteTemporaryWordById(word.id);
		await loadTemporaryWordsUI();
		await renderStudy();
	}

	if (tempWordPrev) tempWordPrev.onclick = showPreviousTemporaryWord;
	if (tempWordNext) tempWordNext.onclick = showNextTemporaryWord;
	if (tempWordSave) tempWordSave.onclick = saveCurrentTemporaryWord;
	if (tempWordDelete) tempWordDelete.onclick = deleteCurrentTemporaryWord;
import { escapeHTML, isValidGeneratedContent, normalizeGeneratedContent } from './utils.js';

export function initStudy() {
		// Storico generazioni
		if (studyHistorySelect) studyHistorySelect.onchange = handleHistorySelectChange;
		if (studyHistoryDelete) studyHistoryDelete.onclick = handleHistoryDelete;
	const studyChinese = document.getElementById('study-chinese');
	const studyTranslation = document.getElementById('study-translation');
	const studyExplanation = document.getElementById('study-explanation');
	const studyShowPinyin = document.getElementById('study-show-pinyin');
	const studyShowTranslation = document.getElementById('study-show-translation');
	const studyExplain = document.getElementById('study-explain');
	const studySpeak = document.getElementById('study-speak');
	const studyStopSpeech = document.getElementById('study-stop-speech');
	const studyStatus = document.getElementById('study-status');

	let pinyinVisible = false;
	let translationVisible = false;
	let explanationVisible = false;
	let translationState = 'idle';
	let explanationState = 'idle';
	let currentContent = null;
	let currentContentId = null;
	let pinyinRequestToken = 0;
	let translationRequestToken = 0;
	let explanationRequestToken = 0;
	let baseWords = [];
	let baseHanziSet = new Set();
	let baseWordsPromise = null;

	   // setMessageState and setStudyStatus are now imported from study-ui.js

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

	function stopSpeech() {
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			return;
		}

		window.speechSynthesis.cancel();
	}

	function loadCurrentContent() {
		currentContent = normalizeGeneratedContent(loadLastGenerated());
		return currentContent;
	}

	function syncContentIdentity(content) {
		const nextContentId = content && typeof content.id === 'string' ? content.id : null;
		if (nextContentId !== currentContentId) {
			currentContentId = nextContentId;
			pinyinVisible = false;
			translationVisible = false;
			explanationVisible = false;
			translationState = 'idle';
			explanationState = 'idle';
			stopSpeech();
		}
	}

	async function loadBaseWords(forceRefresh = false) {
		if (baseWordsPromise) {
			return baseWordsPromise;
		}

		if (!forceRefresh && baseWords.length > 0) {
			return baseWords;
		}

		baseWordsPromise = getAllWords()
			.then(words => {
				baseWords = Array.isArray(words)
					? words
						.map(word => ({
							hanzi: typeof word?.hanzi === 'string' ? word.hanzi.trim() : '',
							pinyin: typeof word?.pinyin === 'string' ? word.pinyin.trim() : ''
						}))
						.filter(word => !!word.hanzi)
					: [];
				baseHanziSet = new Set(baseWords.map(word => word.hanzi));
				return baseWords;
			})
			.catch(error => {
				console.error(error);
				baseWords = [];
				baseHanziSet = new Set();
				return baseWords;
			})
			.finally(() => {
				baseWordsPromise = null;
			});

		return baseWordsPromise;
	}

	function containsHanzi(value) {
		return /[\u3400-\u9FFF]/.test(String(value || ''));
	}

	function fallbackTokens(chinese) {
		return Array.from(typeof chinese === 'string' ? chinese : '').map(char => ({
			hanzi: char,
			pinyin: ''
		}));
	}

	function normalizeTokensForRender(block) {
		const tokens = Array.isArray(block?.tokens) && block.tokens.length
			? block.tokens
			: fallbackTokens(block?.chinese || '');

		return tokens.map(token => ({
			hanzi: typeof token?.hanzi === 'string' ? token.hanzi : '',
			pinyin: typeof token?.pinyin === 'string' ? token.pinyin : ''
		}));
	}

	// loadCombinedDictionary and tokenizeChineseWithDictionary are now imported from study-dictionary.js

	function getTokenClass(token) {
		const hanzi = typeof token?.hanzi === 'string' ? token.hanzi.trim() : '';
		if (!hanzi || !containsHanzi(hanzi)) {
			return '';
		}

		return baseHanziSet.has(hanzi) ? 'known-token' : 'new-token';
	}

	   // UI rendering is now handled by study-ui.js

	function hasMissingChinesePinyin(content) {
		if (!content || !Array.isArray(content.blocks)) return false;
		for (const block of content.blocks) {
			if (!Array.isArray(block.tokens) || block.tokens.length === 0) return true;
			for (const token of block.tokens) {
				const hanzi = token.hanzi || '';
				if (/^[\u3400-\u9FFF]+$/.test(hanzi) && (!token.pinyin || !token.pinyin.trim())) {
					return true;
				}
			}
		}
		return false;
	}

	async function ensurePinyinGenerated(content) {
		if (!content || !isValidGeneratedContent(content)) {
			return content;
		}
		// Se pinyinGenerated true ma ci sono token cinesi senza pinyin, aggiorna comunque
		const needsUpdate = !content.pinyinGenerated || hasMissingChinesePinyin(content);
		if (!needsUpdate) return content;
		const requestId = ++pinyinRequestToken;
		const combined = await loadCombinedDictionary();
		if (requestId !== pinyinRequestToken) {
			return content;
		}
		const updatedContent = {
			...content,
			pinyinGenerated: true,
			blocks: content.blocks.map(block => ({
				...block,
				tokens: tokenizeChineseWithDictionary(block.chinese, combined)
			}))
		};
		currentContent = updatedContent;
		saveLastGenerated(updatedContent);
		return updatedContent;
	}

	   // Speech helpers are now handled by study-speech.js

	function handleStopSpeechClick() {
		stopSpeech();
		setStudyStatus('');
	}

	async function handlePinyinClick() {
		const content = loadCurrentContent();
		syncContentIdentity(content);

		if (!content || !isValidGeneratedContent(content)) {
			await renderStudy();
			return;
		}

		if (pinyinVisible) {
			pinyinVisible = false;
			stopSpeech();
			await renderStudy();
			return;
		}

		// Mostra pinyin: usa base + temporaneo, aggiorna tokens sempre
		try {
			const combined = await loadCombinedDictionary();
			const updatedContent = {
				...content,
				pinyinGenerated: true,
				blocks: content.blocks.map(block => ({
					...block,
					tokens: tokenizeChineseWithDictionary(block.chinese, combined)
				}))
			};
			currentContent = updatedContent;
			saveLastGenerated(updatedContent);
		} catch (error) {
			console.error(error);
		}
		pinyinVisible = true;
		await renderStudy();
	}

	async function handleTranslationClick() {
		const content = loadCurrentContent();
		syncContentIdentity(content);

		if (!content || !isValidGeneratedContent(content)) {
			await renderStudy();
			return;
		}

		if (translationVisible) {
			translationVisible = false;
			stopSpeech();
			await renderStudy();
			return;
		}

		explanationVisible = false;
		stopSpeech();

		translationVisible = true;
		translationState = 'ready';
		await renderStudy();
	}

	async function handleExplainClick() {
		const content = loadCurrentContent();
		syncContentIdentity(content);

		if (!content || !isValidGeneratedContent(content)) {
			await renderStudy();
			return;
		}

		if (explanationVisible) {
			explanationVisible = false;
			stopSpeech();
			await renderStudy();
			return;
		}

		translationVisible = false;
		stopSpeech();

		explanationVisible = true;
		explanationState = 'ready';
		await renderStudy();
	}

	   async function renderStudy() {
		   await loadHistoryUI();
		   stopSpeech();
		   const content = loadCurrentContent();
		   syncContentIdentity(content);
		   await loadBaseWords(true);

		   if (!content) {
			   showEmptyState(studyChinese, studyTranslation, studyExplanation, setMessageState, (msg, state) => setStudyStatus(studyStatus, msg, state));
			   studyShowPinyin.textContent = 'Mostra pinyin';
			   await loadTemporaryWordsUI();
			   return;
		   }
		   if (!isValidGeneratedContent(content)) {
			   showInvalidState(studyChinese, studyTranslation, studyExplanation, setMessageState, (msg, state) => setStudyStatus(studyStatus, msg, state));
			   studyShowPinyin.textContent = 'Mostra pinyin';
			   await loadTemporaryWordsUI();
			   return;
		   }

		   studyChinese.classList.remove('study-placeholder');
		   setMessageState(studyChinese, null);
		   studyChinese.innerHTML = renderChineseContent(content, pinyinVisible, getTokenClass, normalizeTokensForRender);

		   if (translationVisible) {
			   studyTranslation.classList.remove('hidden');
			   if (translationState === 'loading') {
				   studyTranslation.textContent = 'Genero traduzione...';
				   setMessageState(studyTranslation, 'loading');
			   } else if (translationState === 'error') {
				   setMessageState(studyTranslation, 'error-message');
			   } else if (content.translationGenerated || translationState === 'ready') {
				   studyTranslation.innerHTML = renderTranslationContent(content);
				   setMessageState(studyTranslation, null);
			   } else {
				   studyTranslation.textContent = '';
				   setMessageState(studyTranslation, null);
			   }
		   } else {
			   studyTranslation.classList.add('hidden');
		   }

		   if (explanationVisible) {
			   studyExplanation.classList.remove('hidden');
			   if (explanationState === 'loading') {
				   studyExplanation.textContent = 'Genero spiegazione...';
				   setMessageState(studyExplanation, 'loading');
			   } else if (explanationState === 'error') {
				   setMessageState(studyExplanation, 'error-message');
			   } else if (content.explanationGenerated || explanationState === 'ready') {
				   studyExplanation.innerHTML = renderExplanationContent(content);
				   setMessageState(studyExplanation, null);
			   } else {
				   studyExplanation.textContent = '';
				   setMessageState(studyExplanation, null);
			   }
		   } else {
			   studyExplanation.classList.add('hidden');
		   }

		   studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
		   await loadTemporaryWordsUI();
	   }

	window.addEventListener('beforeunload', stopSpeech);

	studyShowPinyin.onclick = handlePinyinClick;
	studyShowTranslation.onclick = handleTranslationClick;
	studyExplain.onclick = handleExplainClick;
	   if (studySpeak) {
		   studySpeak.onclick = () => speakChineseText(loadCurrentContent(), (msg, state) => setStudyStatus(studyStatus, msg, state));
	   }
	if (studyStopSpeech) {
		studyStopSpeech.onclick = handleStopSpeechClick;
	}

	void loadBaseWords(true);
	void renderStudy();

	return { renderStudy };
}
