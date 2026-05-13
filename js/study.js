import { loadLastGenerated } from './storage.js';
import { fakePinyin, fakeTranslation } from './utils.js';

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

	function splitWithRefs(text, blockSize = 100) {
		const blocks = [];
		let i = 0;

		while (i < text.length) {
			blocks.push(text.slice(i, i + blockSize));
			i += blockSize;
		}

		return blocks.map((block, idx) => ({ text: block, ref: `[${idx + 1}]` }));
	}

	function renderChineseBlock(hanzi, pinyin, showPinyin) {
		return `<span class="chinese-block">${showPinyin ? `<span class="pinyin">${pinyin}</span>` : ''}<span class="hanzi">${hanzi}</span></span>`;
	}

	function renderStudyLine(hanziLine, showPinyin) {
		const hanziArr = hanziLine.split('');
		const pinyinArr = fakePinyin(hanziLine).split(' ');
		let blocks = '';

		for (let i = 0; i < hanziArr.length; i++) {
			blocks += renderChineseBlock(hanziArr[i], pinyinArr[i] || '', showPinyin);
		}

		return `<span class="study-line">${blocks}</span>`;
	}

	function renderDialogueLine(speaker, hanziLine, showPinyin) {
		const hanziArr = hanziLine.split('');
		const pinyinArr = fakePinyin(hanziLine).split(' ');
		let blocks = '';

		for (let i = 0; i < hanziArr.length; i++) {
			blocks += renderChineseBlock(hanziArr[i], pinyinArr[i] || '', showPinyin);
		}

		return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content study-line">${blocks}</span></div>`;
	}

	function renderStudy() {
		const last = loadLastGenerated();

		if (!last || !last.content) {
			studyChinese.textContent = 'Nessun testo generato. Usa la sezione Generazione.';
			studyTranslation.textContent = '';
			studyExplanation.textContent = '';
			studyTranslation.classList.add('hidden');
			studyExplanation.classList.add('hidden');
			studyShowPinyin.textContent = pinyinVisible ? 'Nascondi pinyin' : 'Mostra pinyin';
			return;
		}

		if (last.type === 'text') {
			const blocks = splitWithRefs(last.content);
			studyChinese.innerHTML = blocks
				.map(block => renderStudyLine(block.text, pinyinVisible) + `<span style="color:#bbb;margin-left:0.5em">${block.ref}</span>`)
				.join('');

			if (translationVisible) {
				studyTranslation.innerHTML = blocks
					.map(block => `<div>${fakeTranslation(block.text)} <span style="color:#bbb">${block.ref}</span></div>`)
					.join('');
				studyTranslation.classList.remove('hidden');
				studyExplanation.classList.add('hidden');
			} else {
				studyTranslation.classList.add('hidden');
			}

			if (explanationVisible) {
				studyExplanation.innerHTML = blocks
					.map(block => `<div>Spiegazione di: ${block.text} <span style="color:#bbb">${block.ref}</span></div>`)
					.join('');
				studyExplanation.classList.remove('hidden');
				studyTranslation.classList.add('hidden');
			} else {
				studyExplanation.classList.add('hidden');
			}
		} else {
			const lines = last.content.split('\n');
			studyChinese.innerHTML = lines.map((line, idx) => {
				const [speaker, ...phraseArr] = line.split(':');
				const phrase = phraseArr.join(':').trim();
				return renderDialogueLine(speaker, phrase, pinyinVisible) + `<span style="color:#bbb;margin-left:0.5em">[${idx + 1}]</span>`;
			}).join('');

			if (translationVisible) {
				studyTranslation.innerHTML = lines.map((line, idx) => {
					const [speaker, ...phraseArr] = line.split(':');
					const phrase = phraseArr.join(':').trim();
					return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content">${fakeTranslation(phrase)}</span><span style="color:#bbb;margin-left:0.5em">[${idx + 1}]</span></div>`;
				}).join('');
				studyTranslation.classList.remove('hidden');
				studyExplanation.classList.add('hidden');
			} else {
				studyTranslation.classList.add('hidden');
			}

			if (explanationVisible) {
				studyExplanation.innerHTML = lines.map((line, idx) => {
					const [speaker, ...phraseArr] = line.split(':');
					const phrase = phraseArr.join(':').trim();
					return `<div class="dialogue-line"><span class="dialogue-speaker">${speaker}:</span><span class="dialogue-content">Spiegazione di: ${phrase}</span><span style="color:#bbb;margin-left:0.5em">[${idx + 1}]</span></div>`;
				}).join('');
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
