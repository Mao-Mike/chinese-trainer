// js/study.js

import {
	getAllWords,
	getAllTemporaryWords,
	moveTemporaryWordToBase,
	deleteTemporaryWordById,
	loadLastGenerated,
	saveLastGenerated,
	getAllGeneratedHistory,
	getGeneratedById,
	setCurrentGeneratedId,
	deleteGeneratedById
} from './storage.js';

import {
	isValidGeneratedContent,
	normalizeGeneratedContent
} from './utils.js';

import {
	loadCombinedDictionary,
	tokenizeChineseWithDictionary
} from './study-dictionary.js';

import {
	setMessageState,
	setStudyStatus,
	showEmptyState,
	showInvalidState,
	renderChineseContent,
	renderTranslationContent,
	renderExplanationContent
} from './study-ui.js';

export function initStudy() {
	const studyChinese = document.getElementById('study-chinese');
	const studyTranslation = document.getElementById('study-translation');
	const studyExplanation = document.getElementById('study-explanation');
	const studyShowPinyin = document.getElementById('study-show-pinyin');
	const studyShowTranslation = document.getElementById('study-show-translation');
	const studyExplain = document.getElementById('study-explain');
	const studySpeak = document.getElementById('study-speak');
	const studyStopSpeech = document.getElementById('study-stop-speech');
	const studyStatus = document.getElementById('study-status');

	const studyHistorySelect = document.getElementById('study-history-select');
	const studyHistoryDelete = document.getElementById('study-history-delete');

	const tempDictionaryCard = document.getElementById('temp-dictionary-card');
	const tempWordCounter = document.getElementById('temp-word-counter');
	const tempWordPrev = document.getElementById('temp-word-prev');
	const tempWordNext = document.getElementById('temp-word-next');
	const tempWordHanzi = document.getElementById('temp-word-hanzi');
	const tempWordPinyin = document.getElementById('temp-word-pinyin');
	const tempWordSave = document.getElementById('temp-word-save');
	const tempWordDelete = document.getElementById('temp-word-delete');

	let pinyinVisible = false;
	let translationVisible = false;
	let explanationVisible = false;

	let translationState = 'idle';
	let explanationState = 'idle';

	let currentContent = null;
	let currentContentId = null;

	let baseWords = [];
	let baseHanziSet = new Set();
	let baseWordsPromise = null;

	let historyList = [];
	let isLoadingHistory = false;

	let tempWords = [];
	let tempWordIndex = 0;

	let voicesLoaded = false;
	let voices = [];
	let speechUtterance = null;

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

	function getTokenClass(token) {
		const hanzi = typeof token?.hanzi === 'string' ? token.hanzi.trim() : '';

		if (!hanzi || !containsHanzi(hanzi)) {
			return '';
		}

		return baseHanziSet.has(hanzi) ? 'known-token' : 'new-token';
	}

	function loadCurrentContent() {
		currentContent = normalizeGeneratedContent(loadLastGenerated());
		return currentContent;
	}

	function syncContentIdentity(content) {
		const nextContentId = content && typeof content.id === 'string'
			? content.id
			: null;

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

	async function loadHistoryUI() {
		if (!studyHistorySelect || !studyHistoryDelete) return;

		isLoadingHistory = true;

		try {
			historyList = await getAllGeneratedHistory();
			const currentId = localStorage.getItem('currentGeneratedId');

			studyHistorySelect.innerHTML = '';

			if (!Array.isArray(historyList) || historyList.length === 0) {
				const option = document.createElement('option');
				option.value = '';
				option.textContent = '(Nessuno)';
				studyHistorySelect.appendChild(option);

				studyHistorySelect.disabled = true;
				studyHistoryDelete.disabled = true;
				return;
			}

			studyHistorySelect.disabled = false;
			studyHistoryDelete.disabled = false;

			for (const item of historyList) {
				const option = document.createElement('option');
				option.value = item.id;

				const date = item.createdAt
					? new Date(item.createdAt).toLocaleString()
					: '';

				option.textContent = `${item.title || 'Testo'} ${date}`.trim();

				if (item.id === currentId) {
					option.selected = true;
				}

				studyHistorySelect.appendChild(option);
			}
		} catch (error) {
			console.error(error);
		} finally {
			isLoadingHistory = false;
		}
	}

	async function handleHistorySelectChange() {
		if (isLoadingHistory || !studyHistorySelect) return;

		const id = studyHistorySelect.value;
		if (!id) return;

		const content = await getGeneratedById(id);

		if (content) {
			setCurrentGeneratedId(id);
			await saveLastGenerated(content);
			await renderStudy();
		}
	}

	async function handleHistoryDelete() {
		if (!studyHistorySelect) return;

		const id = studyHistorySelect.value;
		if (!id) return;

		const ok = await window.showConfirm(
			'Eliminare questo testo dallo storico?',
			'Conferma eliminazione'
		);

		if (!ok) return;

		await deleteGeneratedById(id);

		const currentId = localStorage.getItem('currentGeneratedId');
		if (currentId === id) {
			localStorage.removeItem('currentGeneratedId');
			localStorage.removeItem('lastGenerated');
		}

		await loadHistoryUI();
		await renderStudy();
	}

	function renderTemporaryWordCard() {
		if (!tempDictionaryCard) return;

		if (!Array.isArray(tempWords) || tempWords.length === 0) {
			tempDictionaryCard.classList.add('hidden');

			if (tempWordCounter) tempWordCounter.textContent = '';
			if (tempWordHanzi) tempWordHanzi.textContent = '';
			if (tempWordPinyin) tempWordPinyin.textContent = '';

			return;
		}

		if (tempWordIndex < 0) {
			tempWordIndex = 0;
		}

		if (tempWordIndex >= tempWords.length) {
			tempWordIndex = tempWords.length - 1;
		}

		const word = tempWords[tempWordIndex];

		tempDictionaryCard.classList.remove('hidden');

		if (tempWordCounter) {
			tempWordCounter.textContent = `${tempWordIndex + 1} / ${tempWords.length}`;
		}

		if (tempWordHanzi) {
			tempWordHanzi.textContent = word?.hanzi || '';
		}

		if (tempWordPinyin) {
			tempWordPinyin.textContent = word?.pinyin || '';
		}

		const multipleWords = tempWords.length > 1;

		if (tempWordPrev) {
			tempWordPrev.disabled = !multipleWords;
		}

		if (tempWordNext) {
			tempWordNext.disabled = !multipleWords;
		}
	}

	async function loadTemporaryWordsUI() {
		try {
			tempWords = await getAllTemporaryWords();

			if (!Array.isArray(tempWords)) {
				tempWords = [];
			}

			if (tempWordIndex >= tempWords.length) {
				tempWordIndex = 0;
			}

			renderTemporaryWordCard();
		} catch (error) {
			console.error(error);
			tempWords = [];
			renderTemporaryWordCard();
		}
	}

	function showPreviousTemporaryWord() {
		if (!Array.isArray(tempWords) || tempWords.length === 0) return;

		tempWordIndex = tempWordIndex <= 0
			? tempWords.length - 1
			: tempWordIndex - 1;

		renderTemporaryWordCard();
	}

	function showNextTemporaryWord() {
		if (!Array.isArray(tempWords) || tempWords.length === 0) return;

		tempWordIndex = tempWordIndex >= tempWords.length - 1
			? 0
			: tempWordIndex + 1;

		renderTemporaryWordCard();
	}

	async function saveCurrentTemporaryWord() {
		const word = tempWords[tempWordIndex];
		if (!word) return;

		try {
			await moveTemporaryWordToBase(word.id);
			await loadBaseWords(true);
			await loadTemporaryWordsUI();
			await renderStudy();

			window.dispatchEvent(new Event('dictionary-updated'));
		} catch (error) {
			console.error(error);
			setStudyStatus(
				studyStatus,
				'Errore durante il salvataggio della parola.',
				'error-message'
			);
		}
	}

	async function deleteCurrentTemporaryWord() {
		const word = tempWords[tempWordIndex];
		if (!word) return;

		try {
			await deleteTemporaryWordById(word.id);
			await loadTemporaryWordsUI();
			await renderStudy();
		} catch (error) {
			console.error(error);
			setStudyStatus(
				studyStatus,
				'Errore durante la cancellazione della parola.',
				'error-message'
			);
		}
	}

	function hasUsefulPinyinTokens(block) {
		const tokens = Array.isArray(block?.tokens) ? block.tokens : [];

		if (!tokens.length) return false;

		return tokens.some(token => {
			const hanzi = typeof token?.hanzi === 'string' ? token.hanzi.trim() : '';
			const pinyin = typeof token?.pinyin === 'string' ? token.pinyin.trim() : '';

			return containsHanzi(hanzi) && !!pinyin;
		});
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

		try {
			const combined = await loadCombinedDictionary();

			const updatedContent = {
				...content,
				pinyinGenerated: true,
				blocks: content.blocks.map(block => ({
					...block,
					tokens: hasUsefulPinyinTokens(block)
						? block.tokens
						: tokenizeChineseWithDictionary(block.chinese, combined)
				}))
			};

			currentContent = updatedContent;
			await saveLastGenerated(updatedContent);
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
		translationVisible = true;
		translationState = 'ready';

		stopSpeech();
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
		explanationVisible = true;
		explanationState = 'ready';

		stopSpeech();
		await renderStudy();
	}

	function loadVoicesAsync() {
		return new Promise(resolve => {
			if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
				resolve([]);
				return;
			}

			const synth = window.speechSynthesis;
			let list = synth.getVoices();

			if (Array.isArray(list) && list.length > 0) {
				resolve(list);
				return;
			}

			synth.onvoiceschanged = () => {
				list = synth.getVoices();
				resolve(list);
			};

			setTimeout(() => {
				resolve(synth.getVoices());
			}, 1200);
		});
	}

	function pickChineseVoice(voiceList) {
		if (!Array.isArray(voiceList)) return null;

		return voiceList.find(voice => voice.lang === 'zh-CN')
			|| voiceList.find(voice => typeof voice.lang === 'string' && voice.lang.startsWith('zh'))
			|| voiceList.find(voice => /chinese|mandarin/i.test(voice.name || ''))
			|| null;
	}

	function stopSpeech() {
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

		window.speechSynthesis.cancel();
		speechUtterance = null;

		if (studySpeak) {
			studySpeak.disabled = false;
			studySpeak.textContent = 'Ascolta';
		}
	}

	async function speakChineseText(content) {
		stopSpeech();

		if (!content || !Array.isArray(content.blocks) || !content.blocks.length) {
			setStudyStatus(studyStatus, 'Nessun testo da leggere.', 'error-message');
			return;
		}

		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			setStudyStatus(studyStatus, 'Lettura audio non disponibile su questo dispositivo.', 'error-message');
			return;
		}

		const text = content.blocks
			.map(block => typeof block.chinese === 'string' ? block.chinese.trim() : '')
			.filter(Boolean)
			.join('。');

		if (!text) {
			setStudyStatus(studyStatus, 'Nessun testo da leggere.', 'error-message');
			return;
		}

		if (studySpeak) {
			studySpeak.disabled = true;
			studySpeak.textContent = 'In ascolto...';
		}

		setStudyStatus(studyStatus, '');

		try {
			if (!voicesLoaded) {
				voices = await loadVoicesAsync();
				voicesLoaded = true;
			}

			const voice = pickChineseVoice(voices);

			speechUtterance = new window.SpeechSynthesisUtterance(text);
			speechUtterance.lang = voice?.lang || 'zh-CN';
			speechUtterance.rate = 0.9;
			speechUtterance.pitch = 1;

			if (voice) {
				speechUtterance.voice = voice;
			}

			speechUtterance.onend = () => {
				if (studySpeak) {
					studySpeak.disabled = false;
					studySpeak.textContent = 'Ascolta';
				}

				setStudyStatus(studyStatus, '');
			};

			speechUtterance.onerror = () => {
				if (studySpeak) {
					studySpeak.disabled = false;
					studySpeak.textContent = 'Ascolta';
				}

				setStudyStatus(
					studyStatus,
					'Lettura audio non disponibile su questo dispositivo.',
					'error-message'
				);
			};

			window.speechSynthesis.speak(speechUtterance);
		} catch (error) {
			console.error(error);
			stopSpeech();

			setStudyStatus(
				studyStatus,
				'Lettura audio non disponibile su questo dispositivo.',
				'error-message'
			);
		}
	}

	function handleStopSpeechClick() {
		stopSpeech();
		setStudyStatus(studyStatus, '');
	}

	async function renderStudy() {
		await loadHistoryUI();

		const content = loadCurrentContent();
		syncContentIdentity(content);

		await loadBaseWords(true);

		if (!content) {
			showEmptyState(
				studyChinese,
				studyTranslation,
				studyExplanation,
				setMessageState,
				(message, state) => setStudyStatus(studyStatus, message, state)
			);

			if (studyShowPinyin) {
				studyShowPinyin.textContent = 'Mostra pinyin';
			}

			await loadTemporaryWordsUI();
			return;
		}

		if (!isValidGeneratedContent(content)) {
			showInvalidState(
				studyChinese,
				studyTranslation,
				studyExplanation,
				setMessageState,
				(message, state) => setStudyStatus(studyStatus, message, state)
			);

			if (studyShowPinyin) {
				studyShowPinyin.textContent = 'Mostra pinyin';
			}

			await loadTemporaryWordsUI();
			return;
		}

		studyChinese.classList.remove('study-placeholder');
		setMessageState(studyChinese, null);

		studyChinese.innerHTML = renderChineseContent(
			content,
			pinyinVisible,
			getTokenClass,
			normalizeTokensForRender
		);

		if (translationVisible) {
			studyTranslation.classList.remove('hidden');

			if (translationState === 'ready' || content.translationGenerated) {
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

			if (explanationState === 'ready' || content.explanationGenerated) {
				studyExplanation.innerHTML = renderExplanationContent(content);
				setMessageState(studyExplanation, null);
			} else {
				studyExplanation.textContent = '';
				setMessageState(studyExplanation, null);
			}
		} else {
			studyExplanation.classList.add('hidden');
		}

		if (studyShowPinyin) {
			studyShowPinyin.textContent = pinyinVisible
				? 'Nascondi pinyin'
				: 'Mostra pinyin';
		}

		await loadTemporaryWordsUI();
	}

	if (studyHistorySelect) {
		studyHistorySelect.onchange = handleHistorySelectChange;
	}

	if (studyHistoryDelete) {
		studyHistoryDelete.onclick = handleHistoryDelete;
	}

	if (tempWordPrev) {
		tempWordPrev.onclick = showPreviousTemporaryWord;
	}

	if (tempWordNext) {
		tempWordNext.onclick = showNextTemporaryWord;
	}

	if (tempWordSave) {
		tempWordSave.onclick = saveCurrentTemporaryWord;
	}

	if (tempWordDelete) {
		tempWordDelete.onclick = deleteCurrentTemporaryWord;
	}

	if (studyShowPinyin) {
		studyShowPinyin.onclick = handlePinyinClick;
	}

	if (studyShowTranslation) {
		studyShowTranslation.onclick = handleTranslationClick;
	}

	if (studyExplain) {
		studyExplain.onclick = handleExplainClick;
	}

	if (studySpeak) {
		studySpeak.onclick = () => speakChineseText(loadCurrentContent());
	}

	if (studyStopSpeech) {
		studyStopSpeech.onclick = handleStopSpeechClick;
	}

	window.addEventListener('beforeunload', stopSpeech);

	document.querySelectorAll('.tab-btn').forEach(button => {
		button.addEventListener('click', stopSpeech);
	});

	void loadBaseWords(true);
	void renderStudy();

	return {
		renderStudy
	};
}