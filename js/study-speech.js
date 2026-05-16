// study-speech.js
// Speech synthesis helpers for study module

export function stopSpeech() {
	if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
	window.speechSynthesis.cancel();
}

export function getChineseTextForSpeech(content) {
	if (!content || !Array.isArray(content.blocks) || !content.blocks.length) return '';
	const segments = content.blocks
		.map(block => (typeof block.chinese === 'string' ? block.chinese.trim() : ''))
		.filter(Boolean);
	return segments.length ? segments.join('。') : '';
}

export function selectChineseVoice() {
	if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
	const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
	if (!Array.isArray(voices) || !voices.length) return null;
	return (
		voices.find(voice => typeof voice.lang === 'string' && voice.lang.toLowerCase().startsWith('zh')) ||
		voices.find(voice => typeof voice.lang === 'string' && voice.lang.toLowerCase().includes('zh')) ||
		voices.find(voice => typeof voice.name === 'string' && /chinese|mandarin/i.test(voice.name)) ||
		null
	);
}

export function speakChineseText(content, setStudyStatus) {
	if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
		setStudyStatus('Lettura audio non supportata su questo dispositivo.', 'error-message');
		return;
	}
	if (!content || !Array.isArray(content.blocks) || !content.blocks.length) {
		setStudyStatus('Nessun testo da leggere.', 'error-message');
		return;
	}
	const text = getChineseTextForSpeech(content);
	if (!text) {
		setStudyStatus('Nessun testo da leggere.', 'error-message');
		return;
	}
	stopSpeech();
	setStudyStatus('');
	const utterance = new window.SpeechSynthesisUtterance(text);
	utterance.lang = 'zh-CN';
	utterance.rate = 0.8;
	utterance.pitch = 1;
	const voice = selectChineseVoice();
	if (voice) utterance.voice = voice;
	utterance.onerror = () => {
		setStudyStatus('Lettura audio non supportata su questo dispositivo.', 'error-message');
	};
	window.speechSynthesis.speak(utterance);
}
