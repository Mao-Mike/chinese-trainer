import { loadLastGenerated } from './storage.js';
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

	function setMessageState(element, state) {
		element.classList.remove('loading', 'error-message', 'success-message');
		if (state) {
			element.classList.add(state);
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

	function renderStudy() {
		const normalized = normalizeGeneratedContent(loadLastGenerated());

		if (!normalized) {
			studyChinese.textContent = 'Nessun testo generato. Usa la sezione Generazione.';
			setMessageState(studyChinese, 'error-message');
			studyTranslation.textContent = '';
			studyExplanation.textContent = '';
			studyTranslation.classList.add('hidden');
			studyExplanation.classList.add('hidden');
			studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
			return;
		}

		if (!isValidGeneratedContent(normalized)) {
			studyChinese.textContent = 'Il contenuto generato non è valido. Genera un nuovo testo.';
			setMessageState(studyChinese, 'error-message');
			studyTranslation.textContent = '';
			studyExplanation.textContent = '';
			studyTranslation.classList.add('hidden');
			studyExplanation.classList.add('hidden');
			studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
			return;
		}

		setMessageState(studyChinese, null);

		if (normalized.type === 'text') {
			studyChinese.innerHTML = normalized.blocks
				.map(block => renderStudyLine(block.tokens, pinyinVisible) + `<span style="color:#bbb;margin-left:0.5em">${escapeHTML(block.ref)}</span>`)
				.join('');

			if (translationVisible) {
				studyTranslation.innerHTML = normalized.blocks
					.map(block => `<div>${escapeHTML(block.translation || fakeTranslation(block.chinese))} <span style="color:#bbb">${escapeHTML(block.ref)}</span></div>`)
					.join('');
				studyTranslation.classList.remove('hidden');
				studyExplanation.classList.add('hidden');
			} else {
				studyTranslation.classList.add('hidden');
			}

			if (explanationVisible) {
				studyExplanation.innerHTML = normalized.blocks
					.map(block => `<div>${escapeHTML(block.explanation || `Spiegazione di: ${block.chinese}`)} <span style="color:#bbb">${escapeHTML(block.ref)}</span></div>`)
					.join('');
				studyExplanation.classList.remove('hidden');
				studyTranslation.classList.add('hidden');
			} else {
				studyExplanation.classList.add('hidden');
			}
		} else {
			studyChinese.innerHTML = normalized.blocks
				.map(block => renderDialogueLine(block, pinyinVisible) + `<span style="color:#bbb;margin-left:0.5em">${escapeHTML(block.ref)}</span>`)
				.join('');

			if (translationVisible) {
				studyTranslation.innerHTML = normalized.blocks
					.map(block => `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.translation || fakeTranslation(block.chinese))}</span><span style="color:#bbb;margin-left:0.5em">${escapeHTML(block.ref)}</span></div>`)
					.join('');
				studyTranslation.classList.remove('hidden');
				studyExplanation.classList.add('hidden');
			} else {
				studyTranslation.classList.add('hidden');
			}

			if (explanationVisible) {
				studyExplanation.innerHTML = normalized.blocks
					.map(block => `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${escapeHTML(block.explanation || `Spiegazione di: ${block.chinese}`)}</span><span style="color:#bbb;margin-left:0.5em">${escapeHTML(block.ref)}</span></div>`)
					.join('');
				studyExplanation.classList.remove('hidden');
				studyTranslation.classList.add('hidden');
			} else {
				studyExplanation.classList.add('hidden');
			}
		}

		studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
	}

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

	renderStudy();

	return { renderStudy };
}
