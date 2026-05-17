import { generateContentWithAI } from './ai.js';
import { getAllWords, saveLastGenerated, clearTemporaryWords, addTemporaryWord } from './storage.js';
import { hasGeminiApiKey, getFriendlyAIErrorMessage, isQuotaError } from './utils.js';

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
	const genCancelBtn = document.getElementById('gen-cancel');
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
		   if (genCancelBtn) genCancelBtn.classList.remove('hidden');
	   }

	   function showError(message) {
		   genTitle.textContent = message;
		   genTitle.classList.remove('hidden');
		   setStatusState(genTitle, 'error-message');
		   retryBtn.classList.remove('hidden');
		   if (genCancelBtn) genCancelBtn.classList.add('hidden');
	   }

	   function showSuccess(title) {
		   genTitle.textContent = title || '';
		   genTitle.classList.toggle('hidden', !title);
		   setStatusState(genTitle, title ? 'success-message' : '');
		   retryBtn.classList.add('hidden');
		   if (genCancelBtn) genCancelBtn.classList.add('hidden');
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




	   let currentAbortController = null;
	   let isGenerating = false;
	   async function handleGeneration(request) {
		   if (isGenerating) return;
		   isGenerating = true;
		   try {
			   if (!hasGeminiApiKey()) {
				   showError('Inserisci la Gemini API key in Impostazioni.');
				   return;
			   }
			   genBtn.disabled = true;
			   retryBtn.disabled = true;
			   showLoading();
			   if (genCancelBtn) genCancelBtn.disabled = false;
			   currentAbortController = new AbortController();
			   let generationAborted = false;
			   const abortHandler = () => {
				   generationAborted = true;
				   if (genCancelBtn) genCancelBtn.disabled = true;
			   };
			   if (genCancelBtn) genCancelBtn.onclick = () => {
				   if (currentAbortController) {
					   currentAbortController.abort();
					   abortHandler();
				   }
			   };
			   const generated = await generateContentWithAI({
				   type: request.type,
				   topic: request.topic,
				   targetLength: request.length,
				   words: request.words,
				   signal: currentAbortController.signal
			   });
			   if (generationAborted) {
				   showError('Generazione annullata.');
				   return;
			   }
			   await saveLastGenerated(generated); // salva anche nello storico e imposta current
			   // Dizionario temporaneo: svuota, aggiungi newWords
			   try {
				   await clearTemporaryWords();
				   if (Array.isArray(generated.newWords)) {
					   for (const w of generated.newWords) {
						   try {
							   await addTemporaryWord(w.hanzi, w.pinyin);
						   } catch (err) {
							   console.error('Errore addTemporaryWord:', w, err);
						   }
					   }
				   }
			   } catch (err) {
				   // Non bloccare la generazione
				   console.error('Errore gestione vocaboli temporanei:', err);
			   }
			   showSuccess(generated.title);
			   renderStudy();
		   } catch (error) {
			   console.error('Generation failed:', error);
			   if (error && error.name === 'AbortError') {
				   showError('Generazione annullata.');
			   } else if (typeof error.message === 'string' && error.message.includes('invalid JSON')) {
				   showError('La risposta AI non era in formato valido. Riprova con un testo più corto.');
			   } else if (typeof error.message === 'string' && error.message.includes('empty response')) {
				   showError('L’AI ha restituito una risposta vuota. Riprova.');
			   } else if (typeof error.message === 'string' && error.message.includes('request invalid')) {
				   showError('La richiesta AI non è valida. Prova una lunghezza minore o un argomento più semplice.');
			   } else if (typeof error.message === 'string' && (error.message.includes('not authorized') || error.message.includes('API key invalid'))) {
				   showError('API key non valida o non autorizzata.');
			   } else if (typeof error.message === 'string' && error.message.includes('temporarily unavailable')) {
				   showError('Servizio Gemini temporaneamente non disponibile. Riprova più tardi.');
			   } else if (isQuotaError(error)) {
				   showError('Limite gratuito AI raggiunto. Riprova più tardi.');
			   } else {
				   showError(getFriendlyAIErrorMessage(error));
			   }
			   renderStudy();
		   } finally {
			   genBtn.disabled = false;
			   retryBtn.disabled = false;
			   if (genCancelBtn) {
				   genCancelBtn.classList.add('hidden');
				   genCancelBtn.disabled = false;
				   genCancelBtn.onclick = null;
			   }
			   currentAbortController = null;
			   isGenerating = false;
		   }
	   }

	   genBtn.onclick = async () => {
		   if (isGenerating) return;
		   const type = Array.from(genTypeRadios).find(radio => radio.checked).value;
		   const length = parseInt(genLength.value, 10);
		   const topic = genTopicInput.value.trim();
		   const words = await getAllWords();

		   lastGenerationRequest = { type, length, topic, words };
		   await handleGeneration(lastGenerationRequest);
	   };
}

