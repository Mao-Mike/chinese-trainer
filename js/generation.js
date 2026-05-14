import { generateContentWithAI } from './ai.js';
import { getAllWords, saveLastGenerated } from './storage.js';

function setStatusState(element, state) {
	element.classList.remove('loading', 'error-message', 'success-message');
	if (state) {
		element.classList.add(state);
	}
}

export function initGeneration(renderStudy) {
	const genTypeRadios = document.getElementsByName('gen-type');
	const genLength = document.getElementById('gen-length');
	const genLengthValue = document.getElementById('gen-length-value');
	const genBtn = document.getElementById('gen-generate');
	const genTitle = document.getElementById('gen-title');
	const genTopicInput = document.getElementById('gen-topic');
	const retryBtn = document.getElementById('gen-retry') || (() => {
		const button = document.createElement('button');
		button.id = 'gen-retry';
		button.type = 'button';
		button.textContent = 'Riprova';
		button.classList.add('hidden');
		button.classList.add('btn', 'btn-secondary');
		genTitle.insertAdjacentElement('afterend', button);
		return button;
	})();

	let lastGenerationRequest = null;

	function showLoading() {
		genTitle.textContent = 'Generazione in corso...';
		genTitle.classList.remove('hidden');
		setStatusState(genTitle, 'loading');
		retryBtn.classList.add('hidden');
	}

	function showError(message) {
		genTitle.textContent = message;
		genTitle.classList.remove('hidden');
		setStatusState(genTitle, 'error-message');
		retryBtn.classList.remove('hidden');
	}

	function showSuccess(title) {
		genTitle.textContent = title || '';
		genTitle.classList.toggle('hidden', !title);
		setStatusState(genTitle, title ? 'success-message' : '');
		retryBtn.classList.add('hidden');
	}

	genLengthValue.textContent = genLength.value;
	genLength.oninput = () => {
		genLengthValue.textContent = genLength.value;
	};

	retryBtn.onclick = () => {
		if (lastGenerationRequest) {
			handleGeneration(lastGenerationRequest);
		}
	};

	function hasGeminiApiKey() {
		try {
			if (typeof localStorage === 'undefined') {
				return false;
			}

			const value = localStorage.getItem('geminiApiKey') || localStorage.geminiApiKey;
			return typeof value === 'string' && value.trim().length > 0;
		} catch {
			return false;
		}
	}

	async function handleGeneration(request) {
		if (!hasGeminiApiKey()) {
			showError('Inserisci la Gemini API key in Impostazioni.');
			return;
		}

		genBtn.disabled = true;
		showLoading();

		try {
			const generated = await generateContentWithAI({
				type: request.type,
				topic: request.topic,
				targetLength: request.length,
				words: request.words
			});

			saveLastGenerated(generated);
			showSuccess(generated.title);
			renderStudy();
		} catch (error) {
			showError('Errore durante la generazione. Controlla API key, modello o connessione.');
			console.error(error);
			renderStudy();
		} finally {
			genBtn.disabled = false;
		}
	}

	genBtn.onclick = async () => {
		const type = Array.from(genTypeRadios).find(radio => radio.checked).value;
		const length = parseInt(genLength.value, 10);
		const topic = genTopicInput.value.trim();
		const words = await getAllWords();

		lastGenerationRequest = { type, length, topic, words };
		await handleGeneration(lastGenerationRequest);
	};
}
