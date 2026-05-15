import { explainContentWithAI, translateContentWithAI } from './ai.js';
import { getAllWords, getAllTemporaryWords, loadLastGenerated, saveLastGenerated, moveTemporaryWordToBase, deleteTemporaryWordById } from './storage.js';
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

	function renderTemporaryWordCard() {
		if (!Array.isArray(tempWords) || tempWords.length === 0) {
			tempDictionaryCard?.classList.add('hidden');
			return;
		}
		tempDictionaryCard?.classList.remove('hidden');
		const word = tempWords[tempWordIndex] || {};
		tempWordHanzi.textContent = word.hanzi || '';
		tempWordPinyin.textContent = word.pinyin || '';
		tempWordCounter.textContent = `${tempWordIndex + 1} / ${tempWords.length}`;
	}

	function showNextTemporaryWord() {
		if (!tempWords.length) return;
		tempWordIndex = (tempWordIndex + 1) % tempWords.length;
		renderTemporaryWordCard();
	}

	function showPreviousTemporaryWord() {
		if (!tempWords.length) return;
		tempWordIndex = (tempWordIndex - 1 + tempWords.length) % tempWords.length;
		renderTemporaryWordCard();
	}

	async function saveCurrentTemporaryWord() {
		const word = tempWords[tempWordIndex];
		if (!word) return;
		await moveTemporaryWordToBase(word.id);
		await loadTemporaryWordsUI();
		window.dispatchEvent(new CustomEvent('dictionary-updated'));
	}

	async function deleteCurrentTemporaryWord() {
		const word = tempWords[tempWordIndex];
		if (!word) return;
		await deleteTemporaryWordById(word.id);
		await loadTemporaryWordsUI();
	}

	if (tempWordPrev) tempWordPrev.onclick = showPreviousTemporaryWord;
	if (tempWordNext) tempWordNext.onclick = showNextTemporaryWord;
	if (tempWordSave) tempWordSave.onclick = saveCurrentTemporaryWord;
	if (tempWordDelete) tempWordDelete.onclick = deleteCurrentTemporaryWord;
import { escapeHTML, isValidGeneratedContent, normalizeGeneratedContent } from './utils.js';

