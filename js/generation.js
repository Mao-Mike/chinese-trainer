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
		genTitle.insertAdjacentElement('afterend', button);
		return button;
	})();

	let lastGenerationRequest = null;

	function resetStatus() {
		setStatusState(genTitle, null);
		retryBtn.classList.add('hidden');
	}

	function showLoading() {
		genTitle.textContent = 'Generazione in corso...';
		setStatusState(genTitle, 'loading');
		retryBtn.classList.add('hidden');
	}

	function showError(message) {
		genTitle.textContent = message;
		setStatusState(genTitle, 'error-message');
		retryBtn.classList.remove('hidden');
	}

	function showSuccess(title) {
		genTitle.textContent = title;
		setStatusState(genTitle, 'success-message');
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

	async function handleGeneration(request) {
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
			showError('Errore durante la generazione. Riprova.');
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

		if (!words.length && type === 'text') {
			resetStatus();
			genTitle.textContent = 'Aggiungi parole nel dizionario!';
			setStatusState(genTitle, 'error-message');
			renderStudy();
			return;
		}

		lastGenerationRequest = { type, length, topic, words };
		await handleGeneration(lastGenerationRequest);
	};
}
