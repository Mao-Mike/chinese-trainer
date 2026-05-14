import { explainContentWithAI } from './ai.js';
import { loadLastGenerated, saveLastGenerated } from './storage.js';
import { escapeHTML, fakeTranslation, isValidGeneratedContent, normalizeGeneratedContent } from './utils.js';

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
	let explanationState = 'idle';
	let currentContent = null;
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

	function renderChineseBlock(token, showPinyin) {
		const pinyin = escapeHTML(token.pinyin || '');
		const hanzi = escapeHTML(token.hanzi || '');
		return `<span class="chinese-block">${showPinyin ? `<span class="pinyin">${pinyin}</span>` : ''}<span class="hanzi">${hanzi}</span></span>`;
	}

	function renderStudyLine(tokens, showPinyin) {
		return `<span class="study-line">${tokens.map(token => renderChineseBlock(token, showPinyin)).join('')}</span>`;
	}

	function renderDialogueLine(block, showPinyin) {
		const speaker = escapeHTML(block.speaker || '');
		return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content study-line">${block.tokens.map(token => renderChineseBlock(token, showPinyin)).join('')}</span></div>`;
	}

	function setEmptyState() {
		studyChinese.textContent = 'Testo';
		studyChinese.classList.add('study-placeholder');
		setMessageState(studyChinese, 'loading');
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
	}

	function renderStudy() {
		const normalized = normalizeGeneratedContent(loadLastGenerated());
		currentContent = normalized;

		if (!normalized) {
			pinyinVisible = false;
			translationVisible = false;
			explanationVisible = false;
			explanationState = 'idle';
			setEmptyState();
			studyShowPinyin.textContent = 'Mostra pinyin';
			return;
		}

		if (!isValidGeneratedContent(normalized)) {
			studyChinese.textContent = 'Il contenuto generato non è valido. Genera un nuovo testo.';
			studyChinese.classList.add('study-placeholder');
			setMessageState(studyChinese, 'error-message');
			pinyinVisible = false;
			translationVisible = false;
			explanationVisible = false;
			explanationState = 'idle';
			studyTranslation.textContent = '';
			studyExplanation.textContent = '';
			studyTranslation.classList.add('hidden');
			studyExplanation.classList.add('hidden');
			studyShowPinyin.textContent = 'Mostra pinyin';
			return;
		}

		studyChinese.classList.remove('study-placeholder');
		setMessageState(studyChinese, null);

		if (normalized.type === 'text') {
			studyChinese.innerHTML = normalized.blocks
				.map(block => `${renderStudyLine(block.tokens, pinyinVisible)} <span class="study-ref">${escapeHTML(block.ref)}</span>`)
				.join('');
		} else {
			studyChinese.innerHTML = normalized.blocks
				.map(block => `${renderDialogueLine(block, pinyinVisible)} <span class="study-ref">${escapeHTML(block.ref)}</span>`)
				.join('');
		}

		if (translationVisible && !explanationVisible) {
			studyTranslation.innerHTML = normalized.blocks
				.map(block => normalized.type === 'text'
					? `<div>${escapeHTML(block.translation || fakeTranslation(block.chinese))} <span class="study-ref">${escapeHTML(block.ref)}</span></div>`
					: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.translation || fakeTranslation(block.chinese))}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`)
				.join('');
			studyTranslation.classList.remove('hidden');
		} else {
			studyTranslation.classList.add('hidden');
		}

		if (explanationVisible) {
			if (!normalized.explanationGenerated && explanationState !== 'ready' && explanationState !== 'loading' && explanationState !== 'error') {
				studyExplanation.textContent = '';
			} else if (normalized.explanationGenerated || explanationState === 'ready') {
				studyExplanation.innerHTML = normalized.blocks
					.map(block => normalized.type === 'text'
						? `<div>${escapeHTML(block.explanation || `Spiegazione di: ${block.chinese}`)} <span class="study-ref">${escapeHTML(block.ref)}</span></div>`
						: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.explanation || `Spiegazione di: ${block.chinese}`)}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`)
					.join('');
			}
			studyExplanation.classList.remove('hidden');
		} else {
			studyExplanation.classList.add('hidden');
		}

		studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
	}

	async function handleExplainClick() {
		if (!currentContent || !isValidGeneratedContent(currentContent)) {
			return;
		}

		if (currentContent.explanationGenerated) {
			explanationVisible = !explanationVisible;
			translationVisible = false;
			renderStudy();
			return;
		}

		if (!hasGeminiApiKey()) {
			explanationVisible = true;
			translationVisible = false;
			explanationState = 'error';
			studyExplanation.textContent = 'Inserisci la Gemini API key nelle Impostazioni.';
			studyExplanation.classList.remove('hidden');
			setMessageState(studyExplanation, 'error-message');
			return;
		}

		const requestId = ++explanationRequestToken;
		studyExplain.disabled = true;
		explanationVisible = true;
		translationVisible = false;
		explanationState = 'loading';
		studyExplanation.textContent = 'Genero spiegazione...';
		studyExplanation.classList.remove('hidden');
		setMessageState(studyExplanation, 'loading');

		try {
			const result = await explainContentWithAI(currentContent);
			if (requestId !== explanationRequestToken) {
				return;
			}

			const explanationMap = new Map(
				(Array.isArray(result?.blocks) ? result.blocks : []).map(block => [block.ref, block.explanation])
			);

			const updatedContent = {
				...currentContent,
				explanationGenerated: true,
				blocks: currentContent.blocks.map(block => ({
					...block,
					explanation: explanationMap.get(block.ref) || block.explanation || ''
				}))
			};

			currentContent = updatedContent;
			explanationState = 'ready';
			explanationVisible = true;
			translationVisible = false;
			saveLastGenerated(updatedContent);
			renderStudy();
		} catch (error) {
			if (requestId !== explanationRequestToken) {
				return;
			}

			console.error(error);
			explanationVisible = true;
			translationVisible = false;
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

	studyShowPinyin.onclick = () => {
		pinyinVisible = !pinyinVisible;
		renderStudy();
	};

	studyShowTranslation.onclick = () => {
		translationVisible = !translationVisible;
		if (translationVisible) {
			explanationVisible = false;
		}
		renderStudy();
	};

	studyExplain.onclick = handleExplainClick;

	renderStudy();

	return { renderStudy };
}