export function initStudy() {
	const studyChinese = document.getElementById('study-chinese');
	const studyTranslation = document.getElementById('study-translation');
	const studyExplanation = document.getElementById('study-explanation');
	const studyShowPinyin = document.getElementById('study-show-pinyin');
	const studyShowTranslation = document.getElementById('study-show-translation');
	const studyExplain = document.getElementById('study-explain');

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

	function setMessageState(element, state) {
		element.classList.remove('loading', 'error-message', 'success-message');
		if (state) {
			element.classList.add(state);
		}
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
		}
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

	function tokenizeChineseWithDictionary(chinese, dictionaryWords) {
		// Longest match, prefer base, poi temporaneo
		const text = typeof chinese === 'string' ? chinese : '';
		if (!text) return [];
		const words = Array.isArray(dictionaryWords)
			? dictionaryWords
				.filter(word => word && typeof word.hanzi === 'string' && word.hanzi.trim())
				.map(word => ({
					hanzi: word.hanzi.trim(),
					pinyin: typeof word.pinyin === 'string' ? word.pinyin.trim() : ''
				}))
				.sort((a, b) => b.hanzi.length - a.hanzi.length)
			: [];
		const tokens = [];
		let index = 0;
		while (index < text.length) {
			let matchedWord = null;
			for (const word of words) {
				if (text.startsWith(word.hanzi, index)) {
					matchedWord = word;
					break;
				}
			}
			if (matchedWord) {
				tokens.push({ hanzi: matchedWord.hanzi, pinyin: matchedWord.pinyin });
				index += matchedWord.hanzi.length;
				continue;
			}
			tokens.push({ hanzi: text[index], pinyin: '' });
			index += 1;
		}
		return tokens;
	}

	function renderChineseBlock(token, showPinyin) {
		const hanzi = escapeHTML(token.hanzi || '');
		if (!showPinyin) {
			return `<span class="chinese-block"><span class="hanzi">${hanzi}</span></span>`;
		}
		const pinyin = token.pinyin ? escapeHTML(token.pinyin) : '';
		return `<span class="chinese-block">${pinyin ? `<span class="pinyin">${pinyin}</span>` : '<span class="pinyin pinyin-empty">&nbsp;</span>'}<span class="hanzi">${hanzi}</span></span>`;
	}

	function renderStudyLine(block, showPinyin) {
		const tokens = normalizeTokensForRender(block);
		return `<span class="study-line">${tokens.map(token => renderChineseBlock(token, showPinyin)).join('')}</span>`;
	}

	function renderDialogueLine(block, showPinyin) {
		const speaker = escapeHTML(block.speaker || '');
		return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content study-line">${normalizeTokensForRender(block).map(token => renderChineseBlock(token, showPinyin)).join('')}</span></div>`;
	}

	function renderChineseContent(content) {
		return content.blocks
			.map(block => content.type === 'text'
				? `${renderStudyLine(block, pinyinVisible)} <span class="study-ref">${escapeHTML(block.ref)}</span>`
				: `${renderDialogueLine(block, pinyinVisible)} <span class="study-ref">${escapeHTML(block.ref)}</span>`)
			.join('');
	}

	function renderTranslationContent(content) {
		return content.blocks
			.map(block => content.type === 'text'
				? `<div>${escapeHTML(block.translation || '')} <span class="study-ref">${escapeHTML(block.ref)}</span></div>`
				: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.translation || '')}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`)
			.join('');
	}

	function renderExplanationContent(content) {
		return content.blocks
			.map(block => content.type === 'text'
				? `<div>${escapeHTML(block.explanation || '')} <span class="study-ref">${escapeHTML(block.ref)}</span></div>`
				: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.explanation || '')}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`)
			.join('');
	}

	function showEmptyState() {
		studyChinese.textContent = 'Testo';
		studyChinese.classList.add('study-placeholder');
		setMessageState(studyChinese, 'loading');
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
	}

	function showInvalidState() {
		studyChinese.textContent = 'Il contenuto generato non è valido. Genera un nuovo testo.';
		studyChinese.classList.add('study-placeholder');
		setMessageState(studyChinese, 'error-message');
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
	}

	async function ensurePinyinGenerated(content) {
		if (!content || !isValidGeneratedContent(content) || content.pinyinGenerated) {
			return content;
		}

		const requestId = ++pinyinRequestToken;
		const words = await getAllWords();
		if (requestId !== pinyinRequestToken) {
			return content;
		}

		const dictionaryWords = Array.isArray(words)
			? words.map(word => ({
				hanzi: typeof word.hanzi === 'string' ? word.hanzi : '',
				pinyin: typeof word.pinyin === 'string' ? word.pinyin : ''
			}))
			: [];

		const updatedContent = {
			...content,
			pinyinGenerated: true,
			blocks: content.blocks.map(block => ({
				...block,
				tokens: tokenizeChineseWithDictionary(block.chinese, dictionaryWords)
			}))
		};

		currentContent = updatedContent;
		saveLastGenerated(updatedContent);
		return updatedContent;
	}

	async function handlePinyinClick() {
		const content = loadCurrentContent();
		syncContentIdentity(content);
		if (!content || !isValidGeneratedContent(content)) {
			renderStudy();
			return;
		}

		if (pinyinVisible) {
			pinyinVisible = false;
			renderStudy();
			return;
		}

		// Carica base + temporaneo, unisci, preferisci base
		const [baseWords, tempWordsList] = await Promise.all([
			getAllWords(),
			getAllTemporaryWords()
		]);
		const hanziSet = new Set();
		const combined = [];
		for (const w of baseWords) {
			if (w && w.hanzi && !hanziSet.has(w.hanzi)) {
				hanziSet.add(w.hanzi);
				combined.push({ hanzi: w.hanzi, pinyin: w.pinyin });
			}
		}
		for (const w of tempWordsList) {
			if (w && w.hanzi && !hanziSet.has(w.hanzi)) {
				hanziSet.add(w.hanzi);
				combined.push({ hanzi: w.hanzi, pinyin: w.pinyin });
			}
		}
		// Aggiorna tokens per ogni block
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
		pinyinVisible = true;
		renderStudy();
	}

	async function handleTranslationClick() {
		const content = loadCurrentContent();
		syncContentIdentity(content);
		if (!content || !isValidGeneratedContent(content)) {
			renderStudy();
			return;
		}

		if (translationVisible) {
			translationVisible = false;
			renderStudy();
			return;
		}

		explanationVisible = false;

		if (content.translationGenerated) {
			translationVisible = true;
			translationState = 'ready';
			renderStudy();
			return;
		}

		if (!hasGeminiApiKey()) {
			translationVisible = true;
			translationState = 'error';
			studyTranslation.textContent = 'Inserisci la Gemini API key nelle Impostazioni.';
			studyTranslation.classList.remove('hidden');
			setMessageState(studyTranslation, 'error-message');
			studyExplanation.classList.add('hidden');
			return;
		}

		const requestId = ++translationRequestToken;
		studyShowTranslation.disabled = true;
		translationVisible = true;
		translationState = 'loading';
		studyTranslation.textContent = 'Genero traduzione...';
		studyTranslation.classList.remove('hidden');
		setMessageState(studyTranslation, 'loading');
		studyExplanation.classList.add('hidden');

		try {
			const result = await translateContentWithAI(content);
			if (requestId !== translationRequestToken) {
				return;
			}

			const translationMap = new Map(
				(Array.isArray(result?.blocks) ? result.blocks : []).map(block => [block.ref, block.translation])
			);

			const updatedContent = {
				...content,
				translationGenerated: true,
				blocks: content.blocks.map(block => ({
					...block,
					translation: translationMap.get(block.ref) || block.translation || ''
				}))
			};

			currentContent = updatedContent;
			translationState = 'ready';
			saveLastGenerated(updatedContent);
			renderStudy();
		} catch (error) {
			if (requestId !== translationRequestToken) {
				return;
			}

			console.error(error);
			translationState = 'error';
			studyTranslation.textContent = 'Errore durante la generazione della traduzione.';
			studyTranslation.classList.remove('hidden');
			setMessageState(studyTranslation, 'error-message');
		} finally {
			if (requestId === translationRequestToken) {
				studyShowTranslation.disabled = false;
			}
		}
	}

	async function handleExplainClick() {
		const content = loadCurrentContent();
		syncContentIdentity(content);
		if (!content || !isValidGeneratedContent(content)) {
			renderStudy();
			return;
		}

		if (explanationVisible) {
			explanationVisible = false;
			renderStudy();
			return;
		}

		translationVisible = false;

		if (content.explanationGenerated) {
			explanationVisible = true;
			explanationState = 'ready';
			renderStudy();
			return;
		}

		if (!hasGeminiApiKey()) {
			explanationVisible = true;
			explanationState = 'error';
			studyExplanation.textContent = 'Inserisci la Gemini API key nelle Impostazioni.';
			studyExplanation.classList.remove('hidden');
			setMessageState(studyExplanation, 'error-message');
			studyTranslation.classList.add('hidden');
			return;
		}

		const requestId = ++explanationRequestToken;
		studyExplain.disabled = true;
		explanationVisible = true;
		explanationState = 'loading';
		studyExplanation.textContent = 'Genero spiegazione...';
		studyExplanation.classList.remove('hidden');
		setMessageState(studyExplanation, 'loading');
		studyTranslation.classList.add('hidden');

		try {
			const result = await explainContentWithAI(content);
			if (requestId !== explanationRequestToken) {
				return;
			}

			const explanationMap = new Map(
				(Array.isArray(result?.blocks) ? result.blocks : []).map(block => [block.ref, block.explanation])
			);

			const updatedContent = {
				...content,
				explanationGenerated: true,
				blocks: content.blocks.map(block => ({
					...block,
					explanation: explanationMap.get(block.ref) || block.explanation || ''
				}))
			};

			currentContent = updatedContent;
			explanationState = 'ready';
			saveLastGenerated(updatedContent);
			renderStudy();
		} catch (error) {
			if (requestId !== explanationRequestToken) {
				return;
			}

			console.error(error);
			explanationState = 'error';
			studyExplanation.textContent = 'Errore durante la generazione della spiegazione.';
			studyExplanation.classList.remove('hidden');
			setMessageState(studyExplanation, 'error-message');
		} finally {
			if (requestId === explanationRequestToken) {
				studyExplain.disabled = false;
			}
		}
	}

	function renderStudy() {
		const content = loadCurrentContent();
		syncContentIdentity(content);

		if (!content) {
			showEmptyState();
			studyShowPinyin.textContent = 'Mostra pinyin';
			return;
		}

		if (!isValidGeneratedContent(content)) {
			showInvalidState();
			studyShowPinyin.textContent = 'Mostra pinyin';
			return;
		}

		studyChinese.classList.remove('study-placeholder');
		setMessageState(studyChinese, null);
		studyChinese.innerHTML = renderChineseContent(content);

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
		// Aggiorna card dizionario temporaneo
		loadTemporaryWordsUI();
	}

	studyShowPinyin.onclick = handlePinyinClick;
	studyShowTranslation.onclick = handleTranslationClick;
	studyExplain.onclick = handleExplainClick;

	renderStudy();

	return { renderStudy };
}

