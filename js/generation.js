import { generateContentWithAI, identifyTemporaryWordsWithAI } from './ai.js';
import { getAllWords, saveLastGenerated, clearTemporaryWords, addTemporaryWord } from './storage.js';

function setStatusState(element, state) {
	element.classList.remove('loading', 'error-message', 'success-message');
	if (state) {
		element.classList.add(state);
	}
}

function getGenerationErrorMessage(error) {
	const message = error instanceof Error ? error.message : String(error || '');
	const normalized = message.toLowerCase();

	if (normalized.includes('api key')) {
		return 'Inserisci la Gemini API key in Impostazioni.';
	}

	if (normalized.includes('invalid json')) {
		return 'La risposta AI non era nel formato atteso. Riprova.';
	}

	if (normalized.includes('429') || normalized.includes('quota') || normalized.includes('rate')) {
		return 'Limite temporaneo API raggiunto. Riprova più tardi.';
	}

	if (normalized.includes('400') || normalized.includes('model')) {
		return 'Modello Gemini non valido o richiesta non accettata.';
	}

	return 'Generazione non riuscita. Riprova con un testo più breve.';
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

			// Dizionario temporaneo: svuota, identifica nuovi vocaboli, salva
			try {
				await clearTemporaryWords();
				const baseHanziList = Array.isArray(request.words) ? request.words.map(w => w.hanzi) : [];
				const result = await identifyTemporaryWordsWithAI(generated, baseHanziList);
				if (result && Array.isArray(result.words)) {
					for (const w of result.words) {
						await addTemporaryWord(w.hanzi, w.pinyin);
					}
				}
			} catch (err) {
				// Non bloccare la generazione
				console.error('Errore identificazione vocaboli temporanei:', err);
			}

			showSuccess(generated.title);
			renderStudy();
		} catch (error) {
			console.error(error);
			showError(getGenerationErrorMessage(error));
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

