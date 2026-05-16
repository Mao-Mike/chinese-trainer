// study-ui.js
// UI rendering and DOM manipulation for study module
import { escapeHTML, isValidGeneratedContent, normalizeGeneratedContent } from './utils.js';

export function setMessageState(element, state) {
	if (!element) return;
	element.classList.remove('loading', 'error-message', 'success-message');
	if (state) element.classList.add(state);
}

export function setStudyStatus(studyStatus, message = '', state = '') {
	if (!studyStatus) return;
	studyStatus.textContent = message;
	studyStatus.classList.toggle('hidden', !message);
	setMessageState(studyStatus, state);
}

export function showEmptyState(studyChinese, studyTranslation, studyExplanation, setMessageStateFn, setStudyStatusFn) {
	studyChinese.textContent = 'Testo';
	studyChinese.classList.add('study-placeholder');
	setMessageStateFn(studyChinese, 'loading');
	studyTranslation.textContent = '';
	studyExplanation.textContent = '';
	studyTranslation.classList.add('hidden');
	studyExplanation.classList.add('hidden');
	setStudyStatusFn('');
}

export function showInvalidState(studyChinese, studyTranslation, studyExplanation, setMessageStateFn, setStudyStatusFn) {
	studyChinese.textContent = 'Il contenuto generato non è valido. Genera un nuovo testo.';
	studyChinese.classList.add('study-placeholder');
	setMessageStateFn(studyChinese, 'error-message');
	studyTranslation.textContent = '';
	studyExplanation.textContent = '';
	studyTranslation.classList.add('hidden');
	studyExplanation.classList.add('hidden');
	setStudyStatusFn('');
}

export function renderChineseBlock(token, showPinyin, getTokenClass) {
	const tokenClass = getTokenClass(token);
	const hanzi = escapeHTML(token.hanzi || '');
	const pinyin = token.pinyin ? escapeHTML(token.pinyin) : '';
	const pinyinMarkup = showPinyin
		? (pinyin ? `<span class="pinyin">${pinyin}</span>` : '<span class="pinyin pinyin-empty">&nbsp;</span>')
		: '';
	return `<span class="chinese-block ${tokenClass}">${pinyinMarkup}<span class="hanzi">${hanzi}</span></span>`;
}

export function renderStudyLine(block, showPinyin, getTokenClass, normalizeTokensForRender) {
	const tokens = normalizeTokensForRender(block);
	return `<span class="study-line">${tokens.map(token => renderChineseBlock(token, showPinyin, getTokenClass)).join('')}</span>`;
}

export function renderDialogueLine(block, showPinyin, getTokenClass, normalizeTokensForRender) {
	const speaker = escapeHTML(block.speaker || '');
	return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content study-line">${normalizeTokensForRender(block).map(token => renderChineseBlock(token, showPinyin, getTokenClass)).join('')}</span></div>`;
}

export function renderChineseContent(content, pinyinVisible, getTokenClass, normalizeTokensForRender) {
	return content.blocks
		.map(block => `
				<div class="study-block">
					${content.type === 'text'
						? `${renderStudyLine(block, pinyinVisible, getTokenClass, normalizeTokensForRender)} <span class="study-ref">${escapeHTML(block.ref)}</span>`
						: `${renderDialogueLine(block, pinyinVisible, getTokenClass, normalizeTokensForRender)} <span class="study-ref">${escapeHTML(block.ref)}</span>`}
				</div>
			`)
		.join('');
}

export function renderTranslationContent(content) {
	return content.blocks
		.map(block => {
			const translation = typeof block.translation === 'string' && block.translation.trim()
				? escapeHTML(block.translation)
				: '<span class="muted">Traduzione non disponibile per questo testo.</span>';
			return `<div class="study-block">${content.type === 'text'
				? `${translation} <span class="study-ref">${escapeHTML(block.ref)}</span>`
				: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${translation}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`}
			</div>`;
		})
		.join('');
}

export function renderExplanationContent(content) {
	return content.blocks
		.map(block => {
			const explanation = typeof block.explanation === 'string' && block.explanation.trim()
				? escapeHTML(block.explanation)
				: '<span class="muted">Spiegazione non disponibile per questo testo.</span>';
			return `<div class="study-block">${content.type === 'text'
				? `${explanation} <span class="study-ref">${escapeHTML(block.ref)}</span>`
				: `<div class="dialogue-line"><span class="dialogue-speaker">${escapeHTML(block.speaker || '')}:</span><span class="dialogue-content">${explanation}</span><span class="study-ref">${escapeHTML(block.ref)}</span></div>`}
			</div>`;
		})
		.join('');
}
