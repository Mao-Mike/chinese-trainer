import { explainContentWithAI } from './ai.js';
import { getAllWords, saveLastGenerated, loadLastGenerated } from './storage.js';
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

	function renderStudyText(normalized) {
		if (normalized.type === 'text') {
			studyChinese.innerHTML = normalized.blocks
				.map(block => `${renderStudyLine(block.tokens, pinyinVisible)} <span class="study-ref">${escapeHTML(block.ref)}</span>`)
				.join('');
			return;
		}

		studyChinese.innerHTML = normalized.blocks
			.map(block => `${renderDialogueLine(block, pinyinVisible)} <span class="study-ref">${escapeHTML(block.ref)}</span>`)
			.join('');
	}

	function renderTranslation(normalized) {
		const show = translationVisible && !explanationVisible;
		studyTranslation.innerHTML = normalized.blocks
			.map(block => normalized.type === 'text'
				? `<div>${escapeHTML(block.translation || fakeTranslation(block.chinese))} <span class="study-ref">${escapeHTML(block.ref)}</span></div>`
				: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.translation || fakeTranslation(block.chinese))}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`)
			.join('');
		studyTranslation.classList.toggle('hidden', !show);
	}

	function renderExplanation(normalized) {
		if (!explanationVisible) {
			studyExplanation.classList.add('hidden');
			return;
		}

		if (!normalized.explanationGenerated && explanationState !== 'ready') {
			studyExplanation.classList.remove('hidden');
			return;
		}

		studyExplanation.innerHTML = normalized.blocks
			.map(block => normalized.type === 'text'
				? `<div>${escapeHTML(block.explanation || `Spiegazione di: ${block.chinese}`)} <span class="study-ref">${escapeHTML(block.ref)}</span></div>`
				: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.explanation || `Spiegazione di: ${block.chinese}`)}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`)
			.join('');
		studyExplanation.classList.remove('hidden');
	}

	function resetPanels() {
		studyTranslation.textContent = '';
		studyExplanation.textContent = '';
		studyTranslation.classList.add('hidden');
		studyExplanation.classList.add('hidden');
	}

	function renderStudy() {
		const normalized = normalizeGeneratedContent(loadLastGenerated());
		currentContent = normalized;

		if (!normalized) {
			studyChinese.textContent = 'Nessun testo generato. Usa la sezione Genera.';
			setMessageState(studyChinese, 'error-message');
			pinyinVisible = false;
			translationVisible = false;
			explanationVisible = false;
			explanationState = 'idle';
			resetPanels();
			studyShowPinyin.textContent = 'Mostra pinyin';
			return;
		}

		if (!isValidGeneratedContent(normalized)) {
			studyChinese.textContent = 'Il contenuto generato non è valido. Genera un nuovo testo.';
			setMessageState(studyChinese, 'error-message');
			pinyinVisible = false;
			translationVisible = false;
			explanationVisible = false;
			explanationState = 'idle';
			resetPanels();
			studyShowPinyin.textContent = 'Mostra pinyin';
			return;
		}

		setMessageState(studyChinese, null);
		renderStudyText(normalized);
		renderTranslation(normalized);
		renderExplanation(normalized);
		studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
	}

	async function handleExplainClick() {
		if (!currentContent || !isValidGeneratedContent(currentContent)) {
			return;
		}

		if (explanationVisible && currentContent.explanationGenerated) {
			explanationVisible = false;
			renderStudy();
			return;
		}

		if (currentContent.explanationGenerated) {
			explanationVisible = true;
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
				(Array.isArray(result?.blocks) ? result.blocks : [])
					.map(block => [block.ref, block.explanation])
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

	// Arricchisce i token con il pinyin dal dizionario locale
	async function enrichTokensWithLocalDictionary(content) {
		if (!content || !Array.isArray(content.blocks)) return content;
		const allWords = await getAllWords();
		const hanziToPinyin = new Map();
		for (const w of allWords) {
			if (w.hanzi && w.pinyin) hanziToPinyin.set(w.hanzi, w.pinyin);
		}
		const updatedBlocks = content.blocks.map(block => {
			const updatedTokens = block.tokens.map(token => {
				if (token.pinyin && token.pinyin.trim()) return token;
				// Prova match esatto
				if (token.hanzi && hanziToPinyin.has(token.hanzi)) {
					return { ...token, pinyin: hanziToPinyin.get(token.hanzi) };
				}
				// Fallback carattere per carattere
				if (token.hanzi && token.hanzi.length > 1) {
					const chars = Array.from(token.hanzi);
					const pinyinArr = chars.map(c => hanziToPinyin.get(c) || '');
					if (pinyinArr.every(p => p)) {
						return { ...token, pinyin: pinyinArr.join(' ') };
					}
				}
				return token;
			});
			return { ...block, tokens: updatedTokens };
		});
		const updatedContent = { ...content, blocks: updatedBlocks };
		return updatedContent;
	}

	studyShowPinyin.onclick = async () => {
		if (!currentContent || !isValidGeneratedContent(currentContent)) return;
		if (!pinyinVisible) {
			// Attiva pinyin: aggiorna i token solo localmente
			const enriched = await enrichTokensWithLocalDictionary(currentContent);
			currentContent = enriched;
			saveLastGenerated(enriched);
			pinyinVisible = true;
		} else {
			pinyinVisible = false;
		}
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
